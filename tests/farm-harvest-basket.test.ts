import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { farmOf, plantFarmCrop, storageUsed } from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import {
  HAND_BASKET_CAPACITY, basketInteractionBlockReason, handBasketUsed, harvestFarmCropToBasket,
  setHarvestDestination, unloadHandBasket,
} from '../src/core/farmHarvestBasket';
import { pickupCargoUsed } from '../src/core/farmPickup';
import { deserialize, serialize } from '../src/save/save';
import { NOW } from './helpers';

function matureCrop(cropId = 'crop_corn', plotIndex = 0) {
  const state = createFarmGame('Basket Farm', 77, NOW);
  const farm = farmOf(state);
  farm.equipment.tractor.status = 'operational';
  if (cropId === 'crop_pumpkin') {
    farm.parcels.northOwned = true;
    farm.equipment.barnLoftExpansionOwned = true;
  }
  farm.seeds[cropId] = Math.max(1, farm.seeds[cropId] ?? 0);
  const plot = state.plots[plotIndex];
  expect(plantFarmCrop(state, plot.uid, cropId, NOW, 'operatedTractor').ok).toBe(true);
  plot.crop!.plantedAt = NOW - farmCropDef(cropId).growMs - 1;
  return state;
}

describe('manual harvest basket', () => {
  it('keeps basket interactions isolated from either mounted vehicle', () => {
    expect(basketInteractionBlockReason({ operatingTractor: false, operatingPickup: false })).toBeNull();
    expect(basketInteractionBlockReason({ operatingTractor: true, operatingPickup: false })).toContain('tractor');
    expect(basketInteractionBlockReason({ operatingTractor: false, operatingPickup: true })).toContain('pickup');
  });

  it('harvests into the saved basket without changing barn storage', () => {
    const state = matureCrop('crop_corn');
    const plot = state.plots[0];
    const result = harvestFarmCropToBasket(state, plot.uid, NOW);
    expect(result.ok).toBe(true);
    expect(farmOf(state).handBasket.crops.crop_corn).toBe(farmCropDef('crop_corn').harvestYield);
    expect(handBasketUsed(state)).toBe(10);
    expect(storageUsed(state)).toBe(0);
    expect(plot.crop).toBeNull();
    expect(farmOf(state).fieldConditions[String(plot.uid)].soil).toBe('stubble');
  });

  it('rejects a harvest before mutating when the whole yield will not fit', () => {
    const state = matureCrop('crop_corn');
    farmOf(state).handBasket.crops.crop_corn = 17;
    const before = JSON.stringify({ plot: state.plots[0], basket: farmOf(state).handBasket, stats: state.stats });
    const result = harvestFarmCropToBasket(state, state.plots[0].uid, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Basket needs');
    expect(JSON.stringify({ plot: state.plots[0], basket: farmOf(state).handBasket, stats: state.stats })).toBe(before);
  });

  it('fits one bulky pumpkin harvest exactly', () => {
    const state = matureCrop('crop_pumpkin');
    expect(harvestFarmCropToBasket(state, state.plots[0].uid, NOW).ok).toBe(true);
    expect(handBasketUsed(state)).toBe(HAND_BASKET_CAPACITY);
  });

  it('unloads the whole mixed basket into the barn atomically', () => {
    const state = createFarmGame('Basket Farm', 78, NOW);
    const farm = farmOf(state);
    farm.handBasket.crops = { crop_corn: 8, crop_wheat: 7 };
    farm.storageCapacity = 14;
    const before = JSON.stringify({ basket: farm.handBasket, storage: farm.storage });
    expect(unloadHandBasket(state, 'barn').ok).toBe(false);
    expect(JSON.stringify({ basket: farm.handBasket, storage: farm.storage })).toBe(before);
    farm.storageCapacity = 15;
    expect(unloadHandBasket(state, 'barn').ok).toBe(true);
    expect(farm.handBasket.crops).toEqual({});
    expect(farm.storage.crop_corn).toBe(8);
    expect(farm.storage.crop_wheat).toBe(7);
  });

  it('unloads into a present pickup only when all cargo fits', () => {
    const state = createFarmGame('Basket Farm', 79, NOW);
    const farm = farmOf(state);
    farm.handBasket.crops = { crop_pumpkin: 8 };
    farm.pickup.cargo.seeds.crop_wheat = 49;
    const before = JSON.stringify({ basket: farm.handBasket, pickup: farm.pickup.cargo });
    expect(unloadHandBasket(state, 'pickup', false).ok).toBe(false);
    expect(unloadHandBasket(state, 'pickup', true).ok).toBe(false);
    expect(JSON.stringify({ basket: farm.handBasket, pickup: farm.pickup.cargo })).toBe(before);
    farm.pickup.cargo.seeds.crop_wheat = 48;
    expect(unloadHandBasket(state, 'pickup', true).ok).toBe(true);
    expect(farm.handBasket.crops).toEqual({});
    expect(farm.pickup.cargo.crops.crop_pumpkin).toBe(8);
    expect(pickupCargoUsed(state)).toBe(72);
  });

  it('persists cargo and destination while v16 migration starts safely empty', () => {
    const state = createFarmGame('Basket Farm', 80, NOW);
    farmOf(state).handBasket.crops.crop_corn = 8;
    expect(setHarvestDestination(state, 'pickup').ok).toBe(true);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(farmOf(loaded).handBasket).toEqual({ crops: { crop_corn: 8 }, destination: 'pickup' });

    const old = JSON.parse(serialize(state, NOW + 3)) as Record<string, unknown>;
    old.version = 16;
    const migrated = deserialize(JSON.stringify(old), NOW + 4);
    expect(farmOf(migrated).handBasket).toEqual({ crops: {}, destination: 'barn' });
  });

  it('normalizes corrupt and over-capacity v17 basket data deterministically', () => {
    const state = createFarmGame('Basket Farm', 81, NOW) as unknown as Record<string, unknown>;
    const farm = state.farm as Record<string, unknown>;
    farm.handBasket = {
      destination: 'river',
      crops: { crop_corn: 999, crop_pumpkin: 999, unknown_crop: 999, crop_wheat: -4 },
    };
    const loaded = deserialize(JSON.stringify(state), NOW + 1);
    expect(handBasketUsed(loaded)).toBe(HAND_BASKET_CAPACITY);
    expect(farmOf(loaded).handBasket.destination).toBe('barn');
    expect(farmOf(loaded).handBasket.crops).toEqual({ crop_corn: 24 });
  });
});
