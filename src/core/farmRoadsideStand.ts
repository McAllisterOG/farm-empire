import { ROADSIDE_PRODUCE_STAND } from '../data/farmRoadsideStand.data';
import type { ActionResult, GameState } from './types';
import { fail } from './types';
import { farmOf, isFarmCropUnlocked, syncCashMirror } from './farmBusiness';
import { recordFarmStat } from './farmKnowledge';
import { allFarmCrops, farmCropDef } from './registry';
import { hashSeed, mulberry32 } from './rng';

export interface FarmRoadsideOrder {
  id: string;
  issuedDay: number;
  cropId: string;
  requiredUnits: number;
  payoutCents: number;
}

export interface FarmRoadsideStandView {
  unlocked: boolean;
  owned: boolean;
  completedToday: boolean;
  order: FarmRoadsideOrder | null;
}

export function roadsideStandUnlocked(state: GameState): boolean {
  return farmOf(state).townContact.status === 'completed';
}

/** A stable local request for one world seed and saved farm day. */
export function roadsideStandOrder(state: GameState): FarmRoadsideOrder | null {
  const farm = farmOf(state);
  if (!farm.roadsideStand.owned || farm.roadsideStand.lastCompletedDay >= farm.clock.day) return null;
  const crops = allFarmCrops()
    .filter((crop) => isFarmCropUnlocked(state, crop.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (crops.length === 0) return null;
  const rng = mulberry32(hashSeed(`${state.seed}:roadside-stand:${farm.clock.day}`));
  const crop = crops[Math.floor(rng() * crops.length) % crops.length];
  const span = ROADSIDE_PRODUCE_STAND.maxOrderUnits - ROADSIDE_PRODUCE_STAND.minOrderUnits + 1;
  const requiredUnits = ROADSIDE_PRODUCE_STAND.minOrderUnits + Math.floor(rng() * span);
  const quote = farm.market.quotes[crop.id]?.currentCents ?? crop.basePriceCents;
  const payoutCents = Math.max(1, Math.round(requiredUnits * quote * ROADSIDE_PRODUCE_STAND.localRateBps / 10_000));
  return {
    id: `roadside-order-${farm.clock.day}-${crop.id}`,
    issuedDay: farm.clock.day,
    cropId: crop.id,
    requiredUnits,
    payoutCents,
  };
}

export function roadsideStandView(state: GameState): FarmRoadsideStandView {
  const farm = farmOf(state);
  const unlocked = roadsideStandUnlocked(state);
  const owned = unlocked && farm.roadsideStand.owned;
  const completedToday = owned && farm.roadsideStand.lastCompletedDay >= farm.clock.day;
  return { unlocked, owned, completedToday, order: owned && !completedToday ? roadsideStandOrder(state) : null };
}

export function purchaseRoadsideStand(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!roadsideStandUnlocked(state)) return fail('Complete the first County Pantry delivery before building a roadside stand.');
  if (farm.roadsideStand.owned) return fail('The roadside produce stand is already built.');
  if (farm.cashCents < ROADSIDE_PRODUCE_STAND.priceCents) return fail(`The stand costs $${(ROADSIDE_PRODUCE_STAND.priceCents / 100).toFixed(2)}.`);
  farm.cashCents -= ROADSIDE_PRODUCE_STAND.priceCents;
  farm.roadsideStand.owned = true;
  farm.roadsideStand.lastCompletedDay = 0;
  recordFarmStat(state, 'farmCashSpentCents', ROADSIDE_PRODUCE_STAND.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `${ROADSIDE_PRODUCE_STAND.name} built beside the County road. Today's local order is ready.` }] };
}

/** Consumes only barn inventory and records completion before paying. */
export function fulfillRoadsideStandOrder(state: GameState, expectedOrderId?: string): ActionResult {
  const farm = farmOf(state);
  if (!farm.roadsideStand.owned) return fail('Build the roadside produce stand at Farm Services first.');
  const order = roadsideStandOrder(state);
  if (!order) return fail('Today\'s roadside order is already complete. Check back next farm day.');
  if (expectedOrderId && expectedOrderId !== order.id) return fail('That local request has expired. Review today\'s new stand order.');
  const stored = Math.max(0, Math.floor(farm.storage[order.cropId] ?? 0));
  const crop = farmCropDef(order.cropId);
  if (stored < order.requiredUnits) return fail(`Store ${order.requiredUnits} ${crop.name} units in the barn before filling this order.`);

  farm.storage[order.cropId] = stored - order.requiredUnits;
  farm.roadsideStand.lastCompletedDay = farm.clock.day;
  farm.cashCents += order.payoutCents;
  recordFarmStat(state, 'itemsSold', order.requiredUnits);
  recordFarmStat(state, 'farmCashEarnedCents', order.payoutCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `${crop.name} stocked at the roadside stand. $${(order.payoutCents / 100).toFixed(2)} collected from local customers.` }] };
}
