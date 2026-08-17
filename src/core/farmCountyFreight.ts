import { COUNTY_FREIGHT_BID_COUNT, COUNTY_FREIGHT_BULK_PREMIUM_BPS, COUNTY_FREIGHT_PREMIUM_BPS, COUNTY_FREIGHT_TEMPLATES, countyFreightBulkAllowedUnits, type CountyFreightKind, type CountyFreightTemplate } from '../data/countyFreight.data';
import type { ActionResult, FarmCountyFreightContract, GameState } from './types';
import { fail } from './types';
import { farmOf, isFarmCropUnlocked, syncCashMirror } from './farmBusiness';
import { pickupCropUnits } from './farmPickup';
import { farmCropDef } from './registry';
import { hashSeed, mulberry32 } from './rng';
import { recordFarmStat } from './farmKnowledge';

export interface CountyFreightContext { pickupPresent: boolean; source: 'pickup'; }
export interface CountyFreightBoardState { unlocked: boolean; offers: FarmCountyFreightContract[]; active: FarmCountyFreightContract | null; completedToday: boolean; }

function eligibleTemplates(state: GameState): CountyFreightTemplate[] {
  return COUNTY_FREIGHT_TEMPLATES.filter((template) => isFarmCropUnlocked(state, template.cropId)).sort((a, b) => a.cropId.localeCompare(b.cropId));
}

function shuffled<T>(values: readonly T[], seed: string): T[] {
  const rng = mulberry32(hashSeed(seed)); const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function routeId(day: number, kind: CountyFreightKind, cropId: string): string { return `county-freight-v2-${day}-${kind}-${cropId}`; }

function makeOffer(state: GameState, template: CountyFreightTemplate, kind: CountyFreightKind, requiredUnits: number): FarmCountyFreightContract {
  const farm = farmOf(state);
  const quote = farm.market.quotes[template.cropId]?.currentCents ?? farmCropDef(template.cropId).basePriceCents;
  const premiumBps = kind === 'bulk' ? COUNTY_FREIGHT_BULK_PREMIUM_BPS : COUNTY_FREIGHT_PREMIUM_BPS;
  return { id: routeId(farm.clock.day, kind, template.cropId), kind, issuedDay: farm.clock.day, cropId: template.cropId, requiredUnits, payoutCents: Math.max(1, Math.round(requiredUnits * quote * (10_000 + premiumBps) / 10_000)) };
}

/** Stable competing bids for one world seed + saved farm day. They do not mutate state. */
export function countyFreightOffers(state: GameState): FarmCountyFreightContract[] {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed' || farm.countyFreight.active || farm.countyFreight.lastCompletedDay >= farm.clock.day) return [];
  const candidates = eligibleTemplates(state);
  if (candidates.length < COUNTY_FREIGHT_BID_COUNT) return [];
  if (!farm.equipment.countyUtilityTrailerOwned) {
    return shuffled(candidates, `${state.seed}:county-freight:${farm.clock.day}`).slice(0, COUNTY_FREIGHT_BID_COUNT)
      .map((template) => makeOffer(state, template, 'standard', template.requiredUnits));
  }
  const bulkCandidates = candidates.filter((template) => countyFreightBulkAllowedUnits(farmCropDef(template.cropId).storageUnitsPerItem).length > 0);
  if (bulkCandidates.length === 0) return [];
  const bulkTemplate = shuffled(bulkCandidates, `${state.seed}:county-freight-v2:bulk:${farm.clock.day}`)[0];
  const bands = countyFreightBulkAllowedUnits(farmCropDef(bulkTemplate.cropId).storageUnitsPerItem);
  const bulkUnits = bands[hashSeed(`${state.seed}:county-freight-v2:bulk:${farm.clock.day}:${bulkTemplate.cropId}`) % bands.length];
  const standards = shuffled(candidates.filter((template) => template.cropId !== bulkTemplate.cropId), `${state.seed}:county-freight:${farm.clock.day}`)
    .slice(0, COUNTY_FREIGHT_BID_COUNT - 1).map((template) => makeOffer(state, template, 'standard', template.requiredUnits));
  return [makeOffer(state, bulkTemplate, 'bulk', bulkUnits), ...standards];
}

/** Compatibility helper for callers that want the first posted bid. */
export function countyFreightOffer(state: GameState): FarmCountyFreightContract | null { return countyFreightOffers(state)[0] ?? null; }

export function countyFreightBoardState(state: GameState): CountyFreightBoardState {
  const farm = farmOf(state); const unlocked = farm.townContact.status === 'completed';
  return { unlocked, offers: unlocked ? countyFreightOffers(state) : [], active: unlocked ? farm.countyFreight.active : null, completedToday: unlocked && !farm.countyFreight.active && farm.countyFreight.lastCompletedDay >= farm.clock.day };
}

export function acceptCountyFreightOffer(state: GameState, expectedOfferId?: string): ActionResult {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed') return fail('Complete the first County Pantry delivery before taking freight work.');
  if (farm.countyFreight.active) return fail('Finish the active County freight contract first.');
  const offers = countyFreightOffers(state); if (offers.length === 0) return fail('No new County freight offer is available today.');
  const offer = expectedOfferId ? offers.find((candidate) => candidate.id === expectedOfferId) : offers[0];
  if (!offer) return fail('That Freight Board offer has expired. Review today\'s new routes before accepting.');
  farm.countyFreight.active = { ...offer };
  const crop = farmCropDef(offer.cropId);
  return { ok: true, events: [{ type: 'toast', target: `${crop.name} ${offer.kind === 'bulk' ? 'commercial bulk ' : ''}freight contract accepted. Load ${offer.requiredUnits} units into the pickup.` }] };
}

export function countyFreightProgress(state: GameState, context?: CountyFreightContext): { loadedUnits: number; requiredUnits: number } {
  const active = farmOf(state).countyFreight.active;
  return { loadedUnits: active && context?.source === 'pickup' && context.pickupPresent ? pickupCropUnits(state, active.cropId) : 0, requiredUnits: active?.requiredUnits ?? 0 };
}

/** Consumes only pickup cargo and retires the saved contract before paying. */
export function fulfillCountyFreightContract(state: GameState, context?: CountyFreightContext): ActionResult {
  const farm = farmOf(state); const active = farm.countyFreight.active;
  if (!active) return fail('There is no active County freight contract.');
  if (farm.countyFreight.lastCompletedDay >= farm.clock.day) return fail('Today\'s County freight delivery is already complete.');
  if (active.kind === 'bulk' && !farm.equipment.countyUtilityTrailerOwned) return fail('Attach the County Utility Trailer before delivering this commercial bulk load.');
  if (!context || context.source !== 'pickup' || context.pickupPresent !== true) return fail('Bring the old pickup to the County Grain Exchange before delivery.');
  const loaded = pickupCropUnits(state, active.cropId); const crop = farmCropDef(active.cropId);
  if (loaded < active.requiredUnits) return fail(`Load ${active.requiredUnits} ${crop.name} units into the pickup before delivery.`);
  const firstFreightDelivery = farm.countyFreight.lastCompletedDay < 1;
  farm.pickup.cargo.crops[active.cropId] = loaded - active.requiredUnits;
  farm.countyFreight.active = null; farm.countyFreight.lastCompletedDay = farm.clock.day; farm.cashCents += active.payoutCents;
  recordFarmStat(state, 'farmDeliveries'); recordFarmStat(state, 'itemsSold', active.requiredUnits); recordFarmStat(state, 'farmCashEarnedCents', active.payoutCents); syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `${crop.name} freight delivered. $${(active.payoutCents / 100).toFixed(2)} received.${firstFreightDelivery ? ' County Utility Trailer unlocked at the Equipment Desk.' : ''}` }] };
}
