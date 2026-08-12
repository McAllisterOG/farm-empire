import { COUNTY_FREIGHT_PREMIUM_BPS, COUNTY_FREIGHT_TEMPLATES, type CountyFreightTemplate } from '../data/countyFreight.data';
import type { ActionResult, FarmCountyFreightContract, GameState } from './types';
import { fail } from './types';
import { farmOf, isFarmCropUnlocked, syncCashMirror } from './farmBusiness';
import { pickupCropUnits } from './farmPickup';
import { farmCropDef } from './registry';
import { hashSeed, mulberry32 } from './rng';
import { recordFarmStat } from './farmKnowledge';

export interface CountyFreightContext {
  pickupPresent: boolean;
  source: 'pickup';
}

export interface CountyFreightBoardState {
  unlocked: boolean;
  offer: FarmCountyFreightContract | null;
  active: FarmCountyFreightContract | null;
  completedToday: boolean;
}

function eligibleTemplates(state: GameState): CountyFreightTemplate[] {
  return COUNTY_FREIGHT_TEMPLATES
    .filter((template) => isFarmCropUnlocked(state, template.cropId))
    .sort((a, b) => a.cropId.localeCompare(b.cropId));
}

/** A stable offer for one world seed + saved farm day. It does not mutate state. */
export function countyFreightOffer(state: GameState): FarmCountyFreightContract | null {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed' || farm.countyFreight.active) return null;
  if (farm.countyFreight.lastCompletedDay >= farm.clock.day) return null;
  const candidates = eligibleTemplates(state);
  if (candidates.length === 0) return null;
  const rng = mulberry32(hashSeed(`${state.seed}:county-freight:${farm.clock.day}`));
  const template = candidates[Math.floor(rng() * candidates.length) % candidates.length];
  const quote = farm.market.quotes[template.cropId]?.currentCents ?? farmCropDef(template.cropId).basePriceCents;
  const payoutCents = Math.max(1, Math.round(template.requiredUnits * quote * (10_000 + COUNTY_FREIGHT_PREMIUM_BPS) / 10_000));
  return {
    id: `county-freight-${farm.clock.day}-${template.cropId}`,
    issuedDay: farm.clock.day,
    cropId: template.cropId,
    requiredUnits: template.requiredUnits,
    payoutCents,
  };
}

export function countyFreightBoardState(state: GameState): CountyFreightBoardState {
  const farm = farmOf(state);
  const unlocked = farm.townContact.status === 'completed';
  return {
    unlocked,
    offer: unlocked ? countyFreightOffer(state) : null,
    active: unlocked ? farm.countyFreight.active : null,
    completedToday: unlocked && !farm.countyFreight.active && farm.countyFreight.lastCompletedDay >= farm.clock.day,
  };
}

export function acceptCountyFreightOffer(state: GameState, expectedOfferId?: string): ActionResult {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed') return fail('Complete the first County Pantry delivery before taking freight work.');
  if (farm.countyFreight.active) return fail('Finish the active County freight contract first.');
  const offer = countyFreightOffer(state);
  if (!offer) return fail('No new County freight offer is available today.');
  if (expectedOfferId && offer.id !== expectedOfferId) return fail('That Freight Board offer has expired. Review today\'s new route before accepting.');
  farm.countyFreight.active = { ...offer };
  const crop = farmCropDef(offer.cropId);
  return { ok: true, events: [{ type: 'toast', target: `${crop.name} freight contract accepted. Load ${offer.requiredUnits} units into the pickup.` }] };
}

export function countyFreightProgress(state: GameState, context?: CountyFreightContext): { loadedUnits: number; requiredUnits: number } {
  const active = farmOf(state).countyFreight.active;
  const loadedUnits = active && context?.source === 'pickup' && context.pickupPresent
    ? pickupCropUnits(state, active.cropId) : 0;
  return { loadedUnits, requiredUnits: active?.requiredUnits ?? 0 };
}

/** Consumes only pickup cargo and retires the saved contract before paying. */
export function fulfillCountyFreightContract(state: GameState, context?: CountyFreightContext): ActionResult {
  const farm = farmOf(state);
  const active = farm.countyFreight.active;
  if (!active) return fail('There is no active County freight contract.');
  if (!context || context.source !== 'pickup' || context.pickupPresent !== true) return fail('Bring the old pickup to the County Grain Exchange before delivery.');
  const loaded = pickupCropUnits(state, active.cropId);
  const crop = farmCropDef(active.cropId);
  if (loaded < active.requiredUnits) return fail(`Load ${active.requiredUnits} ${crop.name} units into the pickup before delivery.`);

  farm.pickup.cargo.crops[active.cropId] = loaded - active.requiredUnits;
  farm.countyFreight.active = null;
  farm.countyFreight.lastCompletedDay = farm.clock.day;
  farm.cashCents += active.payoutCents;
  recordFarmStat(state, 'farmDeliveries');
  recordFarmStat(state, 'itemsSold', active.requiredUnits);
  recordFarmStat(state, 'farmCashEarnedCents', active.payoutCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `${crop.name} freight delivered. $${(active.payoutCents / 100).toFixed(2)} received.` }] };
}
