import type { ActionResult, FarmHarvestDestination, GameState } from './types';
import { fail } from './types';
import { farmCropDefOrNull } from './registry';
import {
  farmCropStage, farmOf, isFarmCropWithered, isOwnedFieldTile, pinnedFarmHarvestYield, storageRemaining,
} from './farmBusiness';
import { pickupCargoRemaining } from './farmPickup';
import { recordFarmStat } from './farmKnowledge';
import { HAND_BASKET_CAPACITY } from './farmHarvestBasketData';
import { formatFarmCargoWeight } from './farmCargoScale';

export { HAND_BASKET_CAPACITY } from './farmHarvestBasketData';

export interface BasketHarvestReadiness {
  ok: boolean;
  reason?: string;
  cropId?: string;
  amount?: number;
  capacityUnits?: number;
}

/** Runtime-only movement must never run alongside a mounted vehicle. */
export function basketInteractionBlockReason(runtime: { operatingTractor: boolean; operatingPickup: boolean }): string | null {
  if (runtime.operatingTractor) return 'Exit the tractor before managing the harvest basket.';
  if (runtime.operatingPickup) return 'Exit the pickup before managing the harvest basket.';
  return null;
}

function nonNegativeInt(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function handBasketCropUnits(state: GameState, cropId: string): number {
  return nonNegativeInt(farmOf(state).handBasket.crops[cropId]);
}

export function handBasketUsed(state: GameState): number {
  const basket = farmOf(state).handBasket;
  let used = 0;
  for (const [cropId, count] of Object.entries(basket.crops)) {
    const def = farmCropDefOrNull(cropId);
    if (def) used += nonNegativeInt(count) * def.storageUnitsPerItem;
  }
  return used;
}

export function handBasketRemaining(state: GameState): number {
  return Math.max(0, HAND_BASKET_CAPACITY - handBasketUsed(state));
}

export function handBasketHasCargo(state: GameState): boolean {
  return handBasketUsed(state) > 0;
}

export function inspectBasketHarvest(state: GameState, plotUid: number, now: number): BasketHarvestReadiness {
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot || !isOwnedFieldTile(state, plot.x, plot.y)) return { ok: false, reason: 'This field is not owned.' };
  if (!plot.crop) return { ok: false, reason: 'There is no crop to harvest.' };
  if (isFarmCropWithered(plot.crop, now)) return { ok: false, reason: 'This crop has withered. Clear it before planting again.' };
  if (farmCropStage(plot.crop, now) !== 'ready') return { ok: false, reason: 'This crop is still growing.' };
  const def = farmCropDefOrNull(plot.crop.defId);
  if (!def) return { ok: false, reason: 'Unknown crop.' };
  const amount = pinnedFarmHarvestYield(plot.crop);
  return { ok: true, cropId: def.id, amount, capacityUnits: amount * def.storageUnitsPerItem };
}

/** Manual harvesting commits to the saved hand basket, never directly to a destination. */
export function harvestFarmCropToBasket(state: GameState, plotUid: number, now: number): ActionResult {
  const readiness = inspectBasketHarvest(state, plotUid, now);
  if (!readiness.ok || !readiness.cropId || !readiness.amount || !readiness.capacityUnits) {
    return fail(readiness.reason ?? 'This crop cannot be harvested.');
  }
  if (readiness.capacityUnits > handBasketRemaining(state)) {
    return fail(`Basket needs ${formatFarmCargoWeight(readiness.capacityUnits)} of open payload. Unload it before harvesting.`);
  }
  const plot = state.plots.find((candidate) => candidate.uid === plotUid)!;
  const farm = farmOf(state);
  farm.handBasket.crops[readiness.cropId] = handBasketCropUnits(state, readiness.cropId) + readiness.amount;
  plot.crop = null;
  farm.fieldConditions[String(plotUid)] = { soil: 'stubble' };
  recordFarmStat(state, 'harvests');
  recordFarmStat(state, 'farmHarvestUnits', readiness.amount);
  return {
    ok: true,
    events: [{ type: 'harvest', target: readiness.cropId, amount: readiness.amount, data: { destination: 'basket' } }],
  };
}

export function setHarvestDestination(state: GameState, destination: FarmHarvestDestination): ActionResult {
  if (destination !== 'barn' && destination !== 'pickup') return fail('Choose the barn or pickup as the harvest destination.');
  farmOf(state).handBasket.destination = destination;
  return { ok: true, events: [{ type: 'toast', target: `Manual harvests will unload into the ${destination}.` }] };
}

/** Transfer the whole basket only after the destination has accepted its full weighted capacity. */
export function unloadHandBasket(
  state: GameState,
  destination: FarmHarvestDestination = farmOf(state).handBasket.destination,
  pickupPresent = true,
): ActionResult {
  const used = handBasketUsed(state);
  if (used <= 0) return fail('The harvest basket is empty.');
  const farm = farmOf(state);
  if (destination === 'barn') {
    if (storageRemaining(state) < used) return fail(`Barn needs ${formatFarmCargoWeight(used)} of open storage before the basket can be unloaded.`);
  } else {
    if (!pickupPresent) return fail('Bring the old pickup back to the farm before unloading the basket into it.');
    if (pickupCargoRemaining(state) < used) return fail(`Pickup needs ${formatFarmCargoWeight(used)} of open payload before the basket can be unloaded.`);
  }

  for (const [cropId, count] of Object.entries(farm.handBasket.crops)) {
    const kept = nonNegativeInt(count);
    if (kept <= 0 || !farmCropDefOrNull(cropId)) continue;
    if (destination === 'barn') farm.storage[cropId] = (farm.storage[cropId] ?? 0) + kept;
    else farm.pickup.cargo.crops[cropId] = (farm.pickup.cargo.crops[cropId] ?? 0) + kept;
  }
  farm.handBasket.crops = {};
  if (destination === 'pickup') {
    recordFarmStat(state, 'farmCargoLoads');
    recordFarmStat(state, 'farmCargoUnitsMoved', used);
  }
  return { ok: true, events: [{ type: 'toast', target: `Basket unloaded into the ${destination}.` }] };
}
