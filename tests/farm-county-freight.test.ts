import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_FREIGHT_BID_COUNT, COUNTY_FREIGHT_BULK_PREMIUM_BPS, COUNTY_FREIGHT_PREMIUM_BPS, COUNTY_FREIGHT_TEMPLATES, countyFreightBulkAllowedUnits } from '../src/data/countyFreight.data';
import {
  acceptCountyFreightOffer, countyFreightBoardState, countyFreightOffer, countyFreightOffers,
  countyFreightProgress, fulfillCountyFreightContract,
} from '../src/core/farmCountyFreight';
import { advanceFarmDays, farmOf } from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
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
    expect(countyFreightBoardState(state)).toEqual({ unlocked: false, offers: [], active: null, completedToday: false });
    expect(acceptCountyFreightOffer(state).ok).toBe(false);
    expect(farmOf(state).countyFreight).toEqual({ active: null, lastCompletedDay: 0 });
  });

  it('generates three deterministic unique unlocked-crop bids with locked 25 percent premiums', () => {
    const a = progressedFarm();
    const b = progressedFarm();
    const offers = countyFreightOffers(a);
    expect(offers).toEqual(countyFreightOffers(b));
    expect(offers).toHaveLength(COUNTY_FREIGHT_BID_COUNT);
    expect(new Set(offers.map((offer) => offer.cropId)).size).toBe(COUNTY_FREIGHT_BID_COUNT);
    expect(offers.every((offer) => !['crop_cabbage', 'crop_pumpkin'].includes(offer.cropId))).toBe(true);
    for (const offer of offers) {
      const template = COUNTY_FREIGHT_TEMPLATES.find((candidate) => candidate.cropId === offer.cropId)!;
      expect(template).toBeDefined();
      const quote = farmOf(a).market.quotes[offer.cropId].currentCents;
      expect(offer.requiredUnits).toBe(template.requiredUnits);
      expect(offer.payoutCents).toBe(Math.round(offer.requiredUnits * quote * (10_000 + COUNTY_FREIGHT_PREMIUM_BPS) / 10_000));
    }
    expect(countyFreightOffer(a)).toEqual(offers[0]);
  });

  it('snapshots accepted terms even when the market or day changes', () => {
    const state = progressedFarm();
    const offer = countyFreightOffers(state)[1];
    expect(acceptCountyFreightOffer(state, offer.id).ok).toBe(true);
    const accepted = structuredClone(farmOf(state).countyFreight.active);
    expect(accepted).toEqual(offer);
    expect(countyFreightOffers(state)).toEqual([]);
    farmOf(state).market.quotes[offer.cropId].currentCents *= 2;
    advanceFarmDays(state, 3);
    expect(farmOf(state).countyFreight.active).toEqual(accepted);
    expect(countyFreightOffer(state)).toBeNull();
  });

  it('rejects a stale visible offer if the farm day rolls before acceptance', () => {
    const state = progressedFarm();
    const stale = countyFreightOffers(state)[1];
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
    expect(countyFreightBoardState(state).offers).toHaveLength(COUNTY_FREIGHT_BID_COUNT);
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
    expect(farmOf(normalized).countyFreight.lastCompletedDay).toBe(0);
    expect(countyFreightOffers(normalized)).toHaveLength(COUNTY_FREIGHT_BID_COUNT);
  });
  it('keeps base-pickup bids standard, deterministic, and within 72 weighted cargo', () => {
    const state = progressedFarm(9_001);
    const offers = countyFreightOffers(state);
    expect(offers).toHaveLength(3);
    expect(offers.every((offer) => offer.kind === 'standard')).toBe(true);
    expect(offers.every((offer) => offer.id === `county-freight-v2-${offer.issuedDay}-standard-${offer.cropId}`)).toBe(true);
    expect(offers.every((offer) => offer.requiredUnits === COUNTY_FREIGHT_TEMPLATES.find((template) => template.cropId === offer.cropId)!.requiredUnits)).toBe(true);
    expect(offers.every((offer) => offer.requiredUnits * farmCropDef(offer.cropId).storageUnitsPerItem <= 72)).toBe(true);
  });

  it('posts one stable trailer bulk load plus two distinct standard routes', () => {
    const state = progressedFarm(9_002); farmOf(state).equipment.countyUtilityTrailerOwned = true;
    const offers = countyFreightOffers(state); const bulk = offers.find((offer) => offer.kind === 'bulk')!;
    expect(offers).toHaveLength(3); expect(offers.filter((offer) => offer.kind === 'bulk')).toHaveLength(1);
    expect(offers.filter((offer) => offer.kind === 'standard')).toHaveLength(2);
    expect(new Set(offers.map((offer) => offer.cropId)).size).toBe(3);
    const crop = COUNTY_FREIGHT_TEMPLATES.find((template) => template.cropId === bulk.cropId)!;
    const quote = farmOf(state).market.quotes[bulk.cropId].currentCents;
    const weight = farmCropDef(crop.cropId).storageUnitsPerItem;
    expect(countyFreightBulkAllowedUnits(weight)).toContain(bulk.requiredUnits);
    expect(bulk.requiredUnits * weight).toBeGreaterThan(72); expect(bulk.requiredUnits * weight).toBeLessThanOrEqual(144);
    expect(bulk.payoutCents).toBe(Math.round(bulk.requiredUnits * quote * (10_000 + COUNTY_FREIGHT_BULK_PREMIUM_BPS) / 10_000));
    expect(countyFreightOffers(deserialize(serialize(state, NOW + 1), NOW + 2))).toEqual(offers);
  });

  it('fulfills a bulk load atomically, retains extra cargo, and pays once', () => {
    const state = progressedFarm(9_003); farmOf(state).equipment.countyUtilityTrailerOwned = true;
    const bulk = countyFreightOffers(state).find((offer) => offer.kind === 'bulk')!;
    expect(acceptCountyFreightOffer(state, bulk.id).ok).toBe(true);
    const before = JSON.stringify({ freight: farmOf(state).countyFreight, cargo: farmOf(state).pickup.cargo, cash: farmOf(state).cashCents });
    farmOf(state).pickup.cargo.crops[bulk.cropId] = bulk.requiredUnits - 1;
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(farmOf(state).countyFreight.active).not.toBeNull();
    farmOf(state).pickup.cargo.crops[bulk.cropId] = bulk.requiredUnits + 2;
    const cash = farmOf(state).cashCents;
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farmOf(state).pickup.cargo.crops[bulk.cropId]).toBe(2);
    expect(farmOf(state).cashCents).toBe(cash + bulk.payoutCents);
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(before).toContain(bulk.id);
  });

  it('normalizes literal v17 standard terms and fail-closes malformed v18 bulk contracts', () => {
    const legacy = progressedFarm() as unknown as Record<string, any>;
    legacy.version = 17;
    legacy.farm.countyFreight.active = { id: 'county-freight-1-crop_corn', issuedDay: 1, cropId: 'crop_corn', requiredUnits: 16, payoutCents: 6_200 };
    const migrated = deserialize(JSON.stringify(legacy), NOW + 1);
    expect(farmOf(migrated).countyFreight.active).toMatchObject({ kind: 'standard', id: 'county-freight-1-crop_corn', requiredUnits: 16, payoutCents: 6_200 });
    farmOf(migrated).pickup.cargo.crops.crop_corn = 16;
    expect(fulfillCountyFreightContract(migrated, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);

    const bulkState = progressedFarm(9_004); farmOf(bulkState).equipment.countyUtilityTrailerOwned = true;
    const valid = countyFreightOffers(bulkState).find((offer) => offer.kind === 'bulk')!;
    expect(acceptCountyFreightOffer(bulkState, valid.id).ok).toBe(true);
    expect(farmOf(deserialize(serialize(bulkState, NOW + 2), NOW + 3)).countyFreight.active).toEqual(valid);
    for (const change of [
      { kind: 'standard' }, { id: 'county-freight-v2-1-bulk-crop_fake' }, { requiredUnits: 1 }, { payoutCents: 999_999_999 },
    ]) {
      const malformed = structuredClone(bulkState) as unknown as Record<string, any>;
      Object.assign(malformed.farm.countyFreight.active, change);
      expect(farmOf(deserialize(JSON.stringify(malformed), NOW + 4)).countyFreight.active).toBeNull();
    }
    const trailerless = structuredClone(bulkState) as unknown as Record<string, any>;
    trailerless.farm.equipment.countyUtilityTrailerOwned = false;
    expect(farmOf(deserialize(JSON.stringify(trailerless), NOW + 5)).countyFreight.active).toBeNull();
  });
  it('closes an active contract already completed today and blocks in-memory double payout without mutation', () => {
    const state = progressedFarm(); const offer = countyFreightOffers(state)[0];
    expect(acceptCountyFreightOffer(state, offer.id).ok).toBe(true);
    farmOf(state).pickup.cargo.crops[offer.cropId] = offer.requiredUnits;
    farmOf(state).countyFreight.lastCompletedDay = farmOf(state).clock.day;
    const before = JSON.stringify({ freight: farmOf(state).countyFreight, cargo: farmOf(state).pickup.cargo, cash: farmOf(state).cashCents, stats: state.stats });
    expect(fulfillCountyFreightContract(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(JSON.stringify({ freight: farmOf(state).countyFreight, cargo: farmOf(state).pickup.cargo, cash: farmOf(state).cashCents, stats: state.stats })).toBe(before);
    const saved = structuredClone(state) as unknown as Record<string, any>;
    const normalized = deserialize(JSON.stringify(saved), NOW + 6);
    expect(farmOf(normalized).countyFreight.active).toBeNull();
  });

  it('requires real crop unlocks for legacy standard contracts', () => {
    for (const [cropId, requiredUnits] of [['crop_cabbage', 16], ['crop_pumpkin', 8]] as const) {
      const forged = progressedFarm() as unknown as Record<string, any>;
      forged.version = 17;
      forged.farm.countyFreight.active = { id: `county-freight-1-${cropId}`, issuedDay: 1, cropId, requiredUnits, payoutCents: 1 };
      expect(farmOf(deserialize(JSON.stringify(forged), NOW + 7)).countyFreight.active).toBeNull();
    }
  });

  it('accepts only attainable inclusive payout maxima for standard and bulk snapshots', () => {
    const maxPayout = (requiredUnits: number, cropId: string, premiumBps: number) => Math.round(requiredUnits * Math.round(farmCropDef(cropId).basePriceCents * 1.55) * (10_000 + premiumBps) / 10_000);
    const standardState = progressedFarm(9_010); const standard = countyFreightOffers(standardState)[0];
    expect(acceptCountyFreightOffer(standardState, standard.id).ok).toBe(true);
    const bulkState = progressedFarm(9_011); farmOf(bulkState).equipment.countyUtilityTrailerOwned = true;
    const bulk = countyFreightOffers(bulkState).find((offer) => offer.kind === 'bulk')!;
    expect(acceptCountyFreightOffer(bulkState, bulk.id).ok).toBe(true);
    for (const [state, contract, premiumBps] of [[standardState, standard, COUNTY_FREIGHT_PREMIUM_BPS], [bulkState, bulk, COUNTY_FREIGHT_BULK_PREMIUM_BPS]] as const) {
      const maximum = maxPayout(contract.requiredUnits, contract.cropId, premiumBps);
      for (const payoutCents of [maximum, maximum + 1, 0]) {
        const raw = structuredClone(state) as unknown as Record<string, any>;
        raw.farm.countyFreight.active.payoutCents = payoutCents;
        const normalized = farmOf(deserialize(JSON.stringify(raw), NOW + 8)).countyFreight.active;
        expect(normalized === null).toBe(payoutCents !== maximum);
        if (normalized) expect(normalized.payoutCents).toBe(maximum);
      }
    }
  });
});
