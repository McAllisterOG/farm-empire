import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY } from '../src/data/townWorkOrders.data';
import { acceptCountyKitchenDelivery, countyKitchenProgress, fulfillCountyKitchenDelivery, offerCountyKitchenDelivery } from '../src/core/farmCountyKitchen';
import { farmOf } from '../src/core/farmBusiness';
import { createFarmGame } from '../src/core/state';
import { deserialize } from '../src/save/save';
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
    farm.pickup.cargo.crops = { crop_corn: 8, crop_carrots: 5, crop_tomatoes: 4 }; const cash = farm.cashCents;
    expect(countyKitchenProgress(state, { pickupPresent: true, source: 'pickup' })).toEqual({ crop_corn: 8, crop_carrots: 5, crop_tomatoes: 4 });
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false); expect(farm.cashCents).toBe(cash);
    farm.pickup.cargo.crops.crop_carrots = 6; farm.pickup.cargo.crops.crop_corn = 10;
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(true);
    expect(farm.pickup.cargo.crops).toMatchObject({ crop_corn: 2, crop_carrots: 0, crop_tomatoes: 0 }); expect(farm.cashCents).toBe(cash + COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents); expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    expect(fulfillCountyKitchenDelivery(state, { pickupPresent: true, source: 'pickup' }).ok).toBe(false); expect(farm.cashCents).toBe(cash + COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents);
  });

  it('migrates v22 without a grant and closes malformed kitchen state without touching freight', () => {
    const state = createFarmGame('Legacy', 45, NOW) as unknown as Record<string, any>;
    state.version = 22; state.farm.townContact.status = 'completed'; state.farm.countyKitchen = { status: 'completed' }; state.farm.countyFreight = { active: null, lastCompletedDay: 1 };
    const migrated = deserialize(JSON.stringify(state), NOW + 1); expect(farmOf(migrated).countyKitchen.status).toBe('unmet'); expect(farmOf(migrated).countyFreight.lastCompletedDay).toBe(1);
    const corrupt = createFarmGame('Corrupt', 46, NOW); farmOf(corrupt).townContact.status = 'unmet'; farmOf(corrupt).countyKitchen.status = 'completed';
    expect(deserialize(JSON.stringify(corrupt), NOW + 1).farm!.countyKitchen.status).toBe('unmet');
  });
});
