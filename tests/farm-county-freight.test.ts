import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_FREIGHT_PREMIUM_BPS, COUNTY_FREIGHT_TEMPLATES } from '../src/data/countyFreight.data';
import {
  acceptCountyFreightOffer, countyFreightBoardState, countyFreightOffer,
  countyFreightProgress, fulfillCountyFreightContract,
} from '../src/core/farmCountyFreight';
import { advanceFarmDays, farmOf } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { NOW } from './helpers';
import { countyFreightMarketState } from '../src/ui/panels/farmPanels';

function progressedFarm(seed = 1_204) {
  const state = createFarmGame('Freight Test', seed, NOW);
  farmOf(state).townContact.status = 'completed';
  return state;
}

describe('County Freight Board', () => {
  it('stays locked until the first County Pantry delivery', () => {
    const state = createFarmGame('Freight Test', 1_204, NOW);
    expect(countyFreightBoardState(state)).toEqual({ unlocked: false, offer: null, active: null, completedToday: false });
    expect(acceptCountyFreightOffer(state).ok).toBe(false);
    expect(farmOf(state).countyFreight).toEqual({ active: null, lastCompletedDay: 0 });
  });

  it('generates a deterministic unlocked-crop offer with a locked 25 percent premium', () => {
    const a = progressedFarm();
    const b = progressedFarm();
    const offer = countyFreightOffer(a);
    expect(offer).toEqual(countyFreightOffer(b));
    expect(offer).not.toBeNull();
    const template = COUNTY_FREIGHT_TEMPLATES.find((candidate) => candidate.cropId === offer!.cropId)!;
    expect(template).toBeDefined();
    const quote = farmOf(a).market.quotes[offer!.cropId].currentCents;
    expect(offer!.requiredUnits).toBe(template.requiredUnits);
    expect(offer!.payoutCents).toBe(Math.round(offer!.requiredUnits * quote * (10_000 + COUNTY_FREIGHT_PREMIUM_BPS) / 10_000));
  });

  it('snapshots accepted terms even when the market or day changes', () => {
    const state = progressedFarm();
    const offer = countyFreightOffer(state)!;
    expect(acceptCountyFreightOffer(state).ok).toBe(true);
    const accepted = structuredClone(farmOf(state).countyFreight.active);
    farmOf(state).market.quotes[offer.cropId].currentCents *= 2;
    advanceFarmDays(state, 3);
    expect(farmOf(state).countyFreight.active).toEqual(accepted);
    expect(countyFreightOffer(state)).toBeNull();
  });

  it('rejects a stale visible offer if the farm day rolls before acceptance', () => {
    const state = progressedFarm();
    const stale = countyFreightOffer(state)!;
    advanceFarmDays(state);
    const before = JSON.stringify(farmOf(state).countyFreight);
    const result = acceptCountyFreightOffer(state, stale.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('expired');
    expect(JSON.stringify(farmOf(state).countyFreight)).toBe(before);
    expect(countyFreightOffer(state)?.issuedDay).toBe(2);
  });

  it('exposes the board only at the town exchange and readiness only with pickup cargo', () => {
    const state = progressedFarm();
    expect(countyFreightMarketState(state)).toEqual({ showBoard: false, deliveryReady: false });
    expect(countyFreightMarketState(state, 'farm', true)).toEqual({ showBoard: false, deliveryReady: false });
    expect(countyFreightMarketState(state, 'town', false)).toEqual({ showBoard: true, deliveryReady: false });
    acceptCountyFreightOffer(state);
    const active = farmOf(state).countyFreight.active!;
    farmOf(state).pickup.cargo.crops[active.cropId] = active.requiredUnits;
    expect(countyFreightMarketState(state, 'town', false)).toEqual({ showBoard: true, deliveryReady: false });
    expect(countyFreightMarketState(state, 'town', true)).toEqual({ showBoard: true, deliveryReady: true });
  });

  it('fails without the pickup or enough crop and leaves the transaction unchanged', () => {
    const state = progressedFarm();
    acceptCountyFreightOffer(state);
    const active = farmOf(state).countyFreight.active!;
    farmOf(state).pickup.cargo.crops[active.cropId] = active.requiredUnits - 1;
    const before = JSON.stringify({ freight: farmOf(state).countyFreight, cargo: farmOf(state).pickup.cargo, cash: farmOf(state).cashCents });
    expect(fulfillCountyFreightContract(state, { pickupPresent: false, source: 'pickup' }).ok).toBe(false);
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(JSON.stringify({ freight: farmOf(state).countyFreight, cargo: farmOf(state).pickup.cargo, cash: farmOf(state).cashCents })).toBe(before);
  });

  it('consumes exact pickup cargo, pays once, and waits until a later day', () => {
    const state = progressedFarm();
    acceptCountyFreightOffer(state);
    const active = structuredClone(farmOf(state).countyFreight.active)!;
    farmOf(state).pickup.cargo.crops[active.cropId] = active.requiredUnits + 3;
    const cash = farmOf(state).cashCents;
    expect(countyFreightProgress(state, { pickupPresent: true, source: 'pickup' })).toEqual({ loadedUnits: active.requiredUnits + 3, requiredUnits: active.requiredUnits });
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farmOf(state).pickup.cargo.crops[active.cropId]).toBe(3);
    expect(farmOf(state).cashCents).toBe(cash + active.payoutCents);
    expect(state.player.coins).toBe(Math.floor((cash + active.payoutCents) / 100));
    expect(countyFreightBoardState(state).completedToday).toBe(true);
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(farmOf(state).cashCents).toBe(cash + active.payoutCents);
    advanceFarmDays(state);
    expect(countyFreightBoardState(state).offer).not.toBeNull();
  });

  it('round trips active terms and cannot duplicate a completed same-day contract', () => {
    const state = progressedFarm();
    acceptCountyFreightOffer(state);
    const active = structuredClone(farmOf(state).countyFreight.active);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(farmOf(loaded).countyFreight.active).toEqual(active);
    const contract = farmOf(loaded).countyFreight.active!;
    farmOf(loaded).pickup.cargo.crops[contract.cropId] = contract.requiredUnits;
    expect(fulfillCountyFreightContract(loaded, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    const completed = deserialize(serialize(loaded, NOW + 3), NOW + 4);
    expect(countyFreightBoardState(completed).completedToday).toBe(true);
    expect(acceptCountyFreightOffer(completed).ok).toBe(false);
  });

  it('migrates v11 without granting work and rejects malformed current contracts', () => {
    const old = progressedFarm() as unknown as Record<string, unknown>;
    old.version = 11;
    delete (old.farm as Record<string, unknown>).countyFreight;
    const migrated = deserialize(JSON.stringify(old), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).countyFreight).toEqual({ active: null, lastCompletedDay: 0 });

    const corrupt = progressedFarm() as unknown as Record<string, unknown>;
    (corrupt.farm as Record<string, unknown>).countyFreight = {
      active: { id: 'fake', issuedDay: 999, cropId: 'crop_unknown', requiredUnits: 999, payoutCents: 999_999_999 },
      lastCompletedDay: 999,
    };
    const normalized = deserialize(JSON.stringify(corrupt), NOW + 2);
    expect(farmOf(normalized).countyFreight.active).toBeNull();
    expect(farmOf(normalized).countyFreight.lastCompletedDay).toBe(farmOf(normalized).clock.day);
    expect(countyFreightOffer(normalized)).toBeNull();
  });
});
