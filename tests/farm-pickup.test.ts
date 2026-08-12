import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { buyTownSeedsIntoPickup, loadBarnCropToPickup, loadFarmSeedsToPickup, pickupCargoRemaining, pickupCargoUsed, unloadPickupCropToBarn, unloadPickupSeedsToFarm } from '../src/core/farmPickup';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder } from '../src/core/farmTownContact';
import { countyDeliveryMarketState } from '../src/ui/panels/farmPanels';
import { deserialize, serialize } from '../src/save/save';
import { pickupPositionForSave, PICKUP_START } from '../src/core/farmPickupData';
import { FARM_TOWN_GATE } from '../src/core/townGateway';

const NOW = Date.UTC(2026, 0, 1);

describe('old pickup cargo loop', () => {
  it('only parks the pickup on save when it is actually in town', () => {
    const elsewhere = { x: 18, y: 14 };
    expect(pickupPositionForSave(false, elsewhere)).toEqual(elsewhere);
    expect(pickupPositionForSave(true, elsewhere)).toEqual(PICKUP_START);
  });

  it('sanitizes only the legacy gate-conflict pickup position and preserves cargo', () => {
    const state = createFarmGame('Pickup', 21, NOW) as unknown as Record<string, unknown>;
    const farm = state.farm as Record<string, unknown>;
    farm.pickup = { x: FARM_TOWN_GATE.x, y: FARM_TOWN_GATE.y, cargo: { crops: { crop_corn: 4 }, seeds: {} } };
    const loaded = deserialize(JSON.stringify(state), NOW + 1);
    expect(farmOf(loaded).pickup).toMatchObject({ x: PICKUP_START.x, y: PICKUP_START.y, cargo: { crops: { crop_corn: 4 } } });
    farm.pickup = { x: 18, y: 14, cargo: { crops: { crop_corn: 4 }, seeds: {} } };
    const unrelated = deserialize(JSON.stringify(state), NOW + 2);
    expect(farmOf(unrelated).pickup).toMatchObject({ x: 18, y: 14, cargo: { crops: { crop_corn: 4 } } });
  });

  it('rejects barn transfers away from the physical cargo pad without mutation', () => {
    const state = createFarmGame('Pickup', 2, NOW); const farm = farmOf(state);
    farm.storage.crop_wheat = 4; farm.pickup.x += 4;
    const before = JSON.stringify({ storage: farm.storage, pickup: farm.pickup });
    const result = loadBarnCropToPickup(state, 'crop_wheat', 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('cargo pad');
    expect(JSON.stringify({ storage: farm.storage, pickup: farm.pickup })).toBe(before);
  });

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
    expect(loaded.version).toBe(9);
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
    expect(pickup.x).toBe(PICKUP_START.x);
    expect(pickup.y).toBe(PICKUP_START.y);
    expect(pickupCargoUsed(loaded)).toBeLessThanOrEqual(72);
  });
});
