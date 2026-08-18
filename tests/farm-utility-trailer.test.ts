import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_UTILITY_TRAILER } from '../src/data/farmEquipment.data';
import { farmOf, purchaseCountyUtilityTrailer } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { loadBarnCropToPickup, pickupCargoCapacity, pickupCargoRemaining, pickupCargoUsed } from '../src/core/farmPickup';
import { deserialize, serialize } from '../src/save/save';

const NOW = Date.UTC(2026, 7, 12, 12);

function farm() {
  return createFarmGame('Trailer Test', 1313, NOW);
}

describe('County Utility Trailer', () => {
  it('starts closed at 72 units and unlocks only after a completed freight haul', () => {
    const state = farm(); const business = farmOf(state);
    expect(SAVE_VERSION).toBe(20);
    expect(business.equipment.countyUtilityTrailerOwned).toBe(false);
    expect(pickupCargoCapacity(state)).toBe(COUNTY_UTILITY_TRAILER.fromCapacity);
    const before = JSON.stringify(business);
    expect(purchaseCountyUtilityTrailer(state).ok).toBe(false);
    expect(JSON.stringify(business)).toBe(before);
    business.countyFreight.lastCompletedDay = 1;
    expect(purchaseCountyUtilityTrailer(state).ok).toBe(true);
    expect(business.equipment.countyUtilityTrailerOwned).toBe(true);
    expect(pickupCargoCapacity(state)).toBe(COUNTY_UTILITY_TRAILER.toCapacity);
  });

  it('purchases atomically once and syncs the cash mirror', () => {
    const state = farm(); const business = farmOf(state);
    business.countyFreight.lastCompletedDay = 1;
    business.cashCents = COUNTY_UTILITY_TRAILER.priceCents - 1;
    const short = JSON.stringify(business);
    expect(purchaseCountyUtilityTrailer(state).ok).toBe(false);
    expect(JSON.stringify(business)).toBe(short);
    business.cashCents = COUNTY_UTILITY_TRAILER.priceCents;
    expect(purchaseCountyUtilityTrailer(state).ok).toBe(true);
    expect(business.cashCents).toBe(0);
    expect(state.player.coins).toBe(0);
    const purchased = JSON.stringify(business);
    expect(purchaseCountyUtilityTrailer(state).ok).toBe(false);
    expect(JSON.stringify(business)).toBe(purchased);
  });

  it('raises the real mixed-cargo transaction ceiling rather than only changing UI copy', () => {
    const state = farm(); const business = farmOf(state);
    business.storage.crop_pumpkin = 40;
    expect(loadBarnCropToPickup(state, 'crop_pumpkin', 25).ok).toBe(false);
    business.equipment.countyUtilityTrailerOwned = true;
    expect(loadBarnCropToPickup(state, 'crop_pumpkin', 40).ok).toBe(true);
    expect(pickupCargoUsed(state)).toBe(120);
    expect(pickupCargoRemaining(state)).toBe(24);
  });

  it('migrates v12 closed, truncates excess cargo safely, and round-trips valid v13 ownership', () => {
    const old = farm() as unknown as Record<string, any>;
    old.version = 12;
    old.farm.equipment.countyUtilityTrailerOwned = true;
    old.farm.pickup.cargo.seeds.crop_wheat = 100;
    const migrated = deserialize(JSON.stringify(old), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).equipment.countyUtilityTrailerOwned).toBe(false);
    expect(pickupCargoUsed(migrated)).toBe(72);

    const current = farm() as unknown as Record<string, any>;
    current.farm.equipment.countyUtilityTrailerOwned = 'yes';
    current.farm.countyFreight.lastCompletedDay = 999;
    const corrupt = deserialize(JSON.stringify(current), NOW + 2);
    expect(farmOf(corrupt).equipment.countyUtilityTrailerOwned).toBe(false);
    expect(farmOf(corrupt).countyFreight.lastCompletedDay).toBe(0);
    expect(purchaseCountyUtilityTrailer(corrupt).ok).toBe(false);

    const owned = farm();
    farmOf(owned).equipment.countyUtilityTrailerOwned = true;
    farmOf(owned).pickup.cargo.seeds.crop_wheat = 100;
    const reloaded = deserialize(serialize(owned, NOW + 3), NOW + 4);
    expect(farmOf(reloaded).equipment.countyUtilityTrailerOwned).toBe(true);
    expect(pickupCargoCapacity(reloaded)).toBe(144);
    expect(pickupCargoUsed(reloaded)).toBe(100);
  });
});
