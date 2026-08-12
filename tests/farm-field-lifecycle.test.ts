import { describe, expect, it } from 'vitest';
import '../src/data';
import {
  clearWitheredFarmCrop, farmCropStage, farmFieldCondition, farmOf, harvestFarmCrop,
  plantFarmCrop, tillFarmField, waterFarmCrop,
} from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';

const NOW = 1_784_394_000_000;

function makeFarm() { return createFarmGame('Field Lifecycle', 144, NOW); }

describe('manual field lifecycle', () => {
  it('requires preparation and establishment water before growth begins', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    const plot = state.plots[0];
    farm.seeds.crop_wheat = 1;

    expect(farmFieldCondition(state, plot.uid).soil).toBe('rough');
    const before = JSON.stringify({ seed: farm.seeds.crop_wheat, plot, condition: farm.fieldConditions[String(plot.uid)] });
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', NOW, 'manual').ok).toBe(false);
    expect(JSON.stringify({ seed: farm.seeds.crop_wheat, plot, condition: farm.fieldConditions[String(plot.uid)] })).toBe(before);

    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(farmFieldCondition(state, plot.uid).soil).toBe('tilled');
    expect(tillFarmField(state, plot.uid).ok).toBe(false);
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', NOW, 'manual').ok).toBe(true);
    expect(farmCropStage(plot.crop, NOW + farmCropDef('crop_wheat').growMs * 2)).toBe('needs-water');
    expect(plot.crop?.lastWateredAt).toBe(0);

    const wateredAt = NOW + 30_000;
    expect(waterFarmCrop(state, plot.uid, wateredAt).ok).toBe(true);
    expect(plot.crop?.plantedAt).toBe(wateredAt);
    expect(plot.crop?.lastWateredAt).toBe(wateredAt);
    expect(farmCropStage(plot.crop, wateredAt)).toBe('growing');
    const wateredSnapshot = JSON.stringify(plot.crop);
    expect(waterFarmCrop(state, plot.uid, wateredAt + 1).ok).toBe(false);
    expect(JSON.stringify(plot.crop)).toBe(wateredSnapshot);
    expect(state.stats.farmSectionsTilled).toBe(1);
    expect(state.stats.farmSectionsWatered).toBe(1);
  });

  it('leaves harvest stubble and requires reworking before the next manual crop', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    farm.seeds.crop_wheat = 2;
    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', NOW, 'manual').ok).toBe(true);
    expect(waterFarmCrop(state, plot.uid, NOW).ok).toBe(true);
    const readyAt = NOW + farmCropDef('crop_wheat').growMs;
    expect(farmCropStage(plot.crop, readyAt)).toBe('ready');
    expect(harvestFarmCrop(state, plot.uid, readyAt, 'manual').ok).toBe(true);
    expect(farm.storage.crop_wheat).toBe(farmCropDef('crop_wheat').harvestYield);
    expect(farmFieldCondition(state, plot.uid).soil).toBe('stubble');
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', readyAt, 'manual').ok).toBe(false);
    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_wheat', readyAt, 'manual').ok).toBe(true);
  });

  it('keeps current tractor planting as an integrated prepare-and-establish pass', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    farm.equipment.tractor.status = 'operational';
    farm.seeds.crop_corn = 1;
    expect(farmFieldCondition(state, plot.uid).soil).toBe('rough');
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'operatedTractor').ok).toBe(true);
    expect(farmFieldCondition(state, plot.uid).soil).toBe('tilled');
    expect(plot.crop?.awaitingWater).toBe(false);
    expect(farmCropStage(plot.crop, NOW)).toBe('growing');
  });

  it('turns cleared withered crops into stubble without changing farm assets', () => {
    const state = makeFarm(); const farm = farmOf(state); const plot = state.plots[0];
    plot.crop = {
      defId: 'crop_wheat',
      plantedAt: NOW - farmCropDef('crop_wheat').growMs - farmCropDef('crop_wheat').witherMs,
      wateredBonusMs: 0,
      lastWateredAt: NOW - 1,
    };
    const assets = JSON.stringify({ cash: farm.cashCents, seeds: farm.seeds, storage: farm.storage });
    expect(clearWitheredFarmCrop(state, plot.uid, NOW).ok).toBe(true);
    expect(farmFieldCondition(state, plot.uid).soil).toBe('stubble');
    expect(JSON.stringify({ cash: farm.cashCents, seeds: farm.seeds, storage: farm.storage })).toBe(assets);
  });
});

describe('field lifecycle save compatibility', () => {
  it('migrates v9 crops as established and reconstructs safe soil conditions', () => {
    const old = makeFarm() as unknown as Record<string, any>;
    old.version = 9;
    delete old.farm.fieldConditions;
    old.plots[0].crop = { defId: 'crop_corn', plantedAt: NOW - 1_000, wateredBonusMs: 0, lastWateredAt: 0 };
    const loaded = deserialize(JSON.stringify(old), NOW + 2_000);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(farmFieldCondition(loaded, loaded.plots[0].uid).soil).toBe('tilled');
    expect(farmCropStage(loaded.plots[0].crop, NOW + 2_000)).toBe('growing');
    expect(farmFieldCondition(loaded, loaded.plots[1].uid).soil).toBe('rough');
  });

  it('fails malformed awaiting-water data open to established growth', () => {
    const state = makeFarm() as unknown as Record<string, any>;
    state.plots[0].crop = { defId: 'crop_wheat', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0, awaitingWater: 'yes' };
    const loaded = deserialize(JSON.stringify(state), NOW + 1);
    expect(farmCropStage(loaded.plots[0].crop, NOW + 1)).toBe('growing');
    expect(waterFarmCrop(loaded, loaded.plots[0].uid, NOW + 2).ok).toBe(false);
  });

  it('round-trips tilled, stubble, and awaiting-water fields exactly', () => {
    const state = makeFarm(); const farm = farmOf(state);
    expect(tillFarmField(state, state.plots[0].uid).ok).toBe(true);
    farm.fieldConditions[String(state.plots[1].uid)] = { soil: 'stubble' };
    farm.seeds.crop_wheat = 1;
    expect(plantFarmCrop(state, state.plots[0].uid, 'crop_wheat', NOW, 'manual').ok).toBe(true);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(farmOf(loaded).fieldConditions).toEqual(farm.fieldConditions);
    expect(loaded.plots[0].crop?.awaitingWater).toBe(true);
    expect(farmCropStage(loaded.plots[0].crop, NOW + farmCropDef('crop_wheat').growMs * 2)).toBe('needs-water');
  });
});
