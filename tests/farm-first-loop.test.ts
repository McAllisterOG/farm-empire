import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmCropDef } from '../src/core/registry';
import { farmOf, farmCropStage, storageUsed, tillFarmField, plantFarmCrop, waterFarmCrop } from '../src/core/farmBusiness';
import { harvestFarmCropToBasket, unloadHandBasket, handBasketUsed } from '../src/core/farmHarvestBasket';
import { pickupCargoCapacity, pickupCargoUsed, pickupCropUnits } from '../src/core/farmPickup';
import { acceptCountyWorkOrder, countyPickupWorkOrderProgress, fulfillCountyWorkOrder, offerCountyWorkOrder, townContact } from '../src/core/farmTownContact';
import { COUNTY_PANTRY_CORN_ORDER } from '../src/data/townWorkOrders.data';
import { NOW } from './helpers';

function establishAndHarvest(state: ReturnType<typeof createFarmGame>, plotIndex: number, cropId: string, plantedAt: number): void {
  const plot = state.plots[plotIndex];
  expect(tillFarmField(state, plot.uid).ok).toBe(true);
  expect(plantFarmCrop(state, plot.uid, cropId, plantedAt, 'manual').ok).toBe(true);
  expect(farmCropStage(plot.crop, plantedAt)).toBe('needs-water');
  expect(waterFarmCrop(state, plot.uid, plantedAt + 1).ok).toBe(true);
  const readyAt = plantedAt + 1 + farmCropDef(cropId).growMs + 1;
  expect(farmCropStage(plot.crop, readyAt)).toBe('ready');
  expect(harvestFarmCropToBasket(state, plot.uid, readyAt).ok).toBe(true);
}

describe('Farm Empire first-loop reliability', () => {
  it('completes the basket-to-pickup County Pantry loop once, then remains sound for a repeat crop cycle', () => {
    const state = createFarmGame('First Loop', 402, NOW);
    const farm = farmOf(state);
    const openingCash = farm.cashCents;
    offerCountyWorkOrder(state); expect(acceptCountyWorkOrder(state).ok).toBe(true);

    establishAndHarvest(state, 0, 'crop_corn', NOW);
    expect(handBasketUsed(state)).toBe(8);
    expect(unloadHandBasket(state, 'pickup', true).ok).toBe(true);
    establishAndHarvest(state, 1, 'crop_corn', NOW + 100_000);
    expect(unloadHandBasket(state, 'pickup', true).ok).toBe(true);
    expect(countyPickupWorkOrderProgress(state, true)).toEqual({ storedUnits: 16, requiredUnits: 12 });

    expect(fulfillCountyWorkOrder(state, { source: 'pickup', pickupPresent: true }).ok).toBe(true);
    expect(townContact(state).status).toBe('completed');
    expect(pickupCropUnits(state, 'crop_corn')).toBe(4);
    expect(farm.cashCents).toBe(openingCash + COUNTY_PANTRY_CORN_ORDER.payoutCents);
    expect(fulfillCountyWorkOrder(state, { source: 'pickup', pickupPresent: true }).ok).toBe(false);
    expect(farm.cashCents).toBe(openingCash + COUNTY_PANTRY_CORN_ORDER.payoutCents);

    establishAndHarvest(state, 2, 'crop_wheat', NOW + 250_000);
    expect(unloadHandBasket(state, 'barn').ok).toBe(true);
    expect(farm.storage.crop_wheat).toBe(farmCropDef('crop_wheat').harvestYield);
    expect(handBasketUsed(state)).toBe(0);
    expect(storageUsed(state)).toBeLessThanOrEqual(farm.storageCapacity);
    expect(pickupCargoUsed(state)).toBeLessThanOrEqual(pickupCargoCapacity(state));
    for (const inventory of [farm.seeds, farm.storage, farm.pickup.cargo.crops, farm.pickup.cargo.seeds]) {
      expect(Object.values(inventory).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    }
  });
});
