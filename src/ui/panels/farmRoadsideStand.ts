import type { ActionResult, GameState } from '../../core/types';
import { farmOf, formatMoney } from '../../core/farmBusiness';
import { roadsideStandView } from '../../core/farmRoadsideStand';
import { farmCropDef } from '../../core/registry';
import { ROADSIDE_PRODUCE_STAND } from '../../data/farmRoadsideStand.data';
import { clearChildren, h } from '../dom';
import { openPanel } from '../modal';

export interface FarmRoadsideStandActions {
  context: 'farm' | 'town';
  dispatch: (result: ActionResult) => void;
  purchase?: () => ActionResult;
  fulfill?: (orderId: string) => ActionResult;
}

export function openFarmRoadsideStand(state: GameState, actions: FarmRoadsideStandActions): void {
  openPanel({
    title: actions.context === 'town' ? 'Farm Services Improvements' : ROADSIDE_PRODUCE_STAND.name,
    body: (body) => renderFarmRoadsideStand(body, state, actions),
  });
}

function run(result: ActionResult, state: GameState, body: HTMLElement, actions: FarmRoadsideStandActions): void {
  actions.dispatch(result);
  if (result.ok) renderFarmRoadsideStand(body, state, actions);
}

function renderFarmRoadsideStand(body: HTMLElement, state: GameState, actions: FarmRoadsideStandActions): void {
  clearChildren(body);
  const farm = farmOf(state);
  const view = roadsideStandView(state);
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'roadside-stand-summary' },
    h('strong', {}, ROADSIDE_PRODUCE_STAND.name),
    h('span', {}, `Cash: ${formatMoney(farm.cashCents)} · one small local request per farm day`),
    h('span', {}, 'Local customers pay 90% of the County posted price for the convenience. Grain Exchange sales and Freight Board hauls remain the higher-value routes.'),
  ));

  if (!view.unlocked) {
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'roadside-stand-locked' },
      h('div', { class: 'farm-card-title' }, 'Roadside permit locked'),
      h('p', {}, 'Complete the first County Pantry delivery so Farm Services can approve direct local sales.'),
    ));
    return;
  }

  if (!view.owned) {
    body.append(h('div', { class: 'equipment-card', 'data-testid': 'roadside-stand-purchase' },
      h('div', { class: 'farm-card-title' }, 'Build a farm-gate market'),
      h('p', {}, `One-time improvement · ${formatMoney(ROADSIDE_PRODUCE_STAND.priceCents)} · a visible produce stand beside the County road.`),
      h('div', { class: 'equipment-mode' }, actions.context === 'town' ? 'Permit approved · ready to build' : 'Purchase at Farm Services in town'),
      ...(actions.context === 'town' ? [h('button', {
        class: 'btn btn-primary', 'data-testid': 'buy-roadside-stand',
        onclick: () => actions.purchase && run(actions.purchase(), state, body, actions),
      }, `Build for ${formatMoney(ROADSIDE_PRODUCE_STAND.priceCents)}`)] : []),
    ));
    return;
  }

  if (view.completedToday) {
    body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'roadside-stand-complete' },
      h('strong', {}, `Day ${farm.clock.day} local order complete`),
      h('span', {}, 'The honor box is collected and the stand is stocked for today. A new request arrives next farm day.'),
    ));
    return;
  }

  const order = view.order!;
  const crop = farmCropDef(order.cropId);
  const stored = Math.max(0, Math.floor(farm.storage[order.cropId] ?? 0));
  const ready = stored >= order.requiredUnits;
  body.append(h('div', { class: 'farm-card county-work-order', 'data-testid': 'roadside-stand-order' },
    h('div', { class: 'farm-card-main' },
      h('div', { class: 'farm-card-title' }, `Today · ${crop.name} basket`),
      h('div', { class: 'farm-card-sub' }, `${stored} / ${order.requiredUnits} in the barn · ${formatMoney(order.payoutCents)} local payout`),
      h('div', { class: 'farm-card-stock' }, actions.context === 'farm'
        ? ready ? 'Ready to stock from barn storage.' : `Harvest ${order.requiredUnits - stored} more ${crop.name}.`
        : 'The order is posted. Return to the farm stand to stock it from the barn.'),
    ),
    ...(actions.context === 'farm' ? [h('button', {
      class: 'btn btn-primary btn-sm', 'data-testid': 'fulfill-roadside-order',
      ...(ready ? {} : { disabled: 'true' }),
      onclick: () => actions.fulfill && run(actions.fulfill(order.id), state, body, actions),
    }, `Stock ${order.requiredUnits}`)] : []),
  ));
}
