import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { commitLoadBarnBatch, maxPickupCropSale, preflightLoadBarnBatch, reservedMarketCropUnits, sellPickupCropBatch } from '../src/core/farmPickup';
import { acceptCountyWorkOrder, offerCountyWorkOrder } from '../src/core/farmTownContact';

describe('simple quantities and cargo batch authorities', () => {
  it('preflights and commits a mixed crop load atomically with weighted limits', () => {
    const state = createFarmGame('batch', 17, Date.UTC(2026, 0, 1)); const farm = farmOf(state);
    farm.storage.crop_corn = 10; farm.storage.crop_pumpkin = 10; farm.pickup.cargo.seeds.crop_wheat = 67;
    const before = JSON.stringify({ storage: farm.storage, cargo: farm.pickup.cargo });
    const tooMuch = preflightLoadBarnBatch(state, { crop_corn: 1, crop_pumpkin: 2 });
    expect(tooMuch.ok).toBe(false); expect(JSON.stringify({ storage: farm.storage, cargo: farm.pickup.cargo })).toBe(before);
    farm.pickup.cargo.seeds.crop_wheat = 1;
    const plan = preflightLoadBarnBatch(state, { crop_corn: 2, crop_pumpkin: 3 });
    expect(plan.ok).toBe(true);
    expect(commitLoadBarnBatch(state, plan.ok ? plan.plan : { quantities: {}, used: 0, capacity: 0, snapshot: '' }).ok).toBe(true);
    expect(farm.storage.crop_corn).toBe(8); expect(farm.storage.crop_pumpkin).toBe(7); expect(farm.pickup.cargo.crops).toEqual({ crop_corn: 2, crop_pumpkin: 3 });
  });

  it('rejects a stale batch plan without mutating either side', () => {
    const state = createFarmGame('stale', 18, Date.UTC(2026, 0, 1)); const farm = farmOf(state); farm.storage.crop_corn = 5;
    const planned = preflightLoadBarnBatch(state, { crop_corn: 3 }); expect(planned.ok).toBe(true);
    farm.storage.crop_corn = 4; const before = JSON.stringify({ storage: farm.storage, cargo: farm.pickup.cargo });
    expect(commitLoadBarnBatch(state, planned.ok ? planned.plan : { quantities: {}, used: 0, capacity: 0, snapshot: '' }).ok).toBe(false);
    expect(JSON.stringify({ storage: farm.storage, cargo: farm.pickup.cargo })).toBe(before);
  });

  it('keeps County obligations reserved from the market fast path', () => {
    const state = createFarmGame('reserve', 19, Date.UTC(2026, 0, 1)); const farm = farmOf(state);
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state); farm.pickup.cargo.crops.crop_corn = 15;
    expect(reservedMarketCropUnits(state, 'crop_corn')).toBe(12); expect(maxPickupCropSale(state, 'crop_corn')).toBe(3);
    const before = JSON.stringify(farm.pickup.cargo);
    expect(sellPickupCropBatch(state, { crop_corn: 4 }, true).ok).toBe(false);
    expect(JSON.stringify(farm.pickup.cargo)).toBe(before);
    expect(sellPickupCropBatch(state, { crop_corn: 3 }, true).ok).toBe(true); expect(farm.pickup.cargo.crops.crop_corn).toBe(12);
  });
});
