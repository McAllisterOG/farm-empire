import type { ActionResult, GameState } from '../../core/types';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, farmOf, formatMoney, marketMovement, storageRemaining, storageUsed,
} from '../../core/farmBusiness';
import { COUNTY_PANTRY_CORN_ORDER } from '../../data/townWorkOrders.data';
import { countyWorkOrderProgress, townContact } from '../../core/farmTownContact';
import { h, spriteImg, clearChildren } from '../dom';
import { closePanel, openPanel } from '../modal';

type Dispatch = (result: ActionResult) => void;

export interface FarmPanelActions {
  buySeeds: (cropId: string, count: number) => ActionResult;
  sellCrop: (cropId: string, count: number) => ActionResult;
  buyLand: () => ActionResult;
  acceptCountyWorkOrder: () => ActionResult;
  fulfillCountyWorkOrder: () => ActionResult;
  dispatch: Dispatch;
}

/** A market panel is reusable, but County fulfillment is only available at Eli's exchange. */
export type FarmMarketContext = 'farm' | 'town';

export interface CountyDeliveryMarketState {
  showCountyOrder: boolean;
  deliveryReady: boolean;
}

/** Defaults closed so a new farm-side caller cannot accidentally expose County delivery. */
export function countyDeliveryMarketState(state: GameState, context: FarmMarketContext = 'farm'): CountyDeliveryMarketState {
  const showCountyOrder = context === 'town' && townContact(state).status === 'active';
  const progress = countyWorkOrderProgress(state);
  return {
    showCountyOrder,
    deliveryReady: showCountyOrder && progress.storedUnits >= progress.requiredUnits,
  };
}

function runAndRender(result: ActionResult, actions: FarmPanelActions, rerender: () => void): void {
  actions.dispatch(result);
  if (result.ok) rerender();
}

export function openFarmSeedShop(state: GameState, actions: FarmPanelActions): void {
  const spec = {
    title: 'Seed Supplier',
    className: 'panel-wide',
    body: (body: HTMLElement): void => renderSeedShop(body, state, actions),
  };
  openPanel(spec);
}

function renderSeedShop(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
  clearChildren(body);
  const farm = farmOf(state);
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', {}, `Available cash: ${formatMoney(farm.cashCents)}`),
    h('span', {}, 'Seed prices are paid immediately and inventory is saved.'),
  ));
  const list = h('div', { class: 'farm-card-list' });
  const rerender = (): void => renderSeedShop(body, state, actions);
  for (const def of allFarmCrops()) {
    list.append(h('div', { class: 'farm-card', 'data-testid': `seed-card-${def.id}` },
      spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-lg'),
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, def.name),
        h('div', { class: 'farm-card-sub' },
          `${formatMoney(def.seedPriceCents)} per seed · ${Math.round(def.growMs / 1000)}s base growth · ${def.harvestYield} units + tractor bonus`,
        ),
        h('div', { class: 'farm-card-stock', 'data-testid': `seed-count-${def.id}` }, `Seeds owned: ${farm.seeds[def.id] ?? 0}`),
      ),
      h('div', { class: 'farm-card-actions' },
        h('button', { class: 'btn btn-primary btn-sm', 'data-testid': `buy-one-${def.id}`, onclick: () => runAndRender(actions.buySeeds(def.id, 1), actions, rerender) }, 'Buy 1'),
        h('button', { class: 'btn btn-sm', 'data-testid': `buy-five-${def.id}`, onclick: () => runAndRender(actions.buySeeds(def.id, 5), actions, rerender) }, 'Buy 5'),
      ),
    ));
  }
  body.append(list);
}

export function openFarmMarket(state: GameState, actions: FarmPanelActions, context: FarmMarketContext = 'farm'): void {
  const spec = {
    title: 'Commodity Market & Barn Storage',
    className: 'panel-wide',
    body: (body: HTMLElement): void => renderMarket(body, state, actions, context),
  };
  openPanel(spec);
}

function renderMarket(body: HTMLElement, state: GameState, actions: FarmPanelActions, context: FarmMarketContext): void {
  clearChildren(body);
  const farm = farmOf(state);
  const used = storageUsed(state);
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', { 'data-testid': 'market-cash' }, `Cash: ${formatMoney(farm.cashCents)}`),
    h('strong', { 'data-testid': 'market-capacity' }, `Storage: ${used} / ${farm.storageCapacity}`),
    h('span', {}, `${storageRemaining(state)} capacity remaining. A full barn leaves mature crops safely in the field.`),
  ));

  const events = h('div', { class: 'market-events', 'data-testid': 'market-events' });
  if (farm.market.activeEvents.length === 0) {
    events.append(h('div', { class: 'market-event neutral' }, 'No active market event today.'));
  } else {
    for (const event of farm.market.activeEvents) {
      const crop = farmCropDef(event.cropId);
      events.append(h('div', { class: `market-event ${event.modifierBps >= 0 ? 'positive' : 'negative'}` },
        `${event.name} · ${crop.name} ${event.modifierBps >= 0 ? '+' : ''}${(event.modifierBps / 100).toFixed(0)}% · ${event.remainingDays} day${event.remainingDays === 1 ? '' : 's'} remaining`,
      ));
    }
  }
  body.append(events);

  const countyDelivery = countyDeliveryMarketState(state, context);
  if (countyDelivery.showCountyOrder) {
    const progress = countyWorkOrderProgress(state);
    const order = h('div', { class: 'farm-card county-work-order', 'data-testid': 'county-work-order-market' },
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, COUNTY_PANTRY_CORN_ORDER.title),
        h('div', { class: 'farm-card-sub' }, `County delivery: ${progress.storedUnits} / ${progress.requiredUnits} corn in barn · fixed ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)} payout`),
        h('div', { class: 'farm-card-stock' }, countyDelivery.deliveryReady ? 'Ready for Eli to accept.' : 'Keep harvesting and storing corn.'),
      ),
      h('button', {
        class: 'btn btn-primary btn-sm', 'data-testid': 'deliver-county-work-order',
        ...(countyDelivery.deliveryReady ? {} : { disabled: 'true' }),
        onclick: () => runAndRender(actions.fulfillCountyWorkOrder(), actions, rerender),
      }, `Deliver ${progress.requiredUnits} corn`),
    );
    body.append(order);
  }

  const rerender = (): void => renderMarket(body, state, actions, context);
  const list = h('div', { class: 'farm-card-list market-list' });
  for (const def of allFarmCrops()) {
    const quote = farm.market.quotes[def.id];
    const movement = marketMovement(quote.currentCents, quote.previousCents);
    const stored = farm.storage[def.id] ?? 0;
    const input = h('input', {
      class: 'market-qty', type: 'number', min: '1', max: String(Math.max(1, stored)), value: String(Math.max(1, Math.min(5, stored))),
      'aria-label': `${def.name} sale quantity`, 'data-testid': `sell-amount-${def.id}`,
    }) as HTMLInputElement;
    const sellChosen = (): void => runAndRender(actions.sellCrop(def.id, Number(input.value)), actions, rerender);
    list.append(h('div', { class: 'farm-card', 'data-testid': `market-card-${def.id}` },
      spriteImg(`icon:produce_${def.id.replace('crop_', '')}`, 'icon-lg'),
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, def.name),
        h('div', { class: `market-price ${movement.direction}` },
          `${formatMoney(quote.currentCents)} / unit · ${movement.direction === 'up' ? '▲' : movement.direction === 'down' ? '▼' : '•'} ${formatMoney(Math.abs(movement.delta))}`,
        ),
        h('div', { class: 'farm-card-sub' }, `Previous ${formatMoney(quote.previousCents)} · Base ${formatMoney(def.basePriceCents)}`),
        h('div', { class: 'farm-card-stock', 'data-testid': `stored-${def.id}` }, `Stored: ${stored}`),
      ),
      h('div', { class: 'market-sell-controls' },
        input,
        h('button', { class: 'btn btn-sm', 'data-testid': `sell-one-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, 1), actions, rerender) }, 'Sell 1'),
        h('button', { class: 'btn btn-primary btn-sm', 'data-testid': `sell-chosen-${def.id}`, onclick: sellChosen }, 'Sell amount'),
        h('button', { class: 'btn btn-sm', 'data-testid': `sell-all-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, stored), actions, rerender) }, 'Sell all'),
      ),
    ));
  }
  body.append(list);
}

export function openCountyWorkOrder(state: GameState, actions: FarmPanelActions): void {
  const spec = {
    title: 'Mae Carter · Farm Services',
    body: (body: HTMLElement): void => renderCountyWorkOrder(body, state, actions),
  };
  openPanel(spec);
}

function renderCountyWorkOrder(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
  clearChildren(body);
  const status = townContact(state).status;
  const progress = countyWorkOrderProgress(state);
  if (status === 'completed') {
    body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-completed' },
      h('strong', {}, 'First delivery recorded'),
      h('span', {}, 'Mae Carter: The County Pantry has your corn, and your farm is on the board now.'),
    ));
    return;
  }
  if (status === 'active') {
    body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-active' },
      h('strong', {}, COUNTY_PANTRY_CORN_ORDER.title),
      h('span', {}, `Mae Carter: Eli at the County Grain Exchange is waiting for ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} corn.`),
      h('span', {}, `Barn progress: ${progress.storedUnits} / ${progress.requiredUnits} corn.`),
      h('span', {}, `Fixed county payout: ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)}.`),
    ));
    return;
  }
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-offer' },
    h('strong', {}, 'A first county delivery'),
    h('span', {}, 'Mae Carter: Welcome to the County Service Center. The County Pantry needs a dependable first corn delivery.'),
    h('span', {}, `Grow, harvest, and store ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} corn; Eli will pay a fixed ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)} at the Grain Exchange.`),
    h('button', {
      class: 'btn btn-primary', 'data-testid': 'accept-county-work-order',
      onclick: () => runAndRender(actions.acceptCountyWorkOrder(), actions, () => renderCountyWorkOrder(body, state, actions)),
    }, 'Accept County Work Order'),
  ));
}

export function openFarmLand(state: GameState, actions: FarmPanelActions): void {
  const spec = {
    title: 'Land Portfolio',
    body: (body: HTMLElement): void => renderLand(body, state, actions),
  };
  openPanel(spec);
}

function renderLand(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
  clearChildren(body);
  const farm = farmOf(state);
  const owned = farm.parcels.northOwned;
  const rerender = (): void => renderLand(body, state, actions);
  body.append(h('div', { class: `land-card ${owned ? 'owned' : 'locked'}`, 'data-testid': 'neighbor-parcel-card' },
    h('div', { class: 'land-card-badge' }, owned ? 'OWNED' : 'LOCKED'),
    h('div', { class: 'farm-card-title' }, 'Neighboring Field Parcel'),
    h('div', { class: 'land-price', 'data-testid': 'parcel-price' }, formatMoney(FIRST_PARCEL_PRICE_CENTS)),
    h('p', {}, 'Adds nine adjacent usable field sections. Ownership is permanent and saved; repeat purchases are blocked.'),
    owned
      ? h('div', { class: 'owned-mark', 'data-testid': 'parcel-owned' }, 'Purchased · field sections unlocked')
      : h('button', { class: 'btn btn-primary', 'data-testid': 'buy-parcel-button', onclick: () => runAndRender(actions.buyLand(), actions, rerender) }, 'Purchase Parcel'),
  ));
}

export interface FarmEquipmentOnFarmActions {
  context: 'farm';
  operating: boolean;
  jobActive: boolean;
  onToggleOperating: () => void;
  onClose: () => void;
}

export interface FarmEquipmentTownActions {
  context: 'town';
  onClose: () => void;
}

export type FarmEquipmentActions = FarmEquipmentOnFarmActions | FarmEquipmentTownActions;

export function equipmentPanelAllowsOperation(actions: FarmEquipmentActions): boolean {
  return actions.context === 'farm';
}

export function openFarmEquipment(state: GameState, actions: FarmEquipmentActions): void {
  const tractor = farmOf(state).equipment.tractor;
  const onFarm = equipmentPanelAllowsOperation(actions);
  const operating = actions.context === 'farm' ? actions.operating : false;
  const jobActive = actions.context === 'farm' ? actions.jobActive : false;
  const onToggleOperating = actions.context === 'farm' ? actions.onToggleOperating : null;
  openPanel({
    title: onFarm ? 'Farm Equipment' : 'Farm Services Equipment Desk',
    onClose: actions.onClose,
    body: (body) => body.append(h('div', { class: 'equipment-card', 'data-testid': 'tractor-panel' },
      h('div', { class: 'tractor-illustration' }, 'TRACTOR'),
      h('div', { class: 'farm-card-title' }, tractor.name),
      h('div', { class: `equipment-status ${tractor.status}` }, `Status: ${tractor.status === 'operational' ? 'Operational' : 'Maintenance'}`),
      h('p', {}, `Field efficiency: ${tractor.workSpeedBonusBps / 100}% faster crop cycles and +${tractor.harvestBonusUnits} unit per harvest.`),
      h('p', { class: 'equipment-mode', 'data-testid': 'tractor-mode' }, !onFarm
        ? 'Equipment record on file - tractor operation is available back at the farm'
        : operating
          ? jobActive ? 'Operating - field job in progress' : 'Operating - ready to drive or work a parcel'
          : 'Parked - select Operate to climb aboard'),
      ...(onFarm ? [h('button', {
        class: 'btn btn-primary equipment-operate',
        'data-testid': operating ? 'exit-tractor' : 'operate-tractor',
        ...(jobActive ? { disabled: 'true' } : {}),
        onclick: () => {
          closePanel();
          onToggleOperating?.();
        },
      }, operating ? jobActive ? 'Finish or cancel job before exiting' : 'Exit Tractor' : 'Operate Tractor')] : []),
      h('div', { class: 'panel-note', 'data-testid': onFarm ? 'farm-equipment-note' : 'town-equipment-note' }, !onFarm
        ? 'The Equipment Desk can review the tractor record here. Return to the farm to climb aboard and operate it.'
        : operating
          ? 'Click open ground to drive. Click an owned 3x3 field to choose batch planting or harvesting. Escape cancels active work.'
          : 'The driver is hidden while aboard. Tractor position is saved; active field jobs safely reset after reload.'),
    )),
  });
}
