import { describe, expect, it } from 'vitest';
import '../src/data';
import { FIRST_FARMHAND } from '../src/data/farmWorkforce.data';
import { advanceFarmDays, farmFieldCondition, farmOf, syncCashMirror } from '../src/core/farmBusiness';
import { farmParcelTiles } from '../src/core/farmParcels';
import {
  farmhandUnlocked, hireFirstFarmhand, planFarmhandWork, startFarmhandShift,
} from '../src/core/farmWorkforce';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';

const NOW = Date.UTC(2026, 7, 12, 12);

function unlockedFarm() {
  const state = createFarmGame('Workforce Test', 1_414, NOW);
  const farm = farmOf(state);
  farm.townContact.status = 'completed';
  farm.parcels.northOwned = true;
  // Normalization is the same idempotent path used after the real land purchase.
  return deserialize(serialize(state, NOW + 1), NOW + 2);
}

function hiredFarm() {
  const state = unlockedFarm();
  expect(hireFirstFarmhand(state).ok).toBe(true);
  return state;
}

describe('First Farmhand workforce', () => {
  it('requires both County trust and neighboring acreage, then hires once at the exact price', () => {
    const state = createFarmGame('Workforce Test', 1_414, NOW);
    const farm = farmOf(state);
    expect(SAVE_VERSION).toBe(17);
    expect(farmhandUnlocked(state)).toBe(false);
    expect(hireFirstFarmhand(state).ok).toBe(false);
    farm.townContact.status = 'completed';
    expect(farmhandUnlocked(state)).toBe(false);
    farm.parcels.northOwned = true;
    expect(farmhandUnlocked(state)).toBe(true);
    const cash = farm.cashCents;
    expect(hireFirstFarmhand(state).ok).toBe(true);
    expect(farm.cashCents).toBe(cash - FIRST_FARMHAND.hirePriceCents);
    expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    expect(farm.workforce.farmhandHired).toBe(true);
    const hired = JSON.stringify(farm);
    expect(hireFirstFarmhand(state).ok).toBe(false);
    expect(JSON.stringify(farm)).toBe(hired);
  });

  it('does not mutate the farm when hiring cash is short', () => {
    const state = unlockedFarm(); const farm = farmOf(state);
    farm.cashCents = FIRST_FARMHAND.hirePriceCents - 1; syncCashMirror(state);
    const before = JSON.stringify(farm);
    expect(hireFirstFarmhand(state).ok).toBe(false);
    expect(JSON.stringify(farm)).toBe(before);
  });

  it('plans every eligible acreage section in deterministic serpentine order', () => {
    const state = hiredFarm();
    const coordinateUid = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot.uid]));
    const expected = farmParcelTiles('starter').reduce<{ x: number; y: number }[][]>((rows, tile) => {
      const row = rows[tile.y - 7] ?? [];
      row.push(tile); rows[tile.y - 7] = row; return rows;
    }, []).flatMap((row, index) => [...row].sort((a, b) => index % 2 === 0 ? a.x - b.x : b.x - a.x))
      .map((tile) => coordinateUid.get(`${tile.x}:${tile.y}`));
    const first = planFarmhandWork(state, 'starter', 'prepare', NOW);
    state.plots.reverse();
    const second = planFarmhandWork(state, 'starter', 'prepare', NOW);
    expect(first.targetPlotUids).toEqual(expected);
    expect(second.targetPlotUids).toEqual(first.targetPlotUids);
    expect(first.targetPlotUids).toHaveLength(36);
  });

  it('limits planting to real seeds and harvest to real barn capacity', () => {
    const state = hiredFarm(); const farm = farmOf(state);
    const starter = farmParcelTiles('starter');
    for (const tile of starter) {
      const plot = state.plots.find((candidate) => candidate.x === tile.x && candidate.y === tile.y)!;
      farm.fieldConditions[String(plot.uid)] = { soil: 'tilled' };
    }
    farm.seeds.crop_corn = 3;
    expect(planFarmhandWork(state, 'starter', 'plant', NOW, 'crop_corn').targetPlotUids).toHaveLength(3);

    for (const tile of starter.slice(0, 4)) {
      const plot = state.plots.find((candidate) => candidate.x === tile.x && candidate.y === tile.y)!;
      plot.crop = { defId: 'crop_corn', plantedAt: NOW - 80_000, wateredBonusMs: 0, lastWateredAt: NOW - 80_000, awaitingWater: false };
    }
    farm.storage.crop_corn = farm.storageCapacity - 17;
    expect(planFarmhandWork(state, 'starter', 'harvest', NOW).targetPlotUids).toHaveLength(2);
  });

  it('respects bulky crop storage units when reserving harvest capacity', () => {
    const state = hiredFarm(); const farm = farmOf(state); const plot = state.plots[0];
    plot.crop = { defId: 'crop_pumpkin', plantedAt: NOW - 200_000, wateredBonusMs: 0, lastWateredAt: NOW - 200_000, awaitingWater: false };
    farm.storage.crop_corn = farm.storageCapacity - 23;
    expect(planFarmhandWork(state, 'starter', 'harvest', NOW).targetPlotUids).toHaveLength(0);
    farm.storage.crop_corn -= 1;
    expect(planFarmhandWork(state, 'starter', 'harvest', NOW).targetPlotUids).toEqual([plot.uid]);
  });

  it('charges one daily wage only when a real assignment starts and charges again next day', () => {
    const state = hiredFarm(); const farm = farmOf(state);
    const cash = farm.cashCents;
    const empty = startFarmhandShift(state, 'starter', 'plant', NOW, 'crop_corn');
    expect(empty.result.ok).toBe(false);
    expect(empty.wageChargedCents).toBe(0);
    expect(farm.cashCents).toBe(cash);

    const prepare = startFarmhandShift(state, 'starter', 'prepare', NOW);
    expect(prepare.result.ok).toBe(true);
    expect(prepare.wageChargedCents).toBe(FIRST_FARMHAND.dailyShiftCents);
    expect(farm.cashCents).toBe(cash - FIRST_FARMHAND.dailyShiftCents);
    expect(farm.workforce.lastShiftPaidDay).toBe(1);
    const second = startFarmhandShift(state, 'north', 'prepare', NOW);
    expect(second.result.ok).toBe(true);
    expect(second.wageChargedCents).toBe(0);
    expect(farm.cashCents).toBe(cash - FIRST_FARMHAND.dailyShiftCents);

    advanceFarmDays(state);
    const nextDay = startFarmhandShift(state, 'starter', 'prepare', NOW);
    expect(nextDay.result.ok).toBe(true);
    expect(nextDay.wageChargedCents).toBe(FIRST_FARMHAND.dailyShiftCents);
    expect(farm.workforce.lastShiftPaidDay).toBe(2);
  });

  it('leaves all workforce and cash state unchanged when the shift wage is short', () => {
    const state = hiredFarm(); const farm = farmOf(state);
    farm.cashCents = FIRST_FARMHAND.dailyShiftCents - 1; syncCashMirror(state);
    const before = JSON.stringify({ workforce: farm.workforce, cash: farm.cashCents, coins: state.player.coins });
    const result = startFarmhandShift(state, 'starter', 'prepare', NOW);
    expect(result.result.ok).toBe(false);
    expect(result.plan).toBeNull();
    expect(result.wageChargedCents).toBe(0);
    expect(JSON.stringify({ workforce: farm.workforce, cash: farm.cashCents, coins: state.player.coins })).toBe(before);
  });

  it('migrates v13 closed, fails malformed progression closed, and round-trips a valid hire', () => {
    const old = unlockedFarm() as unknown as Record<string, any>;
    old.version = 13;
    old.farm.workforce = { farmhandHired: true, lastShiftPaidDay: 1 };
    const migrated = deserialize(JSON.stringify(old), NOW + 3);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).workforce).toEqual({ farmhandHired: false, lastShiftPaidDay: 0 });

    const malformed = unlockedFarm() as unknown as Record<string, any>;
    malformed.farm.townContact.status = 'unmet';
    malformed.farm.workforce = { farmhandHired: true, lastShiftPaidDay: 999 };
    const safe = deserialize(JSON.stringify(malformed), NOW + 4);
    expect(farmOf(safe).workforce).toEqual({ farmhandHired: false, lastShiftPaidDay: 0 });

    const hired = hiredFarm();
    farmOf(hired).workforce.lastShiftPaidDay = 1;
    const reloaded = deserialize(serialize(hired, NOW + 5), NOW + 6);
    expect(farmOf(reloaded).workforce).toEqual({ farmhandHired: true, lastShiftPaidDay: 1 });
    expect(farmFieldCondition(reloaded, reloaded.plots[0].uid).soil).toBe('rough');
  });
});
