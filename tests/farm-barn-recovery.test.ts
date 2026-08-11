import { describe, expect, it } from 'vitest';
import '../src/data';
import { BARN_LOFT_EXPANSION } from '../src/data/farmEquipment.data';
import {
  cheapestFarmSeed, clearWitheredFarmCrop, countyReliefEligible, farmCropStage, farmOf, issueCountyReliefSeed,
  purchaseBarnLoftExpansion, purchaseNeighborParcel, plantFarmCrop,
} from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';

const NOW = 1_784_394_000_000;
const makeFarm = () => createFarmGame('Recovery Test', 77, NOW);

describe('Barn expansion and recovery', () => {
  it('uses explicit time boundaries with a generous 15 minute wither window', () => {
    const crop = { defId: 'crop_wheat', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0 };
    const def = farmCropDef('crop_wheat');
    expect(farmCropStage(crop, NOW + def.growMs - 1)).toBe('growing');
    expect(farmCropStage(crop, NOW + def.growMs)).toBe('ready');
    expect(def.witherMs).toBeGreaterThanOrEqual(900_000);
    expect(farmCropStage(crop, NOW + def.growMs + def.witherMs)).toBe('withered');
  });

  it('keeps farm corn and potato presentation stages aligned with harvest readiness', () => {
    for (const cropId of ['crop_corn', 'crop_potato']) {
      const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
      farm.seeds[cropId] = 1; expect(plantFarmCrop(state, plot.uid, cropId, NOW).ok).toBe(true);
      expect(farmCropStage(plot.crop, NOW)).toBe('growing');
      plot.crop!.plantedAt = NOW - farmCropDef(cropId).growMs - 1;
      expect(farmCropStage(plot.crop, NOW)).toBe('ready');
      plot.crop!.plantedAt = NOW - farmCropDef(cropId).growMs - farmCropDef(cropId).witherMs;
      expect(farmCropStage(plot.crop, NOW)).toBe('withered');
    }
  });

  it('clears withered crops without refund and makes the section plantable', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    farm.seeds.crop_wheat = 0;
    plot.crop = { defId: 'crop_wheat', plantedAt: NOW - farmCropDef('crop_wheat').growMs - farmCropDef('crop_wheat').witherMs, wateredBonusMs: 0, lastWateredAt: 0 };
    const before = JSON.stringify({ cash: farm.cashCents, seeds: farm.seeds, storage: farm.storage });
    expect(clearWitheredFarmCrop(state, plot.uid, NOW).ok).toBe(true);
    expect(plot.crop).toBeNull();
    expect(JSON.stringify({ cash: farm.cashCents, seeds: farm.seeds, storage: farm.storage })).toBe(before);
    farm.seeds.crop_wheat = 1;
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', NOW).ok).toBe(true);
  });

  it('issues exactly one cheapest seed only for a true zero-asset farm', () => {
    const state = makeFarm(); const farm = farmOf(state);
    farm.cashCents = 0; Object.keys(farm.seeds).forEach((id) => { farm.seeds[id] = 0; });
    expect(cheapestFarmSeed()).toEqual({ cropId: 'crop_wheat', priceCents: 1_000, name: 'Wheat' });
    expect(countyReliefEligible(state, NOW)).toBe(true);
    expect(issueCountyReliefSeed(state, NOW).ok).toBe(true);
    expect(farm.seeds.crop_wheat).toBe(1);
    expect(farm.seeds.crop_carrot).toBe(0);
    const snapshot = JSON.stringify(farm);
    expect(issueCountyReliefSeed(state, NOW).ok).toBe(false);
    expect(JSON.stringify(farm)).toBe(snapshot);
  });

  it('keeps County relief permanently claimed through planting, withering, clearing, and reload', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    farm.cashCents = 0; Object.keys(farm.seeds).forEach((id) => { farm.seeds[id] = 0; });
    expect(issueCountyReliefSeed(state, NOW).ok).toBe(true);
    expect(farm.countyReliefClaimed).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', NOW).ok).toBe(true);
    plot.crop!.plantedAt = NOW - farmCropDef('crop_wheat').growMs - farmCropDef('crop_wheat').witherMs;
    expect(clearWitheredFarmCrop(state, plot.uid, NOW).ok).toBe(true);
    expect(issueCountyReliefSeed(state, NOW).ok).toBe(false);
    const reloaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(farmOf(reloaded).countyReliefClaimed).toBe(true);
    expect(issueCountyReliefSeed(reloaded, NOW + 2).ok).toBe(false);
  });

  it('blocks relief when stored, seeded, or viable planted assets exist, but ignores withered plots', () => {
    const state = makeFarm(); const farm = farmOf(state); farm.cashCents = 0;
    Object.keys(farm.seeds).forEach((id) => { farm.seeds[id] = 0; });
    farm.storage.crop_corn = 1; expect(countyReliefEligible(state, NOW)).toBe(false); farm.storage.crop_corn = 0;
    farm.seeds.crop_wheat = 1; expect(countyReliefEligible(state, NOW)).toBe(false); farm.seeds.crop_wheat = 0;
    state.plots[0].crop = { defId: 'crop_wheat', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0 };
    expect(countyReliefEligible(state, NOW)).toBe(false);
    state.plots[0].crop.plantedAt = NOW - farmCropDef('crop_wheat').growMs - farmCropDef('crop_wheat').witherMs;
    expect(countyReliefEligible(state, NOW)).toBe(true);
  });

  it('unlocks the loft only after the neighboring parcel and purchases atomically once', () => {
    const state = makeFarm(); const farm = farmOf(state);
    expect(purchaseBarnLoftExpansion(state).ok).toBe(false);
    farm.cashCents = 1_000_000; expect(purchaseNeighborParcel(state).ok).toBe(true);
    const before = farm.cashCents; expect(purchaseBarnLoftExpansion(state).ok).toBe(true);
    expect(farm.cashCents).toBe(before - BARN_LOFT_EXPANSION.priceCents);
    expect(farm.storageCapacity).toBe(BARN_LOFT_EXPANSION.toCapacity);
    expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    const after = JSON.stringify(farm); expect(purchaseBarnLoftExpansion(state).ok).toBe(false); expect(JSON.stringify(farm)).toBe(after);
  });

  it('migrates v6 without the loft and normalizes corrupt current ownership closed', () => {
    const state = makeFarm() as unknown as Record<string, any>;
    state.version = 6; delete state.farm.equipment.barnLoftExpansionOwned;
    const migrated = deserialize(JSON.stringify(state), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).equipment.barnLoftExpansionOwned).toBe(false);
    expect(farmOf(migrated).storageCapacity).toBe(150);
    const corrupt = makeFarm() as unknown as Record<string, any>;
    corrupt.farm.equipment.barnLoftExpansionOwned = 'yes'; corrupt.farm.storageCapacity = 9999;
    const loaded = deserialize(serialize(corrupt as any, NOW), NOW + 1);
    expect(farmOf(loaded).equipment.barnLoftExpansionOwned).toBe(false);
    expect(farmOf(loaded).storageCapacity).toBe(150);
    const malformed = makeFarm() as unknown as Record<string, any>;
    malformed.version = 6; malformed.farm.equipment = 'malformed';
    const safe = deserialize(JSON.stringify(malformed), NOW + 2);
    expect(farmOf(safe).equipment.barnLoftExpansionOwned).toBe(false);
    for (const malformedFarm of [0, false, '', 7, 'bad']) {
      const primitive = makeFarm() as unknown as Record<string, any>;
      primitive.version = 6; primitive.farm = malformedFarm;
      const loadedPrimitive = deserialize(JSON.stringify(primitive), NOW + 3);
      expect(loadedPrimitive.version).toBe(SAVE_VERSION);
      expect(farmOf(loadedPrimitive).storageCapacity).toBe(150);
      expect(farmOf(loadedPrimitive).countyReliefClaimed).toBe(false);
    }
    const inconsistent = makeFarm() as unknown as Record<string, any>;
    inconsistent.farm.equipment.barnLoftExpansionOwned = true;
    inconsistent.farm.parcels.northOwned = false;
    const closed = deserialize(JSON.stringify(inconsistent), NOW + 4);
    expect(farmOf(closed).equipment.barnLoftExpansionOwned).toBe(false);
    expect(farmOf(closed).storageCapacity).toBe(150);
    const nonLiteral = makeFarm() as unknown as Record<string, any>;
    nonLiteral.farm.equipment.barnLoftExpansionOwned = 1;
    nonLiteral.farm.parcels.northOwned = true;
    const closedNonLiteral = deserialize(JSON.stringify(nonLiteral), NOW + 5);
    expect(farmOf(closedNonLiteral).equipment.barnLoftExpansionOwned).toBe(false);
  });
});
