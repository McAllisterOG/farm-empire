import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_PANTRY_CORN_ORDER } from '../src/data/townWorkOrders.data';
import { acceptCountyWorkOrder, countyWorkOrderProgress, fulfillCountyWorkOrder, offerCountyWorkOrder, townContact } from '../src/core/farmTownContact';
import { farmOf } from '../src/core/farmBusiness';
import { SAVE_VERSION, createFarmGame } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { countyDeliveryMarketState } from '../src/ui/panels/farmPanels';
import { loadBarnCropToPickup } from '../src/core/farmPickup';
import { NOW } from './helpers';

function makeFarm() {
  return createFarmGame('County Test', 903, NOW);
}

describe('First Town Contact county order', () => {
  it('starts unmet, records an offer, and accepts idempotently', () => {
    const state = makeFarm();
    expect(state.version).toBe(SAVE_VERSION);
    expect(townContact(state).status).toBe('unmet');
    expect(acceptCountyWorkOrder(state).ok).toBe(false);
    expect(offerCountyWorkOrder(state).ok).toBe(true);
    expect(townContact(state).status).toBe('offered');
    expect(offerCountyWorkOrder(state).ok).toBe(true);
    expect(acceptCountyWorkOrder(state).ok).toBe(true);
    expect(acceptCountyWorkOrder(state).ok).toBe(true);
    expect(townContact(state).status).toBe('active');
  });

  it('derives progress from real barn storage and leaves insufficient delivery unchanged', () => {
    const state = makeFarm();
    offerCountyWorkOrder(state);
    acceptCountyWorkOrder(state);
    const farm = farmOf(state); farm.storage.crop_corn = 11; loadBarnCropToPickup(state, 'crop_corn', 11); const cash = farm.cashCents;
    expect(countyWorkOrderProgress(state, { pickupPresent: true, source: 'pickup' })).toEqual({ storedUnits: 11, requiredUnits: 12 });
    expect(fulfillCountyWorkOrder(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(farm.pickup.cargo.crops.crop_corn).toBe(11);
    expect(farm.cashCents).toBe(cash);
    expect(townContact(state).status).toBe('active');
  });

  it('removes exactly twelve corn, pays exactly $85, and cannot pay twice', () => {
    const state = makeFarm();
    offerCountyWorkOrder(state);
    acceptCountyWorkOrder(state);
    const farm = farmOf(state); farm.storage.crop_corn = 15; loadBarnCropToPickup(state, 'crop_corn', 15); const cash = farm.cashCents;
    expect(fulfillCountyWorkOrder(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farm.pickup.cargo.crops.crop_corn).toBe(3);
    expect(farm.cashCents).toBe(cash + COUNTY_PANTRY_CORN_ORDER.payoutCents);
    expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    expect(townContact(state).status).toBe('completed');
    expect(fulfillCountyWorkOrder(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(farm.cashCents).toBe(cash + COUNTY_PANTRY_CORN_ORDER.payoutCents);
  });

  it("exposes County delivery only at Eli's town market, with live readiness", () => {
    const state = makeFarm();
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state);
    farmOf(state).storage.crop_corn = 11; loadBarnCropToPickup(state, 'crop_corn', 11);
    expect(countyDeliveryMarketState(state)).toEqual({ showCountyOrder: false, deliveryReady: false });
    expect(countyDeliveryMarketState(state, 'farm')).toEqual({ showCountyOrder: false, deliveryReady: false });
    expect(countyDeliveryMarketState(state, 'town')).toEqual({ showCountyOrder: true, deliveryReady: false });
    farmOf(state).storage.crop_corn = 12; loadBarnCropToPickup(state, 'crop_corn', 12);
    expect(countyDeliveryMarketState(state, 'town', true)).toEqual({ showCountyOrder: true, deliveryReady: true });
  });

  it('migrates literal v4 and corrupt contact values safely, while completed work stays complete after reload', () => {
    const old = makeFarm() as unknown as Record<string, unknown>;
    delete (old.farm as Record<string, unknown>).townContact;
    old.version = 4;
    const migrated = deserialize(JSON.stringify(old), NOW + 1000);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(townContact(migrated).status).toBe('unmet');

    const corrupt = makeFarm() as unknown as Record<string, unknown>;
    (corrupt.farm as Record<string, unknown>).townContact = { status: 'unexpected' };
    const loadedCorrupt = deserialize(JSON.stringify(corrupt), NOW + 1000);
    expect(townContact(loadedCorrupt).status).toBe('unmet');

    offerCountyWorkOrder(migrated); acceptCountyWorkOrder(migrated); farmOf(migrated).storage.crop_corn = 12; loadBarnCropToPickup(migrated, 'crop_corn', 12);
    expect(fulfillCountyWorkOrder(migrated, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    const completed = deserialize(serialize(migrated, NOW + 2000), NOW + 3000);
    expect(townContact(completed).status).toBe('completed');
    expect(fulfillCountyWorkOrder(completed, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
  });
});
