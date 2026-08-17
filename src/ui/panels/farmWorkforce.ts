import type { ActionResult, GameState } from '../../core/types';
import { farmOf, formatMoney, isFarmCropUnlocked } from '../../core/farmBusiness';
import { farmManagerUnlocked, farmhandUnlocked, planFarmManagerDispatch, planFarmhandWork, type FarmhandWorkKind } from '../../core/farmWorkforce';
import { farmParcelDef, type FarmParcelId } from '../../core/farmParcels';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import { FIRST_FARMHAND } from '../../data/farmWorkforce.data';
import { clearChildren, h } from '../dom';
import { closePanel, openPanel } from '../modal';

type Dispatch = (result: ActionResult) => void;

export interface FarmhandJobView {
  parcelId: FarmParcelId;
  kind: FarmhandWorkKind;
  completed: number;
  skipped: number;
  total: number;
}

export interface FarmWorkforceActions {
  context: 'farm' | 'town';
  dispatch: Dispatch;
  hire?: () => ActionResult;
  hireManager?: () => ActionResult;
  updateManager?: (input: { enabled: boolean; parcelId: FarmParcelId; cropId: string }) => ActionResult;
  dispatchManager?: () => ActionResult;
  startWork?: (parcelId: FarmParcelId, kind: FarmhandWorkKind) => ActionResult;
  cancelWork?: () => void;
  activeJob?: FarmhandJobView | null;
  now: number;
  onClose: () => void;
}

const WORK_LABELS: Readonly<Record<FarmhandWorkKind, string>> = {
  prepare: 'Prepare rough soil',
  rework: 'Rework stubble',
  plant: 'Plant selected crop',
  water: 'Water seedlings',
  harvest: 'Harvest ready crops',
  clear: 'Clear withered crops',
};

export function openFarmWorkforce(state: GameState, actions: FarmWorkforceActions): void {
  openPanel({
    title: actions.context === 'town' ? 'Farm Services Workforce Desk' : `${FIRST_FARMHAND.name} · ${FIRST_FARMHAND.role}`,
    className: 'panel-wide',
    onClose: actions.onClose,
    body: (body) => renderFarmWorkforce(body, state, actions),
  });
}

function renderFarmWorkforce(body: HTMLElement, state: GameState, actions: FarmWorkforceActions): void {
  clearChildren(body);
  const farm = farmOf(state);
  const hired = farm.workforce.farmhandHired;
  const unlocked = farmhandUnlocked(state);
  const shiftPaid = farm.workforce.lastShiftPaidDay === farm.clock.day;
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'farmhand-summary' },
    h('strong', {}, `${FIRST_FARMHAND.name} · ${FIRST_FARMHAND.role}`),
    h('span', {}, hired
      ? `Hired · ${shiftPaid ? `Day ${farm.clock.day} shift paid` : `${formatMoney(FIRST_FARMHAND.dailyShiftCents)} covers the first assignment today`}`
      : `${formatMoney(FIRST_FARMHAND.hirePriceCents)} one-time hire · ${formatMoney(FIRST_FARMHAND.dailyShiftCents)} per active farm day`),
  ));

  if (!hired) {
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farmhand-hire-card' },
      h('div', { class: 'farm-card-title' }, 'Build the first farm crew'),
      h('p', {}, 'Mara can handle one whole-acreage assignment at a time using the farm’s real seed supply, barn space, crop stages, and field conditions.'),
      h('div', { class: 'equipment-mode', 'data-testid': 'farmhand-hire-status' }, unlocked
        ? actions.context === 'town' ? 'Ready to hire at this desk' : 'Unlocked · visit Farm Services in town to hire'
        : farm.townContact.status !== 'completed' ? 'Locked · complete the County introduction' : 'Locked · own the neighboring acreage'),
      ...(actions.context === 'town' && unlocked ? [h('button', {
        class: 'btn btn-primary', 'data-testid': 'hire-first-farmhand', onclick: () => {
          const result = actions.hire?.();
          if (!result) return;
          actions.dispatch(result);
          if (result.ok) renderFarmWorkforce(body, state, actions);
        },
      }, `Hire for ${formatMoney(FIRST_FARMHAND.hirePriceCents)}`)] : []),
    ));
    return;
  }

  if (actions.context === 'town') {
    const manager = farm.workforce.manager;
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farmhand-town-status' },
      h('div', { class: 'farm-card-title' }, 'Farm team active'),
      h('p', {}, 'Mara reports to the farmhouse. Return to the farm and talk with her—or open Workforce in the Farmbook—to assign acreage work.'),
    ));
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farm-manager-contract' },
      h('div', { class: 'farm-card-title' }, 'Farm Manager contract'),
      h('p', {}, '$2,400 one-time. Sets a standing acreage plan; Mara’s normal $120 shift is charged only when real work starts.'),
      h('div', { class: 'equipment-mode' }, manager.hired ? 'Contract owned · configure and review at the farm' : farmManagerUnlocked(state) ? 'Ready at this desk' : 'Locked · hire Mara first'),
      ...(!manager.hired && farmManagerUnlocked(state) ? [h('button', { class: 'btn btn-primary', 'data-testid': 'hire-farm-manager', onclick: () => { const result = actions.hireManager?.(); if (result) { actions.dispatch(result); if (result.ok) renderFarmWorkforce(body, state, actions); } } }, 'Add contract · $2,400')] : []),
    ));
    return;
  }

  const manager = farm.workforce.manager;
  if (manager.hired) {
    const preview = planFarmManagerDispatch(state, actions.now);
    const parcelSelect = h('select', { 'data-testid': 'manager-parcel' },
      h('option', { value: 'starter', ...(manager.parcelId === 'starter' ? { selected: 'true' } : {}) }, 'Starter acreage'),
      ...(farm.parcels.northOwned ? [h('option', { value: 'north', ...(manager.parcelId === 'north' ? { selected: 'true' } : {}) }, 'North acreage')] : []),
    ) as HTMLSelectElement;
    const cropSelect = h('select', { 'data-testid': 'manager-crop' }, ...allFarmCrops().filter((crop) => isFarmCropUnlocked(state, crop.id))
      .map((crop) => h('option', { value: crop.id, ...(crop.id === manager.cropId ? { selected: 'true' } : {}) }, crop.name))) as HTMLSelectElement;
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farm-manager-plan' },
      h('div', { class: 'farm-card-title' }, `Manager · ${manager.enabled ? 'standing plan active' : 'paused'}`),
      h('div', { class: 'farmbook-actions farmhand-actions' }, parcelSelect, cropSelect),
      h('p', { class: 'panel-note' }, preview.eligibleCount ? `Day ${farm.clock.day} preview · ${WORK_LABELS[preview.kind]} · ${preview.eligibleCount} eligible sections.` : `Day ${farm.clock.day} · ${preview.reason}`),
      h('div', { class: 'farmbook-actions farmhand-actions' },
        h('button', { class: 'btn btn-sm', 'data-testid': 'update-manager-plan', onclick: () => { const result = actions.updateManager?.({ enabled: manager.enabled, parcelId: parcelSelect.value as FarmParcelId, cropId: cropSelect.value }); if (result) { actions.dispatch(result); renderFarmWorkforce(body, state, actions); } } }, 'Update plan'),
        h('button', { class: 'btn btn-sm', 'data-testid': 'toggle-manager-plan', onclick: () => { const result = actions.updateManager?.({ enabled: !manager.enabled, parcelId: manager.parcelId, cropId: manager.cropId }); if (result) { actions.dispatch(result); renderFarmWorkforce(body, state, actions); } } }, manager.enabled ? 'Pause plan' : 'Enable plan'),
        h('button', { class: 'btn btn-primary btn-sm', 'data-testid': 'dispatch-farm-manager', ...(preview.eligibleCount && manager.lastReviewedDay !== farm.clock.day && !actions.activeJob ? {} : { disabled: 'true' }), onclick: () => { const result = actions.dispatchManager?.(); if (result) { actions.dispatch(result); if (result.ok) closePanel(); else renderFarmWorkforce(body, state, actions); } } }, manager.lastReviewedDay === farm.clock.day ? `Reviewed Day ${farm.clock.day}` : `Dispatch Mara for Day ${farm.clock.day}`),
      ),
      h('small', {}, 'The manager never buys supplies, moves cargo, or works while you are away.'),
    ));
  }

  const active = actions.activeJob;
  if (active) {
    const parcel = farmParcelDef(active.parcelId);
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farmhand-active-job' },
      h('div', { class: 'farm-card-title' }, `${WORK_LABELS[active.kind]} · ${parcel.name}`),
      h('p', {}, `${active.completed} / ${active.total} complete${active.skipped ? ` · ${active.skipped} skipped` : ''}. Completed sections remain committed; the section in progress changes only after its action finishes.`),
      h('button', { class: 'btn', 'data-testid': 'cancel-farmhand-job', onclick: () => { actions.cancelWork?.(); closePanel(); } }, 'Stop assignment'),
    ));
    return;
  }

  const selected = farmCropDef(farm.selectedCropId);
  body.append(h('p', { class: 'panel-note' }, `Selected crop: ${selected.name}. A paid shift covers any additional assignments started on Day ${farm.clock.day}. Leaving during a job stops Mara safely after the last completed section.`));
  for (const parcelId of ['starter', 'north'] as const) {
    if (parcelId === 'north' && !farm.parcels.northOwned) continue;
    const parcel = farmParcelDef(parcelId);
    const buttons = (Object.keys(WORK_LABELS) as FarmhandWorkKind[]).map((kind) => {
      const plan = planFarmhandWork(state, parcelId, kind, actions.now, farm.selectedCropId);
      const count = plan.targetPlotUids.length;
      return h('button', {
        class: 'btn btn-sm',
        'data-testid': `farmhand-${parcelId}-${kind}`,
        ...(count > 0 ? {} : { disabled: 'true' }),
        onclick: () => {
          const result = actions.startWork?.(parcelId, kind);
          if (!result) return;
          actions.dispatch(result);
          if (result.ok) closePanel();
          else renderFarmWorkforce(body, state, actions);
        },
      }, `${WORK_LABELS[kind]} · ${count}`);
    });
    body.append(h('div', { class: 'equipment-card', 'data-testid': `farmhand-parcel-${parcelId}` },
      h('div', { class: 'farm-card-title' }, parcel.name),
      h('div', { class: 'farmbook-actions farmhand-actions' }, ...buttons),
    ));
  }
}
