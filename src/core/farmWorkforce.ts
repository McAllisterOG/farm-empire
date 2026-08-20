import { FIRST_FARMHAND, FIRST_FARM_MANAGER } from '../data/farmWorkforce.data';
import {
  farmCropStage, farmFieldCondition, farmOf, isFarmCropUnlocked, isFarmCropWithered, pinnedFarmHarvestYield,
  serpentineFieldTiles, storageRemaining, syncCashMirror,
} from './farmBusiness';
import { recordFarmStat } from './farmKnowledge';
import { farmParcelTiles, type FarmParcelId } from './farmParcels';
import type { ManualFieldActionKind } from './farmManualAction';
import { farmCropDef } from './registry';
import type { ActionResult, GameState } from './types';
import { fail } from './types';

export type FarmhandWorkKind = ManualFieldActionKind;

export interface FarmhandWorkPlan {
  parcelId: FarmParcelId;
  kind: FarmhandWorkKind;
  cropId?: string;
  targetPlotUids: number[];
}

export interface StartFarmhandShiftResult {
  result: ActionResult;
  plan: FarmhandWorkPlan | null;
  wageChargedCents: number;
}

export interface FarmManagerDispatchPlan extends FarmhandWorkPlan {
  eligibleCount: number;
  reason: string | null;
}

export function farmhandUnlocked(state: GameState): boolean {
  const farm = farmOf(state);
  return farm.townContact.status === 'completed' && farm.parcels.northOwned;
}

export function hireFirstFarmhand(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!farmhandUnlocked(state)) return fail('Complete the County introduction and own the neighboring acreage before hiring a farmhand.');
  if (farm.workforce.farmhandHired) return fail(`${FIRST_FARMHAND.name} is already on the farm team.`);
  if (farm.cashCents < FIRST_FARMHAND.hirePriceCents) return fail(`Not enough cash to hire ${FIRST_FARMHAND.name}.`);
  farm.cashCents -= FIRST_FARMHAND.hirePriceCents;
  farm.workforce.farmhandHired = true;
  recordFarmStat(state, 'hires');
  recordFarmStat(state, 'farmCashSpentCents', FIRST_FARMHAND.hirePriceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `${FIRST_FARMHAND.name} hired. Assign acreage work from the Farmbook or talk with her at the farm.` }] };
}

export function farmManagerUnlocked(state: GameState): boolean {
  return farmhandUnlocked(state) && farmOf(state).workforce.farmhandHired;
}

/** One-time contract purchase. Mara remains the only shift-wage authority. */
export function hireFarmManager(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!farmManagerUnlocked(state)) return fail('Complete the County introduction, own the neighboring acreage, and hire Mara before adding a manager.');
  if (farm.workforce.manager.hired) return fail('The Farm Manager contract is already active.');
  if (farm.cashCents < FIRST_FARM_MANAGER.hirePriceCents) return fail('Not enough cash for the Farm Manager contract.');
  farm.cashCents -= FIRST_FARM_MANAGER.hirePriceCents;
  farm.workforce.manager = { hired: true, enabled: true, parcelId: 'starter', cropId: 'crop_corn', lastReviewedDay: 0 };
  recordFarmStat(state, 'farmCashSpentCents', FIRST_FARM_MANAGER.hirePriceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'Farm Manager contract added. Set a standing acreage plan from Workforce.' }] };
}

export function updateFarmManagerPlan(state: GameState, input: { enabled: boolean; parcelId: FarmParcelId; cropId: string }): ActionResult {
  const farm = farmOf(state);
  if (!farm.workforce.manager.hired || !farmManagerUnlocked(state)) return fail('Hire the Farm Manager contract after Mara joins the farm team.');
  if (input.parcelId === 'north' && !farm.parcels.northOwned) return fail('The neighboring acreage is not available for this plan.');
  if (!isFarmCropUnlocked(state, input.cropId)) return fail('Choose an unlocked crop for the manager planting preference.');
  farm.workforce.manager.enabled = input.enabled;
  farm.workforce.manager.parcelId = input.parcelId;
  farm.workforce.manager.cropId = input.cropId;
  return { ok: true, events: [{ type: 'toast', target: input.enabled ? 'Manager acreage plan updated.' : 'Manager acreage plan paused.' }] };
}

/** Pure review: selects one existing Mara work plan without changing resources. */
export function planFarmManagerDispatch(state: GameState, now: number): FarmManagerDispatchPlan {
  const farm = farmOf(state); const manager = farm.workforce.manager;
  const empty = (reason: string): FarmManagerDispatchPlan => ({ parcelId: manager.parcelId, kind: 'prepare', targetPlotUids: [], eligibleCount: 0, reason });
  if (!manager.hired || !farmManagerUnlocked(state)) return empty('Manager contract is not available.');
  if (!manager.enabled) return empty('Manager plan is paused.');
  if (manager.parcelId === 'north' && !farm.parcels.northOwned) return empty('Configured acreage is unavailable.');
  for (const kind of ['harvest', 'water', 'rework', 'prepare', 'plant'] as const) {
    const plan = planFarmhandWork(state, manager.parcelId, kind, now, manager.cropId);
    if (plan.targetPlotUids.length) return { ...plan, eligibleCount: plan.targetPlotUids.length, reason: null };
  }
  return empty('No eligible work is ready; withered crops require owner clearing.');
}

/**
 * Pure acreage plan. It filters against current authoritative field state and
 * limits planting/harvest to the seed and barn resources available now.
 */
export function planFarmhandWork(
  state: GameState,
  parcelId: FarmParcelId,
  kind: FarmhandWorkKind,
  now: number,
  cropId = farmOf(state).selectedCropId,
): FarmhandWorkPlan {
  const farm = farmOf(state);
  if (parcelId === 'north' && !farm.parcels.northOwned) return { parcelId, kind, cropId, targetPlotUids: [] };
  const plotsByCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot]));
  let availableSeeds = Math.max(0, farm.seeds[cropId] ?? 0);
  let availableStorage = storageRemaining(state);
  const targets: number[] = [];
  for (const tile of serpentineFieldTiles(farmParcelTiles(parcelId))) {
    const plot = plotsByCoordinate.get(`${tile.x}:${tile.y}`);
    if (!plot) continue;
    const condition = farmFieldCondition(state, plot.uid);
    if (kind === 'prepare' && !plot.crop && condition.soil === 'rough') targets.push(plot.uid);
    else if (kind === 'rework' && !plot.crop && condition.soil === 'stubble') targets.push(plot.uid);
    else if (kind === 'plant' && availableSeeds > 0 && isFarmCropUnlocked(state, cropId) && !plot.crop && condition.soil === 'tilled') {
      targets.push(plot.uid); availableSeeds -= 1;
    } else if (kind === 'water' && farmCropStage(plot.crop, now) === 'needs-water') targets.push(plot.uid);
    else if (kind === 'harvest' && farmCropStage(plot.crop, now) === 'ready' && plot.crop) {
      const def = farmCropDef(plot.crop.defId);
      const requiredStorage = pinnedFarmHarvestYield(plot.crop) * def.storageUnitsPerItem;
      if (requiredStorage <= availableStorage) {
        targets.push(plot.uid); availableStorage -= requiredStorage;
      }
    } else if (kind === 'clear' && plot.crop && isFarmCropWithered(plot.crop, now)) targets.push(plot.uid);
  }
  return { parcelId, kind, ...(kind === 'plant' ? { cropId } : {}), targetPlotUids: targets };
}

/** Charges at most one shift wage per saved farm day, only after a real plan exists. */
export function startFarmhandShift(
  state: GameState,
  parcelId: FarmParcelId,
  kind: FarmhandWorkKind,
  now: number,
  cropId = farmOf(state).selectedCropId,
): StartFarmhandShiftResult {
  const farm = farmOf(state);
  if (!farm.workforce.farmhandHired) return { result: fail('Hire a farmhand at Farm Services first.'), plan: null, wageChargedCents: 0 };
  const plan = planFarmhandWork(state, parcelId, kind, now, cropId);
  if (plan.targetPlotUids.length === 0) return { result: fail('No eligible field sections are ready for that assignment.'), plan: null, wageChargedCents: 0 };
  const needsWage = farm.workforce.lastShiftPaidDay !== farm.clock.day;
  if (needsWage && farm.cashCents < FIRST_FARMHAND.dailyShiftCents) {
    return { result: fail(`The daily farmhand shift costs $${(FIRST_FARMHAND.dailyShiftCents / 100).toFixed(2)}.`), plan: null, wageChargedCents: 0 };
  }
  if (needsWage) {
    farm.cashCents -= FIRST_FARMHAND.dailyShiftCents;
    farm.workforce.lastShiftPaidDay = farm.clock.day;
    recordFarmStat(state, 'farmCashSpentCents', FIRST_FARMHAND.dailyShiftCents);
    syncCashMirror(state);
  }
  return {
    result: { ok: true, events: [{ type: 'toast', target: `${FIRST_FARMHAND.name} started ${kind} work across ${plan.targetPlotUids.length} eligible section${plan.targetPlotUids.length === 1 ? '' : 's'}.${needsWage ? ' Today\'s shift is paid.' : ''}` }] },
    plan,
    wageChargedCents: needsWage ? FIRST_FARMHAND.dailyShiftCents : 0,
  };
}
