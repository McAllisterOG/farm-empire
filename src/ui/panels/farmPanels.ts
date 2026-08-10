import type { ActionResult, GameState } from '../../core/types';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, farmOf, formatMoney, marketMovement, storageRemaining, storageUsed,
} from '../../core/farmBusiness';
import { h, spriteImg, clearChildren } from '../dom';
import { openPanel } from '../modal';

type Dispatch = (result: ActionResult) => void;

export interface FarmPanelActions {
  buySeeds: (cropId: string, count: number) => ActionResult;
  sellCrop: (cropId: string, count: number) => ActionResult;
  buyLand: () => ActionResult;
  dispatch: Dispatch;
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

export function openFarmMarket(state: GameState, actions: FarmPanelActions): void {
  const spec = {
    title: 'Commodity Market & Barn Storage',
    className: 'panel-wide',
    body: (body: HTMLElement): void => renderMarket(body, state, actions),
  };
  openPanel(spec);
}

function renderMarket(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
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

  const rerender = (): void => renderMarket(body, state, actions);
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
    h('p', {}, 'Adds nine adjacent usable field tiles. Ownership is permanent and saved; repeat purchases are blocked.'),
    owned
      ? h('div', { class: 'owned-mark', 'data-testid': 'parcel-owned' }, 'Purchased · field tiles unlocked')
      : h('button', { class: 'btn btn-primary', 'data-testid': 'buy-parcel-button', onclick: () => runAndRender(actions.buyLand(), actions, rerender) }, 'Purchase Parcel'),
  ));
}

export function openFarmEquipment(state: GameState): void {
  const tractor = farmOf(state).equipment.tractor;
  openPanel({
    title: 'Farm Equipment',
    body: (body) => body.append(h('div', { class: 'equipment-card', 'data-testid': 'tractor-panel' },
      h('div', { class: 'tractor-illustration' }, 'TRACTOR'),
      h('div', { class: 'farm-card-title' }, tractor.name),
      h('div', { class: `equipment-status ${tractor.status}` }, `Status: ${tractor.status === 'operational' ? 'Operational' : 'Maintenance'}`),
      h('p', {}, `Field efficiency: ${tractor.workSpeedBonusBps / 100}% faster crop cycles and +${tractor.harvestBonusUnits} unit per harvest.`),
      h('div', { class: 'panel-note' }, 'Future-ready equipment data: implements, trailers, combines, condition, fuel, dealers, and hauling are deliberately deferred.'),
    )),
  });
}
