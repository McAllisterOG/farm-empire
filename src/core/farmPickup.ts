import type { ActionResult, GameState } from './types';
import { fail } from './types';
import { farmCropDefOrNull } from './registry';
import { farmOf, storageUsed, syncCashMirror } from './farmBusiness';
import { recordFarmStat } from './farmKnowledge';

import { PICKUP_BASE_CARGO_CAPACITY, PICKUP_TRAILER_CARGO_CAPACITY, pickupAtCargoPad } from './farmPickupData';
import { formatFarmCapacity, formatFarmCargoWeight } from './farmCargoScale';
import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY, COUNTY_PANTRY_CORN_ORDER } from '../data/townWorkOrders.data';

export { PICKUP_BASE_CARGO_CAPACITY, PICKUP_TRAILER_CARGO_CAPACITY } from './farmPickupData';

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInt(value: unknown): number {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : 0;
}


export function pickupCropUnits(state: GameState, cropId: string): number {
  return farmOf(state).pickup.cargo.crops[cropId] ?? 0;
}

export function pickupSeedUnits(state: GameState, cropId: string): number {
  return farmOf(state).pickup.cargo.seeds[cropId] ?? 0;
}

export function pickupCargoUsed(state: GameState): number {
  const cargo = farmOf(state).pickup.cargo;
  let used = Object.values(cargo.seeds).reduce((sum, count) => sum + nonNegativeInt(count), 0);
  for (const [cropId, count] of Object.entries(cargo.crops)) {
    const def = farmCropDefOrNull(cropId);
    if (def) used += nonNegativeInt(count) * def.storageUnitsPerItem;
  }
  return used;
}

export function pickupCargoCapacity(state: GameState): number {
  return farmOf(state).equipment.countyUtilityTrailerOwned
    ? PICKUP_TRAILER_CARGO_CAPACITY
    : PICKUP_BASE_CARGO_CAPACITY;
}

export function pickupCargoRemaining(state: GameState): number {
  return Math.max(0, pickupCargoCapacity(state) - pickupCargoUsed(state));
}

/** Maximum seed bags the town shop can sell right now, bounded by cash and cargo space. */
export function maxTownSeedPurchase(state: GameState, cropId: string, pickupPresent: boolean): number {
  if (!pickupPresent) return 0;
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return 0;
  const unlocked = def.unlock === 'starter'
    || (def.unlock === 'county-order' && farm.townContact.status === 'completed')
    || (def.unlock === 'north-parcel' && farm.parcels.northOwned)
    || (def.unlock === 'barn-loft' && farm.equipment.barnLoftExpansionOwned);
  if (!unlocked) return 0;
  return Math.max(0, Math.min(pickupCargoRemaining(state), Math.floor(farm.cashCents / def.seedPriceCents)));
}

/** Authoritative per-crop maximums for cargo-panel All actions. */
export function maxBarnCropLoadToPickup(state: GameState, cropId: string): number {
  const def = farmCropDefOrNull(cropId);
  if (!def || !pickupIsAtCargoPad(state)) return 0;
  return Math.max(0, Math.min(farmOf(state).storage[cropId] ?? 0, Math.floor(pickupCargoRemaining(state) / def.storageUnitsPerItem)));
}

export function maxPickupCropUnloadToBarn(state: GameState, cropId: string): number {
  const def = farmCropDefOrNull(cropId);
  if (!def || !pickupIsAtCargoPad(state)) return 0;
  return Math.max(0, Math.min(pickupCropUnits(state, cropId), Math.floor(Math.max(0, farmOf(state).storageCapacity - storageUsed(state)) / def.storageUnitsPerItem)));
}

export function maxFarmSeedLoadToPickup(state: GameState, cropId: string): number {
  if (!farmCropDefOrNull(cropId) || !pickupIsAtCargoPad(state)) return 0;
  return Math.max(0, Math.min(farmOf(state).seeds[cropId] ?? 0, pickupCargoRemaining(state)));
}

export function maxPickupSeedUnloadToFarm(state: GameState, cropId: string): number {
  if (!farmCropDefOrNull(cropId) || !pickupIsAtCargoPad(state)) return 0;
  return Math.max(0, pickupSeedUnits(state, cropId));
}

export function pickupHasCargo(state: GameState): boolean {
  return pickupCargoUsed(state) > 0;
}

export function pickupIsAtCargoPad(state: GameState): boolean {
  return pickupAtCargoPad(farmOf(state).pickup);
}

export type FarmQuantityBatch = Readonly<Record<string, number>>;
export interface FarmBatchPlan {
  readonly quantities: Record<string, number>;
  readonly used: number;
  readonly capacity: number;
  readonly snapshot: string;
}

function batchSnapshot(state: GameState, source: 'barn' | 'pickup'): string {
  const farm = farmOf(state);
  const values = Object.keys(farm.storage).sort().map((id) => `${id}:${farm.storage[id] ?? 0}`);
  const cargo = Object.keys(farm.pickup.cargo.crops).sort().map((id) => `${id}:${farm.pickup.cargo.crops[id] ?? 0}`);
  return `${source}|${values.join(',')}|${cargo.join(',')}|${storageUsed(state)}|${pickupCargoUsed(state)}|${farm.storageCapacity}|${pickupCargoCapacity(state)}`;
}

function cleanBatch(batch: FarmQuantityBatch): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [cropId, value] of Object.entries(batch)) if (Number.isSafeInteger(value) && value > 0) result[cropId] = value;
  return result;
}

export function preflightLoadBarnBatch(state: GameState, batch: FarmQuantityBatch): { ok: true; plan: FarmBatchPlan } | { ok: false; reason: string } {
  const pad = requireCargoPad(state); if (pad) return { ok: false, reason: pad.reason ?? 'Park the pickup at the barn cargo pad.' };
  const quantities = cleanBatch(batch); let used = 0;
  for (const [cropId, count] of Object.entries(quantities)) {
    const def = farmCropDefOrNull(cropId); if (!def) return { ok: false, reason: 'Unknown crop.' };
    if (count > (farmOf(state).storage[cropId] ?? 0)) return { ok: false, reason: `Not enough ${def.name} in the barn.` };
    used += count * def.storageUnitsPerItem;
  }
  if (used > pickupCargoRemaining(state)) return { ok: false, reason: `Pickup has ${formatFarmCapacity(pickupCargoUsed(state), pickupCargoCapacity(state))} capacity; this load is too large.` };
  return { ok: true, plan: { quantities, used, capacity: pickupCargoCapacity(state), snapshot: batchSnapshot(state, 'barn') } };
}

export function commitLoadBarnBatch(state: GameState, plan: FarmBatchPlan): ActionResult {
  const fresh = preflightLoadBarnBatch(state, plan.quantities);
  if (!fresh.ok || fresh.plan.snapshot !== plan.snapshot) return fail('The barn or pickup changed. Review the load amounts and try again.');
  const farm = farmOf(state);
  for (const [cropId, count] of Object.entries(plan.quantities)) {
    farm.storage[cropId] = (farm.storage[cropId] ?? 0) - count;
    farm.pickup.cargo.crops[cropId] = pickupCropUnits(state, cropId) + count;
  }
  recordFarmStat(state, 'farmCargoLoads'); recordFarmStat(state, 'farmCargoUnitsMoved', plan.used);
  return { ok: true, events: [{ type: 'toast', target: 'Produce loaded into the pickup.' }] };
}

export function maxPickupCropSale(state: GameState, cropId: string): number {
  const owned = pickupCropUnits(state, cropId);
  const farm = farmOf(state);
  let reserved = 0;
  if (farm.townContact.status === 'active' && cropId === COUNTY_PANTRY_CORN_ORDER.cropId) reserved += COUNTY_PANTRY_CORN_ORDER.requiredUnits;
  if (farm.countyKitchen.status === 'active') reserved += COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo[cropId as keyof typeof COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo] ?? 0;
  if (farm.countyFreight.active?.cropId === cropId) reserved += farm.countyFreight.active.requiredUnits;
  return Math.max(0, owned - reserved);
}

export function reservedMarketCropUnits(state: GameState, cropId: string): number {
  return pickupCropUnits(state, cropId) - maxPickupCropSale(state, cropId);
}

export function sellPickupCropBatch(state: GameState, batch: FarmQuantityBatch, pickupPresent: boolean): ActionResult {
  const blocked = requireFarmPickup(state, 'town', pickupPresent); if (blocked) return blocked;
  const quantities = cleanBatch(batch); let totalCents = 0;
  for (const [cropId, count] of Object.entries(quantities)) {
    const def = farmCropDefOrNull(cropId); if (!def) return fail('Unknown crop.');
    if (count > maxPickupCropSale(state, cropId)) return fail(`${def.name} includes produce reserved for a County obligation.`);
    totalCents += (farmOf(state).market.quotes[cropId]?.currentCents ?? 0) * count;
  }
  const farm = farmOf(state);
  for (const [cropId, count] of Object.entries(quantities)) farm.pickup.cargo.crops[cropId] = pickupCropUnits(state, cropId) - count;
  const moved = Object.values(quantities).reduce((sum, count) => sum + count, 0);
  farm.cashCents += totalCents; recordFarmStat(state, 'itemsSold', moved); recordFarmStat(state, 'farmCashEarnedCents', totalCents); syncCashMirror(state);
  return { ok: true, events: [{ type: 'sell', target: 'batch', amount: moved, data: totalCents }] };
}

function requireCargoPad(state: GameState): ActionResult | null {
  return pickupIsAtCargoPad(state) ? null : fail('Park the pickup at the barn cargo pad to transfer cargo.');
}

function requireFarmPickup(state: GameState, context: 'farm' | 'town', pickupPresent = true): ActionResult | null {
  if (!pickupPresent) return fail('Bring the old pickup to use cargo services.');
  if (context !== 'farm' && context !== 'town') return fail('The pickup is unavailable here.');
  return null;
}

export function loadBarnCropToPickup(state: GameState, cropId: string, count: number): ActionResult {
  const pad = requireCargoPad(state); if (pad) return pad;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = farm.storage[cropId] ?? 0;
  if (count > owned) return fail(`Only ${owned} ${def.name} item${owned === 1 ? '' : 's'} are in the barn.`);
  const needed = count * def.storageUnitsPerItem;
  if (needed > pickupCargoRemaining(state)) return fail(`Pickup needs ${formatFarmCargoWeight(needed)} of open payload.`);
  farm.storage[cropId] = owned - count;
  farm.pickup.cargo.crops[cropId] = pickupCropUnits(state, cropId) + count;
  recordFarmStat(state, 'farmCargoLoads');
  recordFarmStat(state, 'farmCargoUnitsMoved', needed);
  return { ok: true, events: [{ type: 'toast', target: `Loaded ${count} ${def.name} into the pickup.` }] };
}

export function unloadPickupCropToBarn(state: GameState, cropId: string, count: number): ActionResult {
  const pad = requireCargoPad(state); if (pad) return pad;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = pickupCropUnits(state, cropId);
  if (count > owned) return fail(`Only ${owned} ${def.name} item${owned === 1 ? '' : 's'} are in the pickup.`);
  const needed = count * def.storageUnitsPerItem;
  if (storageUsed(state) + needed > farm.storageCapacity) return fail(`Barn needs ${formatFarmCargoWeight(needed)} of open storage.`);
  farm.pickup.cargo.crops[cropId] = owned - count;
  farm.storage[cropId] = (farm.storage[cropId] ?? 0) + count;
  return { ok: true, events: [{ type: 'toast', target: `Unloaded ${count} ${def.name} into the barn.` }] };
}

export const unloadCropFromPickup = unloadPickupCropToBarn;

export function loadFarmSeedsToPickup(state: GameState, cropId: string, count: number): ActionResult {
  const pad = requireCargoPad(state); if (pad) return pad;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = farm.seeds[cropId] ?? 0;
  if (count > owned) return fail(`Only ${owned} ${def.name} seed${owned === 1 ? '' : 's'} are in farm inventory.`);
  if (count > pickupCargoRemaining(state)) return fail(`Pickup needs ${formatFarmCargoWeight(count)} of open payload.`);
  farm.seeds[cropId] = owned - count;
  farm.pickup.cargo.seeds[cropId] = pickupSeedUnits(state, cropId) + count;
  recordFarmStat(state, 'farmCargoLoads');
  recordFarmStat(state, 'farmCargoUnitsMoved', count);
  return { ok: true, events: [{ type: 'toast', target: `Loaded ${count} ${def.name} seed${count === 1 ? '' : 's'} into the pickup.` }] };
}

export function unloadPickupSeedsToFarm(state: GameState, cropId: string, count: number): ActionResult {
  const pad = requireCargoPad(state); if (pad) return pad;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = pickupSeedUnits(state, cropId);
  if (count > owned) return fail(`Only ${owned} ${def.name} seed${owned === 1 ? '' : 's'} are in the pickup.`);
  farm.pickup.cargo.seeds[cropId] = owned - count;
  farm.seeds[cropId] = (farm.seeds[cropId] ?? 0) + count;
  return { ok: true, events: [{ type: 'toast', target: `Unloaded ${count} ${def.name} seed${count === 1 ? '' : 's'} at the farm.` }] };
}

export function buyTownSeedsIntoPickup(state: GameState, cropId: string, count: number, pickupPresent: boolean): ActionResult {
  const blocked = requireFarmPickup(state, 'town', pickupPresent);
  if (blocked) return blocked;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  if (def.unlock !== 'starter' && !((def.unlock === 'county-order' && farm.townContact.status === 'completed') || (def.unlock === 'north-parcel' && farm.parcels.northOwned) || (def.unlock === 'barn-loft' && farm.equipment.barnLoftExpansionOwned))) return fail(`${def.name} is still locked.`);
  const cost = def.seedPriceCents * count;
  if (farm.cashCents < cost) return fail('Not enough cash for those seeds.');
  if (count > pickupCargoRemaining(state)) return fail(`Pickup needs ${formatFarmCargoWeight(count)} of open payload.`);
  farm.cashCents -= cost;
  farm.pickup.cargo.seeds[cropId] = pickupSeedUnits(state, cropId) + count;
  recordFarmStat(state, 'farmCashSpentCents', cost);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `Bought ${count} ${def.name} seed${count === 1 ? '' : 's'} into the pickup.` }] };
}

export function sellPickupCrop(state: GameState, cropId: string, count: number, pickupPresent: boolean): ActionResult {
  const blocked = requireFarmPickup(state, 'town', pickupPresent);
  if (blocked) return blocked;
  if (!validCount(count)) return fail('Choose a positive whole quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = pickupCropUnits(state, cropId);
  if (count > owned) return fail(`Only ${owned} ${def.name} item${owned === 1 ? '' : 's'} are in the pickup.`);
  const quote = farm.market.quotes[cropId];
  const totalCents = quote.currentCents * count;
  farm.pickup.cargo.crops[cropId] = owned - count;
  farm.cashCents += totalCents;
  recordFarmStat(state, 'itemsSold', count);
  recordFarmStat(state, 'farmCashEarnedCents', totalCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'sell', target: cropId, amount: count, data: totalCents }] };
}
