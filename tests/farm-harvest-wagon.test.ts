import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { farmOf, harvestFarmCrop, harvestWagonReadout, harvestWagonUsed, unloadHarvestWagonToBarn } from '../src/core/farmBusiness';
import { farmGuideSteps } from '../src/core/farmKnowledge';

const NOW = 1_700_000_000_000;

function migratedOperationalFarm() {
  const state = createFarmGame('Wagon Test', 7, NOW);
  const farm = farmOf(state);
  farm.equipment.tractor.status = 'operational';
  state.version = 21;
  return deserialize(serialize(state, NOW), NOW + 1);
}

describe('Tractor harvest wagon v22', () => {
  it('does not advertise capacity before restoration and gives the physical loop in Farmbook guidance', () => {
    const fresh = createFarmGame('Fresh', 8, NOW);
    expect(harvestWagonReadout(fresh)).toBe('Restoration required');
    expect(farmGuideSteps(fresh).find((step) => step.id === 'restore')?.hint).toContain('barn receiving bay');
    const restored = migratedOperationalFarm();
    expect(harvestWagonReadout(restored)).toBe('0 lb / 2,400 lb');
  });

  it('grandfathers only an operational v21 tractor with an empty basic wagon', () => {
    const loaded = migratedOperationalFarm();
    expect(loaded.version).toBe(26);
    expect(farmOf(loaded).equipment.harvestWagon).toEqual({ owned: true, tier: 'basic', crops: {} });
  });

  it('moves an operated whole section into the wagon, not the barn, then unloads atomically', () => {
    const state = migratedOperationalFarm(); const farm = farmOf(state); const plot = state.plots[0];
    plot.crop = { defId: 'crop_corn', plantedAt: NOW - 70_001, wateredBonusMs: 0, lastWateredAt: NOW, awaitingWater: false, harvestYieldItems: 10, harvestBalanceVersion: 2 };
    expect(harvestFarmCrop(state, plot.uid, NOW, 'operatedTractor').ok).toBe(true);
    expect(farm.storage.crop_corn).toBe(0); expect(farm.equipment.harvestWagon.crops.crop_corn).toBe(10);
    expect(unloadHarvestWagonToBarn(state).ok).toBe(true);
    expect(farm.storage.crop_corn).toBe(10); expect(harvestWagonUsed(state)).toBe(0);
  });

  it('refuses a whole mixed unload when barn capacity cannot receive it', () => {
    const state = migratedOperationalFarm(); const farm = farmOf(state);
    farm.equipment.harvestWagon.crops = { crop_corn: 10, crop_pumpkin: 8 };
    farm.storageCapacity = 1;
    const before = JSON.stringify(farm.equipment.harvestWagon.crops);
    expect(unloadHarvestWagonToBarn(state).ok).toBe(false);
    expect(JSON.stringify(farm.equipment.harvestWagon.crops)).toBe(before);
  });
});
