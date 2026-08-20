import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { farmCropDef } from '../src/core/registry';
import { clearWitheredFarmCrop, farmCropStage, farmOf, harvestFarmCrop, plantFarmCrop, tillFarmField, waterFarmCrop } from '../src/core/farmBusiness';
import { harvestFarmCropToBasket } from '../src/core/farmHarvestBasket';
import { applyCurrentFarmRain, farmWeatherForDay } from '../src/core/farmWeather';
import { deserialize, serialize } from '../src/save/save';
import { canonicalEstablishmentBonusMs, canonicalRotationBonusMs, farmCropCareSummary, farmGrowthReadyAt, INVALID_FARM_READY_AT, rotationPreview } from '../src/core/farmRotation';

const NOW = 1_700_000_000_000;
const farm = () => createFarmGame('Rotation Test', 7_771, NOW);

function plant(state: ReturnType<typeof farm>, cropId: string, uid = state.plots[0].uid, context: 'manual' | 'operatedTractor' = 'manual') {
  const plot = state.plots.find((candidate) => candidate.uid === uid)!;
  farmOf(state).seeds[cropId] = 2;
  if (context === 'manual') expect(tillFarmField(state, uid).ok).toBe(true);
  expect(plantFarmCrop(state, uid, cropId, NOW, context).ok).toBe(true);
  return plot;
}

describe('Crop Rotation & Field Notes V1', () => {
  it('defines every crop family and grants only different-family transitions', () => {
    const families = { grain: ['crop_corn', 'crop_wheat'], legume: ['crop_soybean'], root: ['crop_potato', 'crop_carrot'], garden: ['crop_tomato', 'crop_cabbage', 'crop_pumpkin'] } as const;
    for (const [family, ids] of Object.entries(families)) for (const id of ids) expect(farmCropDef(id).family).toBe(family);
    const state = farm(); const plot = state.plots[0];
    expect(rotationPreview(plot, 'crop_corn').bonusMs).toBe(0);
    for (const prior of Object.keys(families) as Array<keyof typeof families>) for (const next of Object.keys(families) as Array<keyof typeof families>) {
      plot.lastHarvestFamily = prior;
      const cropId = families[next][0];
      expect(rotationPreview(plot, cropId).bonusMs).toBe(prior === next ? 0 : canonicalRotationBonusMs(farmCropDef(cropId).growMs));
    }
  });

  it('pins exact additive timing, with manual or rain establishment idempotently retaining rotation', () => {
    const state = farm(); const plot = state.plots[0]; plot.lastHarvestFamily = 'grain';
    const crop = plant(state, 'crop_soybean'); const def = farmCropDef('crop_soybean');
    expect(crop.crop).toMatchObject({ awaitingWater: true, wateredBonusMs: 0, rotationBonusMs: canonicalRotationBonusMs(def.growMs) });
    expect(waterFarmCrop(state, crop.uid, NOW + 5).ok).toBe(true);
    expect(waterFarmCrop(state, crop.uid, NOW + 6).ok).toBe(false);
    expect(farmCropStage(crop.crop, NOW + 5 + def.growMs - canonicalRotationBonusMs(def.growMs) - 1)).toBe('growing');
    expect(farmCropStage(crop.crop, NOW + 5 + def.growMs - canonicalRotationBonusMs(def.growMs))).toBe('ready');
    expect(farmCropCareSummary(crop.crop!).totalReductionMs).toBe(canonicalRotationBonusMs(def.growMs));

    const rainySeed = Array.from({ length: 50_000 }, (_, seed) => seed).find((seed) => farmWeatherForDay(seed, 1).kind === 'rain')!;
    const rainState = createFarmGame('Rain rotation', rainySeed, NOW); const rainPlot = rainState.plots[0]; rainPlot.lastHarvestFamily = 'grain';
    plant(rainState, 'crop_soybean');
    expect(applyCurrentFarmRain(rainState, NOW + 8).wateredPlotUids).toEqual([rainPlot.uid]);
    const once = JSON.stringify(rainState); expect(applyCurrentFarmRain(rainState, NOW + 9).wateredPlotUids).toEqual([]); expect(JSON.stringify(rainState)).toBe(once);
  });

  it('keeps the full 30% natural cap for tractor establishment plus rotation', () => {
    const state = farm(); const plot = state.plots[0]; plot.lastHarvestFamily = 'grain';
    farmOf(state).equipment.tractor.status = 'operational'; farmOf(state).equipment.countyRowCropFieldKitOwned = true;
    const crop = plant(state, 'crop_soybean', plot.uid, 'operatedTractor'); const def = farmCropDef('crop_soybean');
    expect(crop.crop).toMatchObject({ awaitingWater: false, wateredBonusMs: Math.round(def.growMs * .2), rotationBonusMs: Math.round(def.growMs * .1) });
    expect(farmCropStage(crop.crop, NOW + Math.round(def.growMs * .7) - 1)).toBe('growing');
    expect(farmCropStage(crop.crop, NOW + Math.round(def.growMs * .7))).toBe('ready');
  });

  it('records family identically for direct, basket, and tractor harvests; clearing/wither does not rewrite it', () => {
    const state = farm(); const [direct, basket, tractor, withered] = state.plots;
    for (const plot of [direct, basket, tractor, withered]) plot.crop = { defId: 'crop_soybean', plantedAt: NOW - 100_000, wateredBonusMs: 0, lastWateredAt: NOW, awaitingWater: false, harvestYieldItems: 9, harvestBalanceVersion: 2, rotationBonusMs: 0 };
    expect(harvestFarmCrop(state, direct.uid, NOW).ok).toBe(true); expect(direct.lastHarvestFamily).toBe('legume');
    expect(harvestFarmCropToBasket(state, basket.uid, NOW).ok).toBe(true); expect(basket.lastHarvestFamily).toBe('legume');
    farmOf(state).equipment.tractor.status = 'operational'; farmOf(state).equipment.harvestWagon.owned = true;
    expect(harvestFarmCrop(state, tractor.uid, NOW, 'operatedTractor').ok).toBe(true); expect(tractor.lastHarvestFamily).toBe('legume');
    withered.lastHarvestFamily = 'grain'; expect(farmCropStage(withered.crop, NOW + farmCropDef('crop_soybean').witherMs + 100_000)).toBe('withered');
    const witheredAt = NOW + farmCropDef('crop_soybean').witherMs + 100_000;
    expect(harvestFarmCrop(state, withered.uid, witheredAt).ok).toBe(false); expect(withered.lastHarvestFamily).toBe('grain');
    expect(clearWitheredFarmCrop(state, withered.uid, witheredAt).ok).toBe(true); expect(withered.lastHarvestFamily).toBe('grain');
  });

  it('migrates v25 without grants and rejects malformed v26 rotation state without touching balance or cargo', () => {
    const state = farm(); const plot = state.plots[0]; plot.lastHarvestFamily = 'grain';
    plot.crop = { defId: 'crop_soybean', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0, awaitingWater: true, harvestYieldItems: 9, harvestBalanceVersion: 2, rotationBonusMs: canonicalRotationBonusMs(farmCropDef('crop_soybean').growMs) };
    const v25 = JSON.parse(serialize(state, NOW)) as any; v25.version = 25;
    const migrated = deserialize(JSON.stringify(v25), NOW + 1); expect(SAVE_VERSION).toBe(26); expect(migrated.plots[0].lastHarvestFamily).toBeUndefined(); expect(migrated.plots[0].crop?.rotationBonusMs).toBe(0);
    const bad = JSON.parse(serialize(state, NOW)) as any; bad.plots[0].lastHarvestFamily = 'forged'; bad.plots[0].crop.rotationBonusMs = 99_999; bad.farm.pickup.cargo.crops.crop_corn = 3;
    const loaded = deserialize(JSON.stringify(bad), NOW + 2); expect(loaded.plots[0].lastHarvestFamily).toBeUndefined(); expect(loaded.plots[0].crop?.rotationBonusMs).toBe(0); expect(farmOf(loaded).pickup.cargo.crops.crop_corn).toBe(3);
  });

  it('fails malformed establishment timing closed while preserving canonical v25/v26 timing and yield provenance', () => {
    const def = farmCropDef('crop_corn');
    const makeRaw = (wateredBonusMs: unknown, version = 26, plantedAt: unknown = NOW) => {
      const state = farm(); const plot = state.plots[0];
      plot.crop = { defId: def.id, plantedAt: plantedAt as number, wateredBonusMs: wateredBonusMs as number, lastWateredAt: NOW, awaitingWater: false, harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2, rotationBonusMs: 0 };
      const raw = JSON.parse(serialize(state, NOW)) as any; raw.version = version; return raw;
    };
    for (const malformed of ['70000', null, -1, def.growMs * 99]) {
      const loaded = deserialize(JSON.stringify(makeRaw(malformed)), NOW);
      const crop = loaded.plots[0].crop!;
      expect(crop.wateredBonusMs).toBe(0);
      expect(farmGrowthReadyAt(crop)).toBe(NOW + def.growMs);
      expect(farmCropStage(crop, NOW + def.growMs - 1)).toBe('growing');
      expect(farmCropStage(crop, NOW + def.growMs)).toBe('ready');
    }
    const canonical = Math.round(def.growMs * .2);
    const v25 = deserialize(JSON.stringify(makeRaw(canonical, 25)), NOW);
    const v26 = deserialize(JSON.stringify(makeRaw(canonical)), NOW);
    for (const state of [v25, v26]) {
      const crop = state.plots[0].crop!;
      expect(canonicalEstablishmentBonusMs(crop)).toBe(canonical);
      expect(farmGrowthReadyAt(crop)).toBe(NOW + def.growMs - canonical);
      expect(crop).toMatchObject({ harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2 });
    }
  });

  it('treats malformed planted timestamps as permanently unready without changing valid v25/v26 crop timing', () => {
    const def = farmCropDef('crop_corn');
    const rawWith = (plantedAt: unknown, version = 26) => {
      const state = farm();
      state.plots[0].crop = { defId: def.id, plantedAt: plantedAt as number, wateredBonusMs: 0, lastWateredAt: NOW, awaitingWater: false, harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2, rotationBonusMs: 0 };
      const raw = JSON.parse(serialize(state, NOW)) as any; raw.version = version; return raw;
    };
    for (const invalid of ['1700000000000', null, -1, Number.MAX_VALUE]) {
      const crop = deserialize(JSON.stringify(rawWith(invalid)), NOW).plots[0].crop!;
      expect(farmGrowthReadyAt(crop)).toBe(INVALID_FARM_READY_AT);
      expect(farmCropStage(crop, NOW + def.growMs + def.witherMs + 1)).toBe('growing');
      expect(farmCropStage(crop, INVALID_FARM_READY_AT)).toBe('growing');
    }
    for (const version of [25, 26]) {
      const crop = deserialize(JSON.stringify(rawWith(NOW, version)), NOW).plots[0].crop!;
      expect(farmGrowthReadyAt(crop)).toBe(NOW + def.growMs);
      expect(farmCropStage(crop, NOW + def.growMs - 1)).toBe('growing');
      expect(crop).toMatchObject({ plantedAt: NOW, harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2 });
    }
  });
});
