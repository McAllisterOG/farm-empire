import { COUNTY_PANTRY_CORN_ORDER } from '../data/townWorkOrders.data';
import type { ActionResult, FarmTownContactState, GameState } from './types';
import { fail } from './types';
import { farmOf, syncCashMirror } from './farmBusiness';

export function townContact(state: GameState): FarmTownContactState {
  return farmOf(state).townContact;
}

/** First conversation persists as an offer, even if the farmer leaves without accepting. */
export function offerCountyWorkOrder(state: GameState): ActionResult {
  const contact = townContact(state);
  if (contact.status === 'unmet') contact.status = 'offered';
  return { ok: true };
}

export function acceptCountyWorkOrder(state: GameState): ActionResult {
  const contact = townContact(state);
  if (contact.status === 'completed') return fail('The County Pantry order is already complete.');
  if (contact.status === 'unmet') return fail('Speak with Mae Carter at Farm Services before accepting a County order.');
  if (contact.status === 'offered') contact.status = 'active';
  return { ok: true, events: [{ type: 'toast', target: 'County work order accepted. Deliver 12 corn to Eli at the Grain Exchange.' }] };
}

export function countyWorkOrderProgress(state: GameState): { storedUnits: number; requiredUnits: number } {
  return { storedUnits: farmOf(state).storage[COUNTY_PANTRY_CORN_ORDER.cropId] ?? 0, requiredUnits: COUNTY_PANTRY_CORN_ORDER.requiredUnits };
}

/** Atomically trades the exact stored crop requirement for the one-time fixed county payout. */
export function fulfillCountyWorkOrder(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'active') return fail('There is no active County Pantry order to deliver.');
  const stored = farm.storage[COUNTY_PANTRY_CORN_ORDER.cropId] ?? 0;
  if (stored < COUNTY_PANTRY_CORN_ORDER.requiredUnits) {
    return fail(`The County Pantry needs ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} stored corn before delivery.`);
  }
  farm.storage[COUNTY_PANTRY_CORN_ORDER.cropId] = stored - COUNTY_PANTRY_CORN_ORDER.requiredUnits;
  farm.cashCents += COUNTY_PANTRY_CORN_ORDER.payoutCents;
  farm.townContact.status = 'completed';
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'County Pantry order delivered. $85.00 received.' }] };
}
