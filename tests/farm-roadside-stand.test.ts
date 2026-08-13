import { describe, expect, it } from 'vitest';
import '../src/data';
import { ROADSIDE_PRODUCE_STAND } from '../src/data/farmRoadsideStand.data';
import {
  fulfillRoadsideStandOrder, purchaseRoadsideStand, roadsideStandOrder,
  roadsideStandView,
} from '../src/core/farmRoadsideStand';
import { advanceFarmDays, farmOf } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { NOW } from './helpers';

function countyFarm(seed = 7_401) {
  const state = createFarmGame('Roadside Test', seed, NOW);
  farmOf(state).townContact.status = 'completed';
  return state;
}

function ownedStand(seed = 7_401) {
  const state = countyFarm(seed);
  expect(purchaseRoadsideStand(state).ok).toBe(true);
  return state;
}

describe('Roadside Produce Stand', () => {
  it('is save-closed by default and unlocks only after proving the farm', () => {
    const state = createFarmGame('Roadside Test', 7_401, NOW);
    expect(farmOf(state).roadsideStand).toEqual({ owned: false, lastCompletedDay: 0 });
    expect(roadsideStandView(state)).toEqual({ unlocked: false, owned: false, completedToday: false, order: null });
    expect(purchaseRoadsideStand(state).ok).toBe(false);
    farmOf(state).townContact.status = 'completed';
    expect(roadsideStandView(state).unlocked).toBe(true);
  });

  it('charges once, mirrors cash, and never permits a duplicate build', () => {
    const short = countyFarm();
    farmOf(short).cashCents = ROADSIDE_PRODUCE_STAND.priceCents - 1;
    const shortBefore = JSON.stringify({ cash: farmOf(short).cashCents, stand: farmOf(short).roadsideStand });
    expect(purchaseRoadsideStand(short).ok).toBe(false);
    expect(JSON.stringify({ cash: farmOf(short).cashCents, stand: farmOf(short).roadsideStand })).toBe(shortBefore);

    const state = countyFarm();
    const cash = farmOf(state).cashCents;
    expect(purchaseRoadsideStand(state).ok).toBe(true);
    expect(farmOf(state).cashCents).toBe(cash - ROADSIDE_PRODUCE_STAND.priceCents);
    expect(state.player.coins).toBe(Math.floor((cash - ROADSIDE_PRODUCE_STAND.priceCents) / 100));
    expect(state.stats.farmCashSpentCents).toBe(ROADSIDE_PRODUCE_STAND.priceCents);
    expect(purchaseRoadsideStand(state).ok).toBe(false);
    expect(farmOf(state).cashCents).toBe(cash - ROADSIDE_PRODUCE_STAND.priceCents);
  });

  it('generates one deterministic unlocked-crop request below the County posted rate', () => {
    const a = ownedStand();
    const b = ownedStand();
    const order = roadsideStandOrder(a)!;
    expect(order).toEqual(roadsideStandOrder(b));
    expect(order.issuedDay).toBe(1);
    expect(order.requiredUnits).toBeGreaterThanOrEqual(ROADSIDE_PRODUCE_STAND.minOrderUnits);
    expect(order.requiredUnits).toBeLessThanOrEqual(ROADSIDE_PRODUCE_STAND.maxOrderUnits);
    const quote = farmOf(a).market.quotes[order.cropId].currentCents;
    expect(order.payoutCents).toBe(Math.round(order.requiredUnits * quote * ROADSIDE_PRODUCE_STAND.localRateBps / 10_000));
    expect(order.payoutCents).toBeLessThan(order.requiredUnits * quote);
  });

  it('rejects shortage and stale ids without changing inventory, cash, or completion', () => {
    const state = ownedStand();
    const order = roadsideStandOrder(state)!;
    farmOf(state).storage[order.cropId] = order.requiredUnits - 1;
    const before = JSON.stringify({ storage: farmOf(state).storage, stand: farmOf(state).roadsideStand, cash: farmOf(state).cashCents });
    expect(fulfillRoadsideStandOrder(state, order.id).ok).toBe(false);
    expect(fulfillRoadsideStandOrder(state, 'roadside-order-stale').ok).toBe(false);
    expect(JSON.stringify({ storage: farmOf(state).storage, stand: farmOf(state).roadsideStand, cash: farmOf(state).cashCents })).toBe(before);
  });

  it('consumes exact barn units, pays once, and refreshes only on a later day', () => {
    const state = ownedStand();
    const order = roadsideStandOrder(state)!;
    farmOf(state).storage[order.cropId] = order.requiredUnits + 4;
    const cash = farmOf(state).cashCents;
    expect(fulfillRoadsideStandOrder(state, order.id).ok).toBe(true);
    expect(farmOf(state).storage[order.cropId]).toBe(4);
    expect(farmOf(state).cashCents).toBe(cash + order.payoutCents);
    expect(state.stats.itemsSold).toBe(order.requiredUnits);
    expect(roadsideStandView(state).completedToday).toBe(true);
    expect(fulfillRoadsideStandOrder(state, order.id).ok).toBe(false);
    expect(farmOf(state).cashCents).toBe(cash + order.payoutCents);
    advanceFarmDays(state);
    expect(roadsideStandView(state).completedToday).toBe(false);
    expect(roadsideStandOrder(state)?.issuedDay).toBe(2);
  });

  it('round trips ownership/completion and migrates v14 without granting the stand', () => {
    const state = ownedStand();
    const order = roadsideStandOrder(state)!;
    farmOf(state).storage[order.cropId] = order.requiredUnits;
    fulfillRoadsideStandOrder(state, order.id);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(farmOf(loaded).roadsideStand).toEqual({ owned: true, lastCompletedDay: 1 });
    expect(roadsideStandView(loaded).completedToday).toBe(true);

    const old = countyFarm() as unknown as Record<string, unknown>;
    old.version = 14;
    (old.farm as Record<string, unknown>).roadsideStand = { owned: true, lastCompletedDay: 1 };
    const migrated = deserialize(JSON.stringify(old), NOW + 3);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).roadsideStand).toEqual({ owned: false, lastCompletedDay: 0 });
  });

  it('fails malformed current state closed and never preserves impossible completion days', () => {
    const corrupt = countyFarm() as unknown as Record<string, unknown>;
    (corrupt.farm as Record<string, unknown>).roadsideStand = { owned: 'yes', lastCompletedDay: 999 };
    const normalized = deserialize(JSON.stringify(corrupt), NOW + 1);
    expect(farmOf(normalized).roadsideStand).toEqual({ owned: false, lastCompletedDay: 0 });
  });
});
