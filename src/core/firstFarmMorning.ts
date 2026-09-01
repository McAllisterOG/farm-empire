import { COUNTY_PANTRY_CORN_ORDER } from '../data/townWorkOrders.data';
import { farmCropStage, farmFieldCondition, farmOf } from './farmBusiness';
import type { GameState } from './types';

export type FirstFarmMorningPhase = 'prepare' | 'prepared' | 'planted-needs-water' | 'growing' | 'ready' | 'carried' | 'stored' | 'loaded' | 'meet-mae' | 'offered' | 'active' | 'completed';
export interface FirstFarmMorningGuide { phase: FirstFarmMorningPhase; title: string; detail: string; cornProgress: { current: number; required: number }; fieldTarget: { uid: number; x: number; y: number } | null; showWelcome: boolean; complete: boolean; }
export interface StarterGuidePresentationState { tractorOperating: boolean; tractorJob: boolean; tractorMoving: boolean; manualAction: boolean; manualJob: boolean; dragging: boolean; farmhandJob: boolean; farmhandAction: boolean; farmhandMoving: boolean; }

function positive(value: unknown): number { return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0; }
function units(record: Record<string, number> | undefined): number { return Object.values(record ?? {}).reduce((sum, value) => sum + positive(value), 0); }
function firstPlot(state: GameState, predicate: (plot: GameState['plots'][number]) => boolean): { uid: number; x: number; y: number } | null { const plot = state.plots.find(predicate); return plot ? { uid: plot.uid, x: plot.x, y: plot.y } : null; }

/** True only for an untouched, unmet farm; it never persists tutorial dismissal. */
export function shouldShowFirstFarmMorningWelcome(state: GameState): boolean {
  if (!state.farm) return false;
  const farm = farmOf(state);
  const fieldPristine = state.plots.every((plot) => !plot.crop && farmFieldCondition(state, plot.uid).soil === 'rough');
  const inventoryPristine = units(farm.storage) === 0 && units(farm.handBasket?.crops) === 0 && units(farm.pickup?.cargo?.crops) === 0 && units(farm.pickup?.cargo?.seeds) === 0;
  const activityPristine = ['farmSectionsTilled', 'plantings', 'farmSectionsWatered', 'harvests', 'farmCargoLoads', 'farmTownVisits', 'itemsSold', 'farmDeliveries']
    .every((key) => positive(state.stats?.[key]) === 0);
  return farm.townContact.status === 'unmet' && fieldPristine && inventoryPristine && activityPristine;
}

/** Suppresses the optional field pulse while another work presentation owns that space. */
export function shouldPresentStarterGuideTarget(runtime: StarterGuidePresentationState): boolean {
  return !runtime.tractorOperating && !runtime.tractorJob && !runtime.tractorMoving && !runtime.manualAction && !runtime.manualJob && !runtime.dragging && !runtime.farmhandJob && !runtime.farmhandAction && !runtime.farmhandMoving;
}

/** Read-only first-session presentation derived from current authority alone. */
export function firstFarmMorningGuide(state: GameState, now: number): FirstFarmMorningGuide {
  const required = COUNTY_PANTRY_CORN_ORDER.requiredUnits;
  if (!state.farm) return { phase: 'prepare', title: 'Prepare six field sections', detail: 'Open six rough field sections and prepare the soil.', cornProgress: { current: 0, required }, fieldTarget: null, showWelcome: false, complete: false };
  const safeNow = Number.isFinite(now) ? now : 0;
  const farm = farmOf(state); const cornId = COUNTY_PANTRY_CORN_ORDER.cropId;
  const cornInPickup = positive(farm.pickup?.cargo?.crops?.[cornId]); const cornInBarn = positive(farm.storage?.[cornId]); const cornInBasket = positive(farm.handBasket?.crops?.[cornId]);
  const prepared = firstPlot(state, (plot) => !plot.crop && farmFieldCondition(state, plot.uid).soil === 'tilled');
  const cornAt = (stage: ReturnType<typeof farmCropStage>) => firstPlot(state, (plot) => plot.crop?.defId === cornId && farmCropStage(plot.crop, safeNow) === stage);
  const needsWater = cornAt('needs-water'); const growing = cornAt('growing'); const ready = cornAt('ready'); const rough = firstPlot(state, (plot) => !plot.crop && farmFieldCondition(state, plot.uid).soil === 'rough');
  const base = { cornProgress: { current: Math.min(required, cornInPickup), required }, showWelcome: shouldShowFirstFarmMorningWelcome(state) };
  if (farm.townContact.status === 'completed') return { ...base, phase: 'completed', title: 'First County delivery complete', detail: 'The Pantry has your corn. The farm is on its way.', fieldTarget: null, complete: true };
  if (farm.townContact.status === 'active' && cornInPickup >= required) return { ...base, phase: 'loaded', title: 'Take corn to Eli', detail: `Drive the pickup to County Service Center. Eli can accept ${required} corn.`, fieldTarget: null, complete: false };
  if ((farm.townContact.status === 'unmet' || farm.townContact.status === 'offered') && cornInPickup >= required) return { ...base, phase: farm.townContact.status === 'offered' ? 'offered' : 'meet-mae', title: farm.townContact.status === 'offered' ? 'Accept Mae’s delivery' : 'Meet Mae at Farm Services', detail: 'Visit Mae before taking the loaded pickup to Eli.', fieldTarget: null, complete: false };
  if (cornInBasket > 0) return { ...base, phase: 'carried', title: 'Unload the corn basket', detail: 'Carry the corn basket to the barn, then load the pickup.', fieldTarget: null, complete: false };
  if (cornInBarn > 0) return { ...base, phase: 'stored', title: 'Load the pickup', detail: `${cornInPickup}/${required} corn is in cargo. Park at the barn pad and load the rest.`, fieldTarget: null, complete: false };
  if (ready) return { ...base, phase: 'ready', title: 'Harvest the corn by hand', detail: 'Ready corn goes into your basket first.', fieldTarget: ready, complete: false };
  if (growing) return { ...base, phase: 'growing', title: 'Let the corn grow', detail: 'Your watered corn is growing. Come back when it is ready.', fieldTarget: growing, complete: false };
  if (needsWater) return { ...base, phase: 'planted-needs-water', title: 'Water new corn', detail: 'Open the corn seedlings and give them their first watering.', fieldTarget: needsWater, complete: false };
  if (prepared) return { ...base, phase: 'prepared', title: 'Plant corn', detail: 'Corn is selected. Plant a prepared field section.', fieldTarget: prepared, complete: false };
  if (farm.townContact.status === 'offered') return { ...base, phase: 'offered', title: 'Accept Mae’s delivery', detail: 'Mae at Farm Services has the County Pantry order ready.', fieldTarget: null, complete: false };
  if (farm.townContact.status === 'active') return { ...base, phase: 'active', title: 'Grow corn for the Pantry', detail: `${cornInPickup}/${required} corn loaded. Prepare a field section for the rest.`, fieldTarget: rough, complete: false };
  return { ...base, phase: 'prepare', title: 'Prepare six field sections', detail: 'Select a rough field section, then drag across the field to select more and choose Prepare.', fieldTarget: rough, complete: false };
}
