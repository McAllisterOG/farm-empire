import { describe, expect, it } from 'vitest';
import '../src/data';
import { allFarmCrops, farmCropDef } from '../src/core/registry';
import {
  buyFarmSeeds, farmCropUnlockInfo, farmOf, harvestFarmCrop, isFarmCropUnlocked,
  planParcelWork, plantFarmCrop, sellStoredCrop, updateFarmMarketToDay, selectFarmCrop,
} from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { countyDeliveryMarketState } from '../src/ui/panels/farmPanels';

const NOW = 1_784_394_000_000;
const NEW_CROPS = ['crop_carrot', 'crop_tomato', 'crop_cabbage', 'crop_pumpkin'];

function makeFarm() { return createFarmGame('Catalog Test', 444, NOW); }

function makeUnlockedFarm(cropId: string) {
  const state = makeFarm();
  const farm = farmOf(state);
  if (cropId === 'crop_carrot' || cropId === 'crop_tomato') farm.townContact.status = 'completed';
  if (cropId === 'crop_cabbage' || cropId === 'crop_pumpkin') farm.parcels.northOwned = true;
  if (cropId === 'crop_pumpkin') farm.equipment.barnLoftExpansionOwned = true;
  return state;
}

describe('County crop catalog', () => {
  it('defaults new seeds to zero while preserving old seeds on fresh and old v7 saves', () => {
    const fresh = makeFarm();
    for (const id of NEW_CROPS) expect(farmOf(fresh).seeds[id]).toBe(0);
    const old = makeFarm() as unknown as Record<string, any>;
    for (const id of NEW_CROPS) delete old.farm.seeds[id];
    old.version = SAVE_VERSION;
    const loaded = deserialize(JSON.stringify(old), NOW + 1);
    for (const id of NEW_CROPS) expect(farmOf(loaded).seeds[id]).toBe(0);
    expect(farmOf(loaded).seeds.crop_wheat).toBe(2);
  });

  it('uses exact fail-closed unlock boundaries', () => {
    const state = makeFarm();
    expect(isFarmCropUnlocked(state, 'crop_carrot')).toBe(false);
    expect(farmCropUnlockInfo(state, 'crop_carrot').requirement).toContain('County Pantry');
    farmOf(state).townContact.status = 'completed';
    expect(isFarmCropUnlocked(state, 'crop_carrot')).toBe(true);
    expect(isFarmCropUnlocked(state, 'crop_cabbage')).toBe(false);
    farmOf(state).parcels.northOwned = true;
    expect(isFarmCropUnlocked(state, 'crop_cabbage')).toBe(true);
    expect(isFarmCropUnlocked(state, 'crop_pumpkin')).toBe(false);
    farmOf(state).equipment.barnLoftExpansionOwned = true;
    expect(isFarmCropUnlocked(state, 'crop_pumpkin')).toBe(true);
    expect(isFarmCropUnlocked(state, 'crop_unknown')).toBe(false);
  });

  it('locks selection, purchase, manual planting, and tractor planning without mutation', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    expect(selectFarmCrop(state, 'crop_carrot').ok).toBe(false);
    expect(buyFarmSeeds(state, 'crop_carrot', 1).ok).toBe(false);
    farm.seeds.crop_carrot = 1;
    const before = JSON.stringify(farm);
    expect(plantFarmCrop(state, plot.uid, 'crop_carrot', NOW).ok).toBe(false);
    expect(planParcelWork(state, 'starter', NOW, 'crop_carrot').plantPlotUids).toEqual([]);
    expect(buyFarmSeeds(state, 'crop_unknown', 1).ok).toBe(false);
    expect(JSON.stringify(farm)).toBe(before.replace('"crop_carrot":0', '"crop_carrot":0'));
  });

  it('runs each new crop through buy, plant, mature, harvest, store, and sell', () => {
    for (const cropId of NEW_CROPS) {
      const state = makeUnlockedFarm(cropId); const farm = farmOf(state); const def = farmCropDef(cropId); const plot = state.plots[0];
      const before = farm.cashCents;
      expect(buyFarmSeeds(state, cropId, 1).ok).toBe(true);
      expect(plantFarmCrop(state, plot.uid, cropId, NOW).ok).toBe(true);
      plot.crop!.plantedAt = NOW - def.growMs - 1;
      expect(harvestFarmCrop(state, plot.uid, NOW).ok).toBe(true);
      expect(farm.storage[cropId]).toBe(def.harvestYield);
      expect(sellStoredCrop(state, cropId, def.harvestYield).ok).toBe(true);
      expect(farm.cashCents).toBe(before - def.seedPriceCents + def.harvestYield * def.basePriceCents);
    }
  });

  it('refuses a bulky pumpkin harvest at capacity without mutation', () => {
    const state = makeUnlockedFarm('crop_pumpkin'); const farm = farmOf(state); const def = farmCropDef('crop_pumpkin'); const plot = state.plots[0];
    farm.seeds.crop_pumpkin = 1; expect(plantFarmCrop(state, plot.uid, 'crop_pumpkin', NOW).ok).toBe(true);
    plot.crop!.plantedAt = NOW - def.growMs - 1;
    farm.storageCapacity = def.harvestYield * def.storageUnitsPerItem - 1;
    const crop = plot.crop; const cash = farm.cashCents;
    expect(harvestFarmCrop(state, plot.uid, NOW).ok).toBe(false);
    expect(plot.crop).toBe(crop); expect(farm.cashCents).toBe(cash); expect(farm.storage.crop_pumpkin).toBe(0);
  });

  it('keeps new market quotes/events deterministic and County delivery town-only', () => {
    const a = makeFarm(); const b = makeFarm();
    updateFarmMarketToDay(a, 12); updateFarmMarketToDay(b, 12);
    expect(farmOf(a).market).toEqual(farmOf(b).market);
    expect(farmOf(a).market.quotes.crop_pumpkin.currentCents).toBeGreaterThan(0);
    farmOf(a).townContact.status = 'active';
    expect(countyDeliveryMarketState(a, 'farm').showCountyOrder).toBe(false);
    expect(countyDeliveryMarketState(a, 'town').showCountyOrder).toBe(true);
  });

  it('keeps roles positive and meaningfully differentiated', () => {
    const defs = allFarmCrops();
    for (const def of defs) {
      expect(def.seedPriceCents).toBeGreaterThan(0); expect(def.basePriceCents).toBeGreaterThan(0);
      expect(def.harvestYield * def.basePriceCents).toBeGreaterThan(def.seedPriceCents);
    }
    expect(farmCropDef('crop_carrot').growMs).toBeLessThan(farmCropDef('crop_wheat').growMs);
    expect(farmCropDef('crop_tomato').harvestYield).toBeGreaterThan(farmCropDef('crop_corn').harvestYield);
    expect(farmCropDef('crop_cabbage').storageUnitsPerItem).toBeLessThan(1);
    expect(farmCropDef('crop_pumpkin').storageUnitsPerItem).toBeGreaterThan(1);
    expect(farmCropDef('crop_pumpkin').harvestYield * farmCropDef('crop_pumpkin').basePriceCents)
      .toBeGreaterThan(farmCropDef('crop_cabbage').harvestYield * farmCropDef('crop_cabbage').basePriceCents);
  });

  it('derives unlocks after save/reload without storing progression fields', () => {
    const state = makeUnlockedFarm('crop_cabbage');
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(isFarmCropUnlocked(loaded, 'crop_cabbage')).toBe(true);
    expect(JSON.stringify(loaded)).not.toContain('unlock');
  });
});
