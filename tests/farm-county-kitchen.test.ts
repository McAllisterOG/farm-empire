import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY } from '../src/data/townWorkOrders.data';
import { acceptCountyKitchenDelivery, countyKitchenProgress, fulfillCountyKitchenDelivery, offerCountyKitchenDelivery } from '../src/core/farmCountyKitchen';
import { farmOf } from '../src/core/farmBusiness';
import { createFarmGame } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { farmCropDef } from '../src/core/registry';
import { loadBarnCropToPickup, loadFarmSeedsToPickup } from '../src/core/farmPickup';
import { countyKitchenPanelState } from '../src/ui/panels/farmPanels';
import { NOW } from './helpers';

describe('County Kitchen Garden Table Delivery', () => {
  it('keeps Rosa and the kitchen presentation Pantry-locked until the first delivery is complete', () => {
    const state = createFarmGame('Panel', 43, NOW);
    expect(countyKitchenPanelState(state)).toEqual({ locked: true, status: 'unmet' });
    farmOf(state).townContact.status = 'completed';
    expect(countyKitchenPanelState(state)).toEqual({ locked: false, status: 'unmet' });
  });

  it('gates, derives pickup-only progress, atomically consumes exact cargo, and pays once', () => {
    const state = createFarmGame('Rosa', 44, NOW); const farm = farmOf(state);
    expect(offerCountyKitchenDelivery(state).ok).toBe(false);
    farm.townContact.status = 'completed'; expect(offerCountyKitchenDelivery(state).ok).toBe(true); expect(acceptCountyKitchenDelivery(state).ok).toBe(true);
    for (const [cropId, count] of Object.entries({ crop_corn: 8, crop_carrot: 5, crop_tomato: 4, crop_wheat: 3 })) {
      farm.storage[cropId] = count;
      expect(loadBarnCropToPickup(state, cropId, count).ok).toBe(true);
    }
    farm.seeds.crop_wheat = 2;
    expect(loadFarmSeedsToPickup(state, 'crop_wheat', 2).ok).toBe(true);
    const cash = farm.cashCents, insufficient = serialize(state, NOW);
    expect(countyKitchenProgress(state, { pickupPresent: true, source: 'pickup' })).toEqual({ crop_corn: 8, crop_carrot: 5, crop_tomato: 4 });
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(serialize(state, NOW)).toBe(insufficient);
    farm.storage.crop_carrot = 1; farm.storage.crop_corn = 2;
    expect(loadBarnCropToPickup(state, 'crop_carrot', 1).ok).toBe(true);
    expect(loadBarnCropToPickup(state, 'crop_corn', 2).ok).toBe(true);
    const ready = serialize(state, NOW);
    for (const context of [undefined, { pickupPresent: false, source: 'pickup' as const }]) {
      expect(fulfillCountyKitchenDelivery(state, context).ok).toBe(false);
      expect(serialize(state, NOW)).toBe(ready);
    }
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farm.pickup.cargo.crops).toMatchObject({ crop_corn: 2, crop_carrot: 0, crop_tomato: 0 }); expect(farm.cashCents).toBe(cash + COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents); expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    expect(farm.pickup.cargo.crops.crop_wheat).toBe(3);
    expect(farm.pickup.cargo.seeds.crop_wheat).toBe(2);
    const completed = serialize(state, NOW);
    const reloaded = deserialize(completed, NOW);
    expect(reloaded.version).toBe(26);
    expect(reloaded.farm?.countyKitchen.status).toBe('completed');
    expect(reloaded.farm?.cashCents).toBe(cash + 11_500);
    expect(reloaded.farm?.pickup.cargo).toEqual({ crops: { crop_corn: 2, crop_wheat: 3 }, seeds: { crop_wheat: 2 } });
    const normalizedCompleted = serialize(reloaded, NOW);
    expect(fulfillCountyKitchenDelivery(reloaded, { pickupPresent: true, source: 'pickup' }).ok).toBe(false);
    expect(serialize(reloaded, NOW)).toBe(normalizedCompleted);
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false); expect(farm.cashCents).toBe(cash + COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents);
  });

  it('uses registered cargo keys and preserves the exact published contract terms', () => {
    expect(COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo).toEqual({ crop_corn: 8, crop_carrot: 6, crop_tomato: 4 });
    expect(COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents).toBe(11_500);
    for (const id of Object.keys(COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo)) expect(farmCropDef(id)?.id).toBe(id);
  });

  it('migrates v22 without a grant and closes malformed kitchen state without touching freight', () => {
    const state = createFarmGame('Legacy', 45, NOW) as unknown as Record<string, any>;
    state.version = 22; state.farm.townContact.status = 'completed'; state.farm.countyKitchen = { status: 'completed' }; state.farm.countyFreight = { active: null, lastCompletedDay: 1 };
    const migrated = deserialize(JSON.stringify(state), NOW + 1); expect(farmOf(migrated).countyKitchen.status).toBe('unmet'); expect(farmOf(migrated).countyFreight.lastCompletedDay).toBe(1);
    const corrupt = createFarmGame('Corrupt', 46, NOW); farmOf(corrupt).townContact.status = 'unmet'; farmOf(corrupt).countyKitchen.status = 'completed';
    expect(deserialize(JSON.stringify(corrupt), NOW + 1).farm!.countyKitchen.status).toBe('unmet');
  });
});
