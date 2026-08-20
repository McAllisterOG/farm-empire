import { FARMSTEAD_OFFICE_QUARTERS } from '../data/farmstead.data';
import { farmOf, syncCashMirror } from './farmBusiness';
import type { ActionResult, GameState } from './types';
import { fail } from './types';

export function officeQuartersUnlocked(state: GameState): boolean {
  const farm = farmOf(state);
  return farm.townContact.status === 'completed'
    && farm.parcels.northOwned
    && farm.workforce.farmhandHired
    && farm.workforce.manager.hired;
}

/** Exact one-time transaction; no workforce, output, or dispatch state is touched. */
export function purchaseFarmsteadOfficeQuarters(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!officeQuartersUnlocked(state)) return fail('Complete County contact, own the neighboring acreage, hire Mara, and add the Farm Manager contract before building crew quarters.');
  if (farm.farmstead.officeQuartersOwned) return fail('Farmstead Office & Crew Quarters are already owned.');
  if (farm.cashCents < FARMSTEAD_OFFICE_QUARTERS.priceCents) return fail('Not enough cash for the Farmstead Office & Crew Quarters.');
  farm.cashCents -= FARMSTEAD_OFFICE_QUARTERS.priceCents;
  farm.farmstead.officeQuartersOwned = true;
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'Farmstead Office & Crew Quarters built. Eliot can now join the two-person field crew.' }] };
}
