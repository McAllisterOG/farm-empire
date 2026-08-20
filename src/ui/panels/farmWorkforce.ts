import type { ActionResult, GameState } from '../../core/types';
import { farmOf, formatMoney, isFarmCropUnlocked } from '../../core/farmBusiness';
import { eliotUnlocked, farmManagerUnlocked, farmhandUnlocked, planFarmhandWork, reviewWorkforceDispatch, type FarmhandWorkKind } from '../../core/farmWorkforce';
import { farmParcelDef, type FarmParcelId } from '../../core/farmParcels';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import { ELIOT_REYES, FIRST_FARMHAND } from '../../data/farmWorkforce.data';
import { clearChildren, h } from '../dom';
import { closePanel, openPanel } from '../modal';

type Dispatch = (result: ActionResult) => void;

export interface FarmhandJobView {
  workerId: 'mara-bell' | 'eliot-reyes';
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
  hireEliot?: () => ActionResult;
  updateSlot?: (input: { workerId: 'mara-bell' | 'eliot-reyes'; enabled: boolean; parcelId: FarmParcelId; cropId: string; autoDispatch: boolean }) => ActionResult;
  approveDispatch?: () => ActionResult;
  updateManager?: (input: { enabled: boolean; parcelId: FarmParcelId; cropId: string }) => ActionResult;
  dispatchManager?: () => ActionResult;
  startWork?: (parcelId: FarmParcelId, kind: FarmhandWorkKind) => ActionResult;
  cancelWork?: (workerId: 'mara-bell' | 'eliot-reyes') => void;
  activeJobs?: FarmhandJobView[];
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
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'eliot-hire-card' },
      h('div', { class: 'farm-card-title' }, `${ELIOT_REYES.name} · ${ELIOT_REYES.role}`),
      h('p', {}, '$2,100 one-time; $100 only on a farm day when a real reviewed assignment starts. Field work only: prepare, rework, plant, water, harvest.'),
      h('div', { class: 'equipment-mode' }, farm.workforce.eliotHired ? 'Hired · configure at the farm' : eliotUnlocked(state) ? 'Ready after the manager contract' : 'Locked · manager, Mara, County contact, and north acreage required'),
      ...(!farm.workforce.eliotHired && eliotUnlocked(state) ? [h('button', { class: 'btn btn-primary', 'data-testid': 'hire-eliot-reyes', onclick: () => { const result = actions.hireEliot?.(); if (result) { actions.dispatch(result); if (result.ok) renderFarmWorkforce(body, state, actions); } } }, 'Hire Eliot · $2,100')] : []),
    ));
    return;
  }

  const manager = farm.workforce.manager;
  if (manager.hired) {
    const reviews = reviewWorkforceDispatch(state, actions.now);
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'farm-manager-plan' },
      h('div', { class: 'farm-card-title' }, 'Manager review · two worker slots'),
      ...reviews.map((review) => {
        const slot = farm.workforce.slots[review.slotIndex];
        const parcelSelect = h('select', {}, h('option', { value: 'starter', ...(slot.parcelId === 'starter' ? { selected: 'true' } : {}) }, 'Starter acreage'), ...(farm.parcels.northOwned ? [h('option', { value: 'north', ...(slot.parcelId === 'north' ? { selected: 'true' } : {}) }, 'North acreage')] : [])) as HTMLSelectElement;
        const cropSelect = h('select', {}, ...allFarmCrops().filter((crop) => isFarmCropUnlocked(state, crop.id)).map((crop) => h('option', { value: crop.id, ...(crop.id === slot.cropId ? { selected: 'true' } : {}) }, crop.name))) as HTMLSelectElement;
        return h('div', { class: 'panel-note', 'data-testid': `worker-slot-${review.workerId}` },
          h('strong', {}, `${review.workerName} · ${slot.enabled ? 'enabled' : 'paused'}`),
          h('div', { class: 'farmbook-actions farmhand-actions' }, parcelSelect, cropSelect),
          h('span', {}, review.eligibleCount ? `${WORK_LABELS[review.kind]} · ${review.eligibleCount} sections · seed/barn claim checked when approved work starts · max today ${formatMoney(review.maximumTodayWageCents)}` : review.reason ?? 'No candidate action.'),
          h('button', { class: 'btn btn-sm', onclick: () => { const result = actions.updateSlot?.({ ...slot, enabled: slot.enabled, parcelId: parcelSelect.value as FarmParcelId, cropId: cropSelect.value }); if (result) { actions.dispatch(result); renderFarmWorkforce(body, state, actions); } } }, 'Update slot'),
          h('button', { class: 'btn btn-sm', onclick: () => { const result = actions.updateSlot?.({ ...slot, enabled: !slot.enabled }); if (result) { actions.dispatch(result); renderFarmWorkforce(body, state, actions); } } }, slot.enabled ? 'Pause slot' : 'Enable slot'),
        );
      }),
      h('button', { class: 'btn btn-primary btn-sm', 'data-testid': 'approve-today-dispatch', ...(farm.workforce.dispatchApprovedDay === farm.clock.day ? { disabled: 'true' } : {}), onclick: () => { const result = actions.approveDispatch?.(); if (result) { actions.dispatch(result); if (result.ok) closePanel(); else renderFarmWorkforce(body, state, actions); } } }, farm.workforce.dispatchApprovedDay === farm.clock.day ? `Approved Day ${farm.clock.day}` : 'Approve today’s dispatch'),
      h('small', {}, 'Approval charges nothing. Active visible farm time may start eligible slots in order; workers never buy, sell, clear, or move cargo.'),
    ));
  }

  const active = actions.activeJobs ?? [];
  if (active.length) {
    body.append(...active.map((job) => {
      const parcel = farmParcelDef(job.parcelId); const name = job.workerId === 'mara-bell' ? FIRST_FARMHAND.name : ELIOT_REYES.name;
      return h('div', { class: 'equipment-card', 'data-testid': `worker-active-${job.workerId}` },
        h('div', { class: 'farm-card-title' }, `${name} · ${WORK_LABELS[job.kind]} · ${parcel.name}`),
        h('p', {}, `${job.completed} / ${job.total} complete${job.skipped ? ` · ${job.skipped} skipped` : ''}. Completed sections remain committed; unconsumed claims release if stopped.`),
        h('button', { class: 'btn', 'data-testid': `cancel-worker-${job.workerId}`, onclick: () => { actions.cancelWork?.(job.workerId); renderFarmWorkforce(body, state, actions); } }, `Stop ${name}`),
      );
    }));
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
