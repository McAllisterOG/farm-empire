import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_PANTRY_CORN_ORDER } from '../src/data/townWorkOrders.data';
import { BARN_LOFT_EXPANSION, COUNTY_GRAIN_SILO, COUNTY_ROW_CROP_FIELD_KIT, COUNTY_UTILITY_TRAILER, OLD_TRACTOR_RESTORATION } from '../src/data/farmEquipment.data';
import { FIRST_FARMHAND, FIRST_FARM_MANAGER } from '../src/data/farmWorkforce.data';
import { ROADSIDE_PRODUCE_STAND } from '../src/data/farmRoadsideStand.data';
import { farmCropStage, farmOf, purchaseBarnLoftExpansion, purchaseCountyGrainSilo, purchaseCountyRowCropFieldKit, purchaseCountyUtilityTrailer, purchaseNeighborParcel, restoreOldTractor, sellStoredCrop, storageUsed, tillFarmField, waterFarmCrop, plantFarmCrop, buyFarmSeeds, harvestFarmCrop } from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import { createFarmGame } from '../src/core/state';
import { harvestFarmCropToBasket, unloadHandBasket } from '../src/core/farmHarvestBasket';
import { loadBarnCropToPickup, pickupCargoCapacity, pickupCargoUsed, unloadPickupCropToBarn } from '../src/core/farmPickup';
import { acceptCountyFreightOffer, countyFreightOffers, fulfillCountyFreightContract } from '../src/core/farmCountyFreight';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder, townContact } from '../src/core/farmTownContact';
import { fulfillRoadsideStandOrder, purchaseRoadsideStand, roadsideStandOrder } from '../src/core/farmRoadsideStand';
import { hireFarmManager, hireFirstFarmhand, planFarmManagerDispatch, updateFarmManagerPlan } from '../src/core/farmWorkforce';
import { deserialize, serialize } from '../src/save/save';
import { boundedRenderScale, MAX_RENDER_PIXELS, shouldRenderFarmFrame } from '../src/render/renderResolution';
import { NOW } from './helpers';

type FarmState = ReturnType<typeof createFarmGame>;
function expectOk(result: { ok: boolean; reason?: string }): void { expect(result.ok, result.reason).toBe(true); }
function snapshot(state: FarmState): string {
  const farm = farmOf(state);
  const compact = (inventory: Record<string, number>) => Object.fromEntries(Object.entries(inventory).filter(([, count]) => count > 0));
  return JSON.stringify({ cash: farm.cashCents, storage: compact(farm.storage), pickup: { crops: compact(farm.pickup.cargo.crops), seeds: compact(farm.pickup.cargo.seeds) }, basket: { ...farm.handBasket, crops: compact(farm.handBasket.crops) }, capacity: farm.storageCapacity, equipment: farm.equipment, parcels: farm.parcels, town: farm.townContact, freight: farm.countyFreight, workforce: farm.workforce, stand: farm.roadsideStand });
}
function expectUnchanged(state: FarmState, before: string): void { expect(snapshot(state)).toBe(before); }

function establishCorn(state: FarmState, index: number, plantedAt: number): void {
  const plot = state.plots[index];
  expectOk(tillFarmField(state, plot.uid)); expectOk(plantFarmCrop(state, plot.uid, 'crop_corn', plantedAt, 'manual'));
  expect(farmCropStage(plot.crop, plantedAt)).toBe('needs-water'); expectOk(waterFarmCrop(state, plot.uid, plantedAt + 1));
  const readyAt = plantedAt + farmCropDef('crop_corn').growMs + 2;
  expect(farmCropStage(plot.crop, readyAt)).toBe('ready'); expectOk(harvestFarmCropToBasket(state, plot.uid, readyAt)); expectOk(unloadHandBasket(state, 'pickup', true));
}

/** Repeats public production and market transactions only; it never injects cash or inventory. */
function produce(state: FarmState, cropId: string, units: number, sell = false): void {
  const plot = state.plots[2]; const crop = farmCropDef(cropId); let produced = 0; let cycle = 0;
  while (produced < units) {
    const plantedAt = NOW + 1_000_000 + cycle * 1_000_000;
    expectOk(buyFarmSeeds(state, cropId, 1)); expectOk(tillFarmField(state, plot.uid)); expectOk(plantFarmCrop(state, plot.uid, cropId, plantedAt, 'manual'));
    expectOk(waterFarmCrop(state, plot.uid, plantedAt + 1)); expectOk(harvestFarmCrop(state, plot.uid, plantedAt + crop.growMs + 2, 'manual'));
    produced += crop.harvestYield;
    if (sell) expectOk(sellStoredCrop(state, cropId, crop.harvestYield));
    cycle += 1;
  }
}

function earnTo(state: FarmState, cents: number, cropId = 'crop_corn'): void {
  const crop = farmCropDef(cropId); expect(crop.harvestYield * crop.basePriceCents - crop.seedPriceCents).toBeGreaterThan(0);
  while (farmOf(state).cashCents < cents) produce(state, cropId, crop.harvestYield, true);
}
function afford(state: FarmState, priceCents: number): void { earnTo(state, priceCents + 2_600); }

function assertSound(state: FarmState): void {
  const farm = farmOf(state);
  expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100)); expect(farm.cashCents).toBeGreaterThanOrEqual(0);
  expect(storageUsed(state)).toBeLessThanOrEqual(farm.storageCapacity); expect(pickupCargoUsed(state)).toBeLessThanOrEqual(pickupCargoCapacity(state));
  for (const inventory of [farm.seeds, farm.storage, farm.pickup.cargo.seeds, farm.pickup.cargo.crops, farm.handBasket.crops]) expect(Object.values(inventory).every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
}

describe('Long-session progression assurance', () => {
  it('keeps the actual fresh-farm to commercial-services path recoverable across reloads', () => {
    const state = createFarmGame('Long Session', 8_021, NOW); const farm = farmOf(state); let before = snapshot(state);
    expect(fulfillCountyWorkOrder(state, { source: 'pickup', pickupPresent: true }).ok).toBe(false); expectUnchanged(state, before);
    before = snapshot(state); expect(acceptCountyFreightOffer(state).ok).toBe(false); expectUnchanged(state, before);
    before = snapshot(state); expect(purchaseRoadsideStand(state).ok).toBe(false); expectUnchanged(state, before);

    offerCountyWorkOrder(state); expectOk(acceptCountyWorkOrder(state)); establishCorn(state, 0, NOW); establishCorn(state, 1, NOW + 100_000);
    const cashBeforeOrder = farm.cashCents; expectOk(fulfillCountyWorkOrder(state, { source: 'pickup', pickupPresent: true }));
    expect(townContact(state).status).toBe('completed'); expect(farm.pickup.cargo.crops.crop_corn).toBe(4); expect(farm.cashCents).toBe(cashBeforeOrder + COUNTY_PANTRY_CORN_ORDER.payoutCents);
    before = snapshot(state); expect(fulfillCountyWorkOrder(state, { source: 'pickup', pickupPresent: true }).ok).toBe(false); expectUnchanged(state, before);

    expectOk(unloadPickupCropToBarn(state, 'crop_corn', 4)); afford(state, 425_000); expectOk(purchaseNeighborParcel(state));
    before = snapshot(state); expect(purchaseNeighborParcel(state).ok).toBe(false); expectUnchanged(state, before);
    afford(state, OLD_TRACTOR_RESTORATION.priceCents); expectOk(restoreOldTractor(state)); before = snapshot(state); expect(restoreOldTractor(state).ok).toBe(false); expectUnchanged(state, before);
    afford(state, COUNTY_ROW_CROP_FIELD_KIT.priceCents); expectOk(purchaseCountyRowCropFieldKit(state)); before = snapshot(state); expect(purchaseCountyUtilityTrailer(state).ok).toBe(false); expectUnchanged(state, before);
    afford(state, BARN_LOFT_EXPANSION.priceCents); expectOk(purchaseBarnLoftExpansion(state));

    const offer = countyFreightOffers(state)[0]!; produce(state, offer.cropId, offer.requiredUnits); expectOk(acceptCountyFreightOffer(state, offer.id)); expectOk(loadBarnCropToPickup(state, offer.cropId, offer.requiredUnits));
    const freightCash = farm.cashCents; expectOk(fulfillCountyFreightContract(state, { source: 'pickup', pickupPresent: true })); expect(farm.cashCents).toBe(freightCash + offer.payoutCents);
    before = snapshot(state); expect(fulfillCountyFreightContract(state, { source: 'pickup', pickupPresent: true }).ok).toBe(false); expectUnchanged(state, before);

    afford(state, COUNTY_UTILITY_TRAILER.priceCents); expectOk(purchaseCountyUtilityTrailer(state)); expect(pickupCargoCapacity(state)).toBe(COUNTY_UTILITY_TRAILER.toCapacity);
    before = snapshot(state); expect(purchaseCountyUtilityTrailer(state).ok).toBe(false); expectUnchanged(state, before);
    afford(state, COUNTY_GRAIN_SILO.priceCents); expectOk(purchaseCountyGrainSilo(state)); expect(farm.storageCapacity).toBe(COUNTY_GRAIN_SILO.toCapacity);
    before = snapshot(state); expect(hireFarmManager(state).ok).toBe(false); expectUnchanged(state, before);
    afford(state, FIRST_FARMHAND.hirePriceCents); expectOk(hireFirstFarmhand(state)); afford(state, FIRST_FARM_MANAGER.hirePriceCents); expectOk(hireFarmManager(state));
    before = snapshot(state); expect(hireFarmManager(state).ok).toBe(false); expectUnchanged(state, before); expectOk(updateFarmManagerPlan(state, { enabled: true, parcelId: 'north', cropId: 'crop_corn' })); expect(planFarmManagerDispatch(state, NOW).targetPlotUids.length).toBeGreaterThan(0);

    afford(state, ROADSIDE_PRODUCE_STAND.priceCents); expectOk(purchaseRoadsideStand(state)); before = snapshot(state); expect(purchaseRoadsideStand(state).ok).toBe(false); expectUnchanged(state, before);
    const standOrder = roadsideStandOrder(state)!; produce(state, standOrder.cropId, standOrder.requiredUnits); const standCash = farm.cashCents; expectOk(fulfillRoadsideStandOrder(state, standOrder.id)); expect(farm.cashCents).toBe(standCash + standOrder.payoutCents);
    before = snapshot(state); expect(fulfillRoadsideStandOrder(state, standOrder.id).ok).toBe(false); expectUnchanged(state, before); assertSound(state);

    const beforeReload = snapshot(state); const reloaded = deserialize(serialize(state, NOW + 10_000), NOW + 86_410_000); expect(snapshot(reloaded)).toBe(beforeReload); assertSound(reloaded);
  });

  it('pauses an in-progress crop across a long reload and retains dense-field frame bounds', () => {
    const state = createFarmGame('Paused Session', 8_022, NOW); const plot = state.plots[0];
    expectOk(tillFarmField(state, plot.uid)); expectOk(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'manual')); expectOk(waterFarmCrop(state, plot.uid, NOW + 1));
    const loaded = deserialize(serialize(state, NOW + 10_000), NOW + 7 * 24 * 60 * 60_000); expect(farmCropStage(loaded.plots[0].crop, NOW + 7 * 24 * 60 * 60_000)).toBe('growing');
    const scale = boundedRenderScale(7_680, 4_320, 2); expect(7_680 * 4_320 * scale * scale).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1); expect(shouldRenderFarmFrame(100, 120)).toBe(false); expect(shouldRenderFarmFrame(100, 134)).toBe(true);
  });
});
