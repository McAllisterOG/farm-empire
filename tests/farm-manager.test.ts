import { describe, expect, it } from 'vitest';
import '../src/data';
import { FIRST_FARMHAND, FIRST_FARM_MANAGER } from '../src/data/farmWorkforce.data';
import { advanceFarmDays, farmOf, syncCashMirror } from '../src/core/farmBusiness';
import { farmParcelTiles } from '../src/core/farmParcels';
import { farmCropDef } from '../src/core/registry';
import { hireFarmManager, hireFirstFarmhand, planFarmManagerDispatch, updateFarmManagerPlan } from '../src/core/farmWorkforce';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';

const NOW = Date.UTC(2026, 7, 12, 12);
function readyManager() {
  const state = createFarmGame('Manager Test', 1414, NOW); const farm = farmOf(state);
  farm.townContact.status = 'completed'; farm.parcels.northOwned = true;
  const safe = deserialize(serialize(state, NOW), NOW);
  expect(hireFirstFarmhand(safe).ok).toBe(true);
  expect(hireFarmManager(safe).ok).toBe(true);
  return safe;
}

describe('Farm Manager V1', () => {
  it('gates and charges the exact one-time contract atomically', () => {
    const state = createFarmGame('Manager Test', 1414, NOW); const farm = farmOf(state);
    expect(hireFarmManager(state).ok).toBe(false);
    farm.townContact.status = 'completed'; farm.parcels.northOwned = true;
    expect(hireFarmManager(state).ok).toBe(false);
    expect(hireFirstFarmhand(state).ok).toBe(true);
    farm.cashCents = FIRST_FARM_MANAGER.hirePriceCents - 1; syncCashMirror(state);
    const before = JSON.stringify({ farm, coins: state.player.coins });
    expect(hireFarmManager(state).ok).toBe(false); expect(JSON.stringify({ farm, coins: state.player.coins })).toBe(before);
    farm.cashCents = FIRST_FARM_MANAGER.hirePriceCents; syncCashMirror(state);
    expect(hireFarmManager(state).ok).toBe(true); expect(farm.cashCents).toBe(0);
    const hired = JSON.stringify(farm); expect(hireFarmManager(state).ok).toBe(false); expect(JSON.stringify(farm)).toBe(hired);
  });

  it('migrates v18 closed and normalizes corrupt manager state closed', () => {
    const state = readyManager() as unknown as Record<string, any>;
    state.version = 18; state.farm.workforce.manager = { hired: true, enabled: true, parcelId: 'north', cropId: 'crop_wheat', lastReviewedDay: 1 };
    const migrated = deserialize(JSON.stringify(state), NOW);
    expect(SAVE_VERSION).toBe(23); expect(farmOf(migrated).workforce.manager).toEqual({ hired: false, enabled: false, parcelId: 'starter', cropId: 'crop_corn', lastReviewedDay: 0 });
    const malformed = readyManager() as unknown as Record<string, any>;
    malformed.farm.townContact.status = 'unmet'; malformed.farm.workforce.manager = { hired: true, enabled: true, parcelId: 'bad', cropId: 'bad', lastReviewedDay: 999 };
    expect(farmOf(deserialize(JSON.stringify(malformed), NOW)).workforce.manager).toEqual({ hired: false, enabled: false, parcelId: 'starter', cropId: 'crop_corn', lastReviewedDay: 0 });
  });

  it('uses stable serpentine manager priorities without mutating state', () => {
    const state = readyManager(); const farm = farmOf(state);
    expect(updateFarmManagerPlan(state, { enabled: true, parcelId: 'starter', cropId: 'crop_corn' }).ok).toBe(true);
    const before = JSON.stringify(state); const rough = planFarmManagerDispatch(state, NOW);
    expect(rough.kind).toBe('prepare'); expect(rough.targetPlotUids).toHaveLength(36); expect(JSON.stringify(state)).toBe(before);
    const first = state.plots[0]; farm.fieldConditions[String(first.uid)] = { soil: 'stubble' };
    expect(planFarmManagerDispatch(state, NOW).kind).toBe('rework');
    first.crop = { defId: 'crop_corn', plantedAt: NOW - 100_000, wateredBonusMs: 0, lastWateredAt: NOW - 100_000, awaitingWater: false };
    expect(planFarmManagerDispatch(state, NOW).kind).toBe('harvest');
  });

  it('updates an enabled plan to north acreage and uses its saved crop in the dispatch preview', () => {
    const state = readyManager(); const farm = farmOf(state);
    for (const tile of farmParcelTiles('north')) {
      const plot = state.plots.find((p) => p.x === tile.x && p.y === tile.y)!;
      farm.fieldConditions[String(plot.uid)] = { soil: 'tilled' };
    }
    farm.seeds.crop_wheat = 1;
    expect(updateFarmManagerPlan(state, { enabled: true, parcelId: 'north', cropId: 'crop_wheat' }).ok).toBe(true);
    expect(farm.workforce.manager).toMatchObject({ enabled: true, parcelId: 'north', cropId: 'crop_wheat' });
    const preview = planFarmManagerDispatch(state, NOW);
    expect(preview).toMatchObject({ parcelId: 'north', kind: 'plant', cropId: 'crop_wheat', eligibleCount: 1 });
    expect(preview.targetPlotUids).toHaveLength(1);
  });

  it('respects seeds, storage, watering, withered crops, and pause state', () => {
    const state = readyManager(); const farm = farmOf(state);
    for (const tile of farmParcelTiles('starter')) { const plot = state.plots.find((p) => p.x === tile.x && p.y === tile.y)!; farm.fieldConditions[String(plot.uid)] = { soil: 'tilled' }; }
    farm.seeds.crop_corn = 2; expect(planFarmManagerDispatch(state, NOW).kind).toBe('plant'); expect(planFarmManagerDispatch(state, NOW).eligibleCount).toBe(2);
    farm.seeds.crop_corn = 0; expect(planFarmManagerDispatch(state, NOW).eligibleCount).toBe(0);
    const plot = state.plots[0]; plot.crop = { defId: 'crop_corn', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0, awaitingWater: true };
    expect(planFarmManagerDispatch(state, NOW).kind).toBe('water');
    const corn = farmCropDef('crop_corn');
    plot.crop = { defId: 'crop_corn', plantedAt: NOW - corn.growMs - corn.witherMs - 1, wateredBonusMs: 0, lastWateredAt: NOW, awaitingWater: false };
    expect(planFarmManagerDispatch(state, NOW).eligibleCount).toBe(0);
    expect(updateFarmManagerPlan(state, { enabled: false, parcelId: 'starter', cropId: 'crop_corn' }).ok).toBe(true);
    expect(planFarmManagerDispatch(state, NOW).reason).toMatch(/paused/);
    advanceFarmDays(state); expect(farm.workforce.manager.lastReviewedDay).toBe(0);
    expect(FIRST_FARMHAND.dailyShiftCents).toBe(12_000);
  });
});
