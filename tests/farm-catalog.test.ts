import { describe, expect, it } from 'vitest';
import '../src/data';
import { allFarmCrops, farmCropDef } from '../src/core/registry';
import {
  buyFarmSeeds, farmCropUnlockInfo, farmOf, harvestFarmCrop, isFarmCropUnlocked,
  planParcelWork, plantFarmCrop, sellStoredCrop, updateFarmMarketToDay, selectFarmCrop, tillFarmField, waterFarmCrop,
} from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { countyDeliveryMarketState } from '../src/ui/panels/farmPanels';
import { harvestFarmCropToBasket } from '../src/core/farmHarvestBasket';
import { planFarmManagerDispatch, planFarmhandWork } from '../src/core/farmWorkforce';

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
      expect(tillFarmField(state, plot.uid).ok).toBe(true);
      expect(plantFarmCrop(state, plot.uid, cropId, NOW).ok).toBe(true);
      expect(waterFarmCrop(state, plot.uid, NOW).ok).toBe(true);
      plot.crop!.plantedAt = NOW - def.growMs - 1;
      expect(harvestFarmCrop(state, plot.uid, NOW).ok).toBe(true);
      expect(farm.storage[cropId]).toBe(def.harvestYield);
      expect(sellStoredCrop(state, cropId, def.harvestYield).ok).toBe(true);
      expect(farm.cashCents).toBe(before - def.seedPriceCents + def.harvestYield * def.basePriceCents);
    }
  });

  it('refuses a bulky pumpkin harvest at capacity without mutation', () => {
    const state = makeUnlockedFarm('crop_pumpkin'); const farm = farmOf(state); const def = farmCropDef('crop_pumpkin'); const plot = state.plots[0];
    farm.seeds.crop_pumpkin = 1; expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_pumpkin', NOW).ok).toBe(true);
    expect(waterFarmCrop(state, plot.uid, NOW).ok).toBe(true);
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
    expect(allFarmCrops().map(({ id, seedPriceCents, growMs, harvestYield, storageUnitsPerItem, basePriceCents }) => ({ id, seedPriceCents, growMs, harvestYield, storageUnitsPerItem, basePriceCents }))).toEqual([
      { id: 'crop_corn', seedPriceCents: 1_400, growMs: 70_000, harvestYield: 10, storageUnitsPerItem: 1, basePriceCents: 410 },
      { id: 'crop_wheat', seedPriceCents: 1_000, growMs: 55_000, harvestYield: 8, storageUnitsPerItem: 1, basePriceCents: 340 },
      { id: 'crop_soybean', seedPriceCents: 1_700, growMs: 85_000, harvestYield: 9, storageUnitsPerItem: 1, basePriceCents: 500 },
      { id: 'crop_potato', seedPriceCents: 1_900, growMs: 75_000, harvestYield: 11, storageUnitsPerItem: 1, basePriceCents: 400 },
      { id: 'crop_carrot', seedPriceCents: 900, growMs: 40_000, harvestYield: 8, storageUnitsPerItem: 1, basePriceCents: 380 },
      { id: 'crop_tomato', seedPriceCents: 2_400, growMs: 100_000, harvestYield: 16, storageUnitsPerItem: 1, basePriceCents: 470 },
      { id: 'crop_cabbage', seedPriceCents: 2_600, growMs: 140_000, harvestYield: 10, storageUnitsPerItem: 1, basePriceCents: 720 },
      { id: 'crop_pumpkin', seedPriceCents: 3_200, growMs: 180_000, harvestYield: 8, storageUnitsPerItem: 3, basePriceCents: 1_350 },
    ]);
    const defs = allFarmCrops();
    for (const def of defs) {
      expect(def.seedPriceCents).toBeGreaterThan(0); expect(def.basePriceCents).toBeGreaterThan(0);
      expect(Number.isInteger(def.storageUnitsPerItem)).toBe(true);
      expect(def.storageUnitsPerItem).toBeGreaterThan(0);
      expect(def.harvestYield * def.basePriceCents).toBeGreaterThan(def.seedPriceCents);
    }
    const carrot = farmCropDef('crop_carrot'); const wheat = farmCropDef('crop_wheat');
    expect(carrot.growMs).toBeLessThan(wheat.growMs);
    expect(carrot.seedPriceCents).toBeLessThan(wheat.seedPriceCents);
    expect(carrot.harvestYield * carrot.basePriceCents - carrot.seedPriceCents)
      .toBeGreaterThan(wheat.harvestYield * wheat.basePriceCents - wheat.seedPriceCents);
    expect(farmCropDef('crop_tomato').harvestYield).toBeGreaterThan(farmCropDef('crop_corn').harvestYield);
    const cabbage = farmCropDef('crop_cabbage'); const tomato = farmCropDef('crop_tomato');
    const cabbageValuePerBarnUnit = cabbage.harvestYield * cabbage.basePriceCents / (cabbage.harvestYield * cabbage.storageUnitsPerItem);
    const tomatoValuePerBarnUnit = tomato.harvestYield * tomato.basePriceCents / (tomato.harvestYield * tomato.storageUnitsPerItem);
    expect(cabbageValuePerBarnUnit).toBeGreaterThan(tomatoValuePerBarnUnit);
    expect(farmCropDef('crop_pumpkin').storageUnitsPerItem).toBeGreaterThan(1);
    expect(farmCropDef('crop_pumpkin').harvestYield * farmCropDef('crop_pumpkin').basePriceCents)
      .toBeGreaterThan(farmCropDef('crop_cabbage').harvestYield * farmCropDef('crop_cabbage').basePriceCents);
  });

  it('migrates v20 growing crops with V1 harvest snapshots and resets market quotes/events', () => {
    const state = makeFarm(); const farm = farmOf(state);
    const corn = state.plots[0]; const pumpkin = state.plots[1];
    farm.seeds.crop_pumpkin = 1; farm.storage.crop_wheat = 5; farm.pickup.cargo.crops.crop_potato = 3; farm.handBasket.crops.crop_carrot = 2;
    expect(tillFarmField(state, corn.uid).ok).toBe(true); expect(plantFarmCrop(state, corn.uid, 'crop_corn', NOW).ok).toBe(true);
    farm.parcels.northOwned = true; farm.equipment.barnLoftExpansionOwned = true;
    expect(tillFarmField(state, pumpkin.uid).ok).toBe(true); expect(plantFarmCrop(state, pumpkin.uid, 'crop_pumpkin', NOW).ok).toBe(true);
    const raw = JSON.parse(serialize(state, NOW)) as Record<string, any>;
    raw.version = 20; delete raw.plots[0].crop.harvestYieldItems; delete raw.plots[1].crop.harvestYieldItems;
    raw.farm.market.quotes.crop_corn = { currentCents: 999, previousCents: 777 };
    raw.farm.market.activeEvents = [{ id: 'strong-corn-demand', remainingDays: 2 }];
    const loaded = deserialize(JSON.stringify(raw), NOW + 1);
    expect(loaded.version).toBe(26);
    expect(loaded.plots[0].crop).toMatchObject({ harvestYieldItems: 8, harvestBalanceVersion: 1 }); expect(loaded.plots[1].crop).toMatchObject({ harvestYieldItems: 8, harvestBalanceVersion: 1 });
    expect(farmOf(loaded).storage.crop_wheat).toBe(5); expect(farmOf(loaded).pickup.cargo.crops.crop_potato).toBe(3); expect(farmOf(loaded).handBasket.crops.crop_carrot).toBe(2);
    expect(farmOf(loaded).market.quotes.crop_corn).toEqual({ currentCents: 410, previousCents: 410 });
    expect(farmOf(loaded).market.activeEvents).toEqual([]);
    expect(waterFarmCrop(loaded, loaded.plots[0].uid, NOW + 1).ok).toBe(true);
    expect(harvestFarmCrop(loaded, loaded.plots[0].uid, NOW + farmCropDef('crop_corn').growMs + 2).ok).toBe(true);
    expect(farmOf(loaded).storage.crop_corn).toBe(8);
    const repeated = deserialize(serialize(loaded, NOW + 3), NOW + 4);
    expect(farmOf(repeated).storage).toEqual(farmOf(loaded).storage);
    const current = makeFarm(); const currentPlot = current.plots[0];
    expect(tillFarmField(current, currentPlot.uid).ok).toBe(true); expect(plantFarmCrop(current, currentPlot.uid, 'crop_corn', NOW).ok).toBe(true);
    delete currentPlot.crop!.harvestYieldItems;
    expect(waterFarmCrop(current, currentPlot.uid, NOW + 1).ok).toBe(true);
    expect(harvestFarmCrop(current, currentPlot.uid, NOW + farmCropDef('crop_corn').growMs + 2).ok).toBe(true);
    expect(farmOf(current).storage.crop_corn).toBe(10);
  });

  it('normalizes forged v21 harvest snapshots before every shared harvest/capacity authority', () => {
    const state = makeFarm(); const farm = farmOf(state);
    farm.seeds.crop_corn = 4; farm.storage.crop_wheat = 449;
    farm.townContact.status = 'completed'; farm.parcels.northOwned = true;
    farm.workforce.farmhandHired = true;
    farm.workforce.manager = { hired: true, enabled: true, parcelId: 'starter', cropId: 'crop_corn', lastReviewedDay: 0 };
    farm.equipment.tractor.status = 'operational'; farm.equipment.countyRowCropFieldKitOwned = true;
    for (const plot of state.plots.slice(0, 4)) {
      expect(tillFarmField(state, plot.uid).ok).toBe(true); expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW).ok).toBe(true);
      expect(waterFarmCrop(state, plot.uid, NOW + 1).ok).toBe(true); plot.crop!.plantedAt = NOW - farmCropDef('crop_corn').growMs - 1;
    }
    const raw = JSON.parse(serialize(state, NOW)) as Record<string, any>;
    raw.plots[0].crop.harvestYieldItems = 999_999;
    raw.plots[1].crop.harvestYieldItems = 9;
    raw.plots[2].crop.harvestYieldItems = '10';
    raw.plots[3].crop.harvestYieldItems = -1;
    raw.plots[0].crop.harvestBalanceVersion = 1;
    raw.plots[1].crop.harvestBalanceVersion = 3;
    delete raw.plots[2].crop.harvestBalanceVersion;
    raw.plots[3].crop.harvestBalanceVersion = 1;
    const loaded = deserialize(JSON.stringify(raw), NOW + 2); const loadedFarm = farmOf(loaded);
    expect(loaded.plots.slice(0, 4).map((plot) => plot.crop?.harvestYieldItems)).toEqual([10, 10, 10, 10]);
    expect(loaded.plots.slice(0, 4).map((plot) => plot.crop?.harvestBalanceVersion)).toEqual([2, 2, 2, 2]);
    expect(planFarmhandWork(loaded, 'starter', 'harvest', NOW + 2).targetPlotUids).toHaveLength(3);
    expect(planFarmManagerDispatch(loaded, NOW + 2)).toMatchObject({ kind: 'harvest', eligibleCount: 3 });
    expect(harvestFarmCrop(loaded, loaded.plots[0].uid, NOW + 2, 'manual').ok).toBe(true);
    expect(harvestFarmCropToBasket(loaded, loaded.plots[1].uid, NOW + 2).ok).toBe(true);
    expect(harvestFarmCrop(loaded, loaded.plots[2].uid, NOW + 2, 'operatedTractor').ok).toBe(true);
    expect(loadedFarm.storage.crop_corn).toBe(21);
    expect(loadedFarm.equipment.harvestWagon.crops.crop_corn).toBeUndefined();
    expect(loadedFarm.handBasket.crops.crop_corn).toBe(10);
  });

  it('preserves provenance-backed v1 tomatoes through v21 reloads and every harvest authority', () => {
    const state = makeFarm(); const farm = farmOf(state);
    farm.townContact.status = 'completed'; farm.parcels.northOwned = true; farm.seeds.crop_tomato = 4;
    farm.workforce.farmhandHired = true;
    farm.workforce.manager = { hired: true, enabled: true, parcelId: 'starter', cropId: 'crop_tomato', lastReviewedDay: 0 };
    farm.equipment.tractor.status = 'operational'; farm.equipment.countyRowCropFieldKitOwned = true;
    for (const plot of state.plots.slice(0, 4)) {
      expect(tillFarmField(state, plot.uid).ok).toBe(true); expect(plantFarmCrop(state, plot.uid, 'crop_tomato', NOW).ok).toBe(true);
      expect(waterFarmCrop(state, plot.uid, NOW + 1).ok).toBe(true); plot.crop!.plantedAt = NOW - farmCropDef('crop_tomato').growMs - 1;
    }
    const raw = JSON.parse(serialize(state, NOW)) as Record<string, any>;
    raw.version = 20;
    const migrated = deserialize(JSON.stringify(raw), NOW + 2);
    const reloaded = deserialize(serialize(migrated, NOW + 3), NOW + 4); const reloadedFarm = farmOf(reloaded);
    expect(reloaded.plots.slice(0, 4).map((plot) => plot.crop && ({ yield: plot.crop.harvestYieldItems, version: plot.crop.harvestBalanceVersion }))).toEqual([
      { yield: 18, version: 1 }, { yield: 18, version: 1 }, { yield: 18, version: 1 }, { yield: 18, version: 1 },
    ]);
    reloadedFarm.storage.crop_wheat = 426;
    expect(planFarmhandWork(reloaded, 'starter', 'harvest', NOW + 4).targetPlotUids).toHaveLength(3);
    expect(planFarmManagerDispatch(reloaded, NOW + 4)).toMatchObject({ kind: 'harvest', eligibleCount: 3 });
    expect(harvestFarmCrop(reloaded, reloaded.plots[0].uid, NOW + 4, 'manual').ok).toBe(true);
    expect(harvestFarmCropToBasket(reloaded, reloaded.plots[1].uid, NOW + 4).ok).toBe(true);
    expect(harvestFarmCrop(reloaded, reloaded.plots[2].uid, NOW + 4, 'operatedTractor').ok).toBe(true);
    expect(reloadedFarm.storage.crop_tomato).toBe(18);
    expect(reloadedFarm.equipment.harvestWagon.crops.crop_tomato).toBe(19);
    expect(reloadedFarm.handBasket.crops.crop_tomato).toBe(18);
  });

  it('rejects forged v21 tomato v1 yields without matching legacy provenance', () => {
    const state = makeUnlockedFarm('crop_tomato'); const farm = farmOf(state); farm.seeds.crop_tomato = 3;
    for (const plot of state.plots.slice(0, 3)) {
      expect(tillFarmField(state, plot.uid).ok).toBe(true); expect(plantFarmCrop(state, plot.uid, 'crop_tomato', NOW).ok).toBe(true);
    }
    const raw = JSON.parse(serialize(state, NOW)) as Record<string, any>;
    raw.plots[0].crop.harvestYieldItems = 18; raw.plots[0].crop.harvestBalanceVersion = 2;
    raw.plots[1].crop.harvestYieldItems = 18; delete raw.plots[1].crop.harvestBalanceVersion;
    raw.plots[2].crop.harvestYieldItems = 18; raw.plots[2].crop.harvestBalanceVersion = 9;
    const loaded = deserialize(JSON.stringify(raw), NOW + 1);
    expect(loaded.plots.slice(0, 3).map((plot) => plot.crop && ({ yield: plot.crop.harvestYieldItems, version: plot.crop.harvestBalanceVersion }))).toEqual([
      { yield: 16, version: 2 }, { yield: 16, version: 2 }, { yield: 16, version: 2 },
    ]);
  });

  it('derives unlocks after save/reload without storing progression fields', () => {
    const state = makeUnlockedFarm('crop_cabbage');
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(isFarmCropUnlocked(loaded, 'crop_cabbage')).toBe(true);
    expect(JSON.stringify(loaded)).not.toContain('unlock');
  });
});
