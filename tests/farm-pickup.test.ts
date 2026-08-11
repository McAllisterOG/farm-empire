import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { buyTownSeedsIntoPickup, loadBarnCropToPickup, loadFarmSeedsToPickup, pickupCargoRemaining, pickupCargoUsed, unloadPickupCropToBarn, unloadPickupSeedsToFarm } from '../src/core/farmPickup';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder } from '../src/core/farmTownContact';
import { countyDeliveryMarketState } from '../src/ui/panels/farmPanels';
import { deserialize, serialize } from '../src/save/save';

const NOW = Date.UTC(2026, 0, 1);

describe('old pickup cargo loop', () => {
  it('accounts for mixed cargo and bulky produce atomically', () => {
    const state = createFarmGame('Pickup', 3, NOW); const farm = farmOf(state);
    farm.parcels.northOwned = true; farm.equipment.barnLoftExpansionOwned = true; farm.storageCapacity = 200; farm.storage.crop_pumpkin = 10;
    expect(loadBarnCropToPickup(state, 'crop_pumpkin', 10).ok).toBe(true);
    expect(pickupCargoUsed(state)).toBe(30);
    expect(loadFarmSeedsToPickup(state, 'crop_wheat', 2).ok).toBe(true);
    expect(pickupCargoUsed(state)).toBe(32);
    const before = JSON.stringify(farm.pickup);
    expect(loadBarnCropToPickup(state, 'crop_pumpkin', 27).ok).toBe(false);
    expect(JSON.stringify(farm.pickup)).toBe(before);
    expect(pickupCargoRemaining(state)).toBe(40);
    expect(unloadPickupCropToBarn(state, 'crop_pumpkin', 4).ok).toBe(true);
    expect(pickupCargoUsed(state)).toBe(20);
  });

  it('buys town seeds into pickup and unloads them without duplication', () => {
    const state = createFarmGame('Pickup', 4, NOW); const farm = farmOf(state);
    const cash = farm.cashCents;
    expect(buyTownSeedsIntoPickup(state, 'crop_wheat', 2, false).ok).toBe(false);
    expect(buyTownSeedsIntoPickup(state, 'crop_wheat', 2, true).ok).toBe(true);
    expect(farm.cashCents).toBe(cash - 2 * 1_000);
    expect(unloadPickupSeedsToFarm(state, 'crop_wheat', 1).ok).toBe(true);
    expect(farm.pickup.cargo.seeds.crop_wheat).toBe(1);
    expect(farm.seeds.crop_wheat).toBe(3);
  });

  it('uses pickup cargo for an atomic County delivery and round trips it', () => {
    const state = createFarmGame('Pickup', 5, NOW); const farm = farmOf(state);
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state); farm.storage.crop_corn = 12;
    loadBarnCropToPickup(state, 'crop_corn', 12);
    expect(fulfillCountyWorkOrder(state, { pickupPresent: false, source: 'pickup' }).ok).toBe(false);
    expect(fulfillCountyWorkOrder(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farm.pickup.cargo.crops.crop_corn).toBe(0);
    expect(farm.cashCents).toBe(508_500);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(loaded.version).toBe(8);
    expect(farmOf(loaded).pickup.id).toBe('old-pickup');
    expect(fulfillCountyWorkOrder(loaded, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
  });

  it('cannot pay from barn cargo or an omitted context', () => {
    const state = createFarmGame('Pickup', 7, NOW); const farm = farmOf(state);
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state); farm.storage.crop_corn = 12;
    expect(fulfillCountyWorkOrder(state).ok).toBe(false);
    expect(farm.cashCents).toBe(500_000);
  });

  it('does not report County readiness from barn-only corn', () => {
    const state = createFarmGame('Pickup', 8, NOW); const farm = farmOf(state);
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state); farm.storage.crop_corn = 12;
    expect(countyDeliveryMarketState(state, 'town', true)).toEqual({ showCountyOrder: true, deliveryReady: false });
  });

  it('normalizes missing, malformed, and over-capacity v7 pickup data safely', () => {
    const state = createFarmGame('Pickup', 6, NOW) as unknown as Record<string, unknown>;
    state.version = 7;
    const farm = state.farm as Record<string, unknown>;
    farm.pickup = { x: 999, y: -99, cargo: { crops: { crop_pumpkin: 99 }, seeds: { crop_wheat: 99 } } };
    const loaded = deserialize(JSON.stringify(state), NOW + 1);
    const pickup = farmOf(loaded).pickup;
    expect(pickup.id).toBe('old-pickup');
    expect(pickup.x).toBe(11.5);
    expect(pickup.y).toBe(11.5);
    expect(pickupCargoUsed(loaded)).toBeLessThanOrEqual(72);
  });
});
