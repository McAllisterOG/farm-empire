import type { ActionResult, GameState } from '../../core/types';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, cheapestFarmSeed, farmCropUnlockInfo, farmOf, formatMoney, marketMovement, storageUsed,
} from '../../core/farmBusiness';
import { BARN_LOFT_EXPANSION as BARN_LOFT_DEF, COUNTY_GRAIN_SILO, COUNTY_HARVEST_WAGON, COUNTY_ROW_CROP_FIELD_KIT, COUNTY_UTILITY_TRAILER, OLD_TRACTOR_RESTORATION } from '../../data/farmEquipment.data';
import { harvestWagonReadout } from '../../core/farmBusiness';
import { farmParcelDef, farmParcelSectionCount } from '../../core/farmParcels';
import { farmCropEconomics } from '../../core/farmCropEconomics';
import { COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY, COUNTY_PANTRY_CORN_ORDER } from '../../data/townWorkOrders.data';
import { countyWorkOrderProgress, townContact } from '../../core/farmTownContact';
import { countyKitchenProgress } from '../../core/farmCountyKitchen';
import { countyFreightTemplate, COUNTY_FREIGHT_BULK_PREMIUM_BPS, COUNTY_FREIGHT_PREMIUM_BPS } from '../../data/countyFreight.data';
import { countyFreightBoardState, countyFreightProgress } from '../../core/farmCountyFreight';
import { maxBarnCropLoadToPickup, maxFarmSeedLoadToPickup, maxPickupCropSale, maxPickupCropUnloadToBarn, maxPickupSeedUnloadToFarm, maxTownSeedPurchase, pickupCargoCapacity, pickupCargoRemaining, pickupCargoUsed, pickupCropUnits, pickupSeedUnits, reservedMarketCropUnits, type FarmQuantityBatch } from '../../core/farmPickup';
import { h, spriteImg, clearChildren } from '../dom';
import { closePanel, openPanel } from '../modal';
import { formatFarmCapacity, formatFarmOpenCapacity } from '../../core/farmCargoScale';

type Dispatch = (result: ActionResult) => void;

export interface FarmPanelActions {
  context: FarmMarketContext;
  buySeeds: (cropId: string, count: number) => ActionResult;
  sellCrop: (cropId: string, count: number) => ActionResult;
  sellBatch?: (batch: FarmQuantityBatch) => ActionResult;
  loadBatch?: (batch: FarmQuantityBatch) => ActionResult;
  loadCrop?: (cropId: string, count: number) => ActionResult;
  unloadCrop?: (cropId: string, count: number) => ActionResult;
  loadSeeds?: (cropId: string, count: number) => ActionResult;
  unloadSeeds?: (cropId: string, count: number) => ActionResult;
  pickupPresent: boolean;
  cargoAtPad: boolean;
  buyLand: () => ActionResult;
  acceptCountyWorkOrder: () => ActionResult;
  fulfillCountyWorkOrder: () => ActionResult;
  acceptCountyKitchenDelivery: () => ActionResult;
  fulfillCountyKitchenDelivery: () => ActionResult;
  acceptCountyFreight: (offerId: string) => ActionResult;
  fulfillCountyFreight: () => ActionResult;
  issueCountyReliefSeed: () => ActionResult;
  purchaseBarnLoft: () => ActionResult;
  dispatch: Dispatch;
}

/** A market panel is reusable, but County fulfillment is only available at Eli's exchange. */
export type FarmMarketContext = 'farm' | 'town';

export interface CountyDeliveryMarketState {
  showCountyOrder: boolean;
  deliveryReady: boolean;
}

export interface CountyFreightMarketState {
  showBoard: boolean;
  deliveryReady: boolean;
}

/** Compact cargo facts shared by the panels and regression tests; counts stay authoritative in core. */
export function cargoPanelPresentation(state: GameState, context: FarmMarketContext): { cropIds: string[]; pickupProduceUsed: number; pickupSeedUsed: number } {
  const farm = farmOf(state);
  const pickupProduceUsed = allFarmCrops().reduce((total, crop) => total + pickupCropUnits(state, crop.id) * crop.storageUnitsPerItem, 0);
  const pickupSeedUsed = Math.max(0, pickupCargoUsed(state) - pickupProduceUsed);
  return {
    cropIds: allFarmCrops().filter((crop) => context === 'town'
      ? pickupCropUnits(state, crop.id) > 0
      : (farm.storage[crop.id] ?? 0) > 0 || pickupCropUnits(state, crop.id) > 0).map((crop) => crop.id),
    pickupProduceUsed,
    pickupSeedUsed,
  };
}

export function harvestWagonProgressPresentation(state: GameState): { current: string; next: string; unlocked: boolean } {
  const farm = farmOf(state); const wagon = farm.equipment.harvestWagon;
  const unlocked = farm.equipment.tractor.status === 'operational' && farm.equipment.countyRowCropFieldKitOwned && farm.parcels.northOwned && farm.countyFreight.lastCompletedDay > 0;
  const current = wagon.owned
    ? `Current: ${wagon.tier === 'county' ? 'County wagon' : 'Basic wagon'} · ${harvestWagonReadout(state)} · receiving-bay unload only.`
    : 'Current: no wagon · restoration includes the basic wagon.';
  const next = wagon.tier === 'county' ? 'Next: County wagon owned · expanded capacity'
    : `Next: County Harvest Wagon · expanded capacity · ${formatMoney(COUNTY_HARVEST_WAGON.priceCents)} · ${unlocked ? 'ready at this desk' : `needs ${[farm.equipment.tractor.status !== 'operational' && 'restored tractor', !farm.equipment.countyRowCropFieldKitOwned && 'Implement Set', !farm.parcels.northOwned && 'neighboring acreage', farm.countyFreight.lastCompletedDay < 1 && 'one freight haul'].filter(Boolean).join(' · ')}`}`;
  return { current, next, unlocked };
}

export function countyFreightMarketState(state: GameState, context: FarmMarketContext = 'farm', pickupPresent?: boolean): CountyFreightMarketState {
  const board = countyFreightBoardState(state);
  const progress = countyFreightProgress(state, { pickupPresent: pickupPresent === true, source: 'pickup' });
  return {
    showBoard: context === 'town' && board.unlocked,
    deliveryReady: context === 'town' && !!board.active && pickupPresent === true && progress.loadedUnits >= progress.requiredUnits,
  };
}

/** Defaults closed so a new farm-side caller cannot accidentally expose County delivery. */
export function countyDeliveryMarketState(state: GameState, context: FarmMarketContext = 'farm', pickupPresent?: boolean): CountyDeliveryMarketState {
  const showCountyOrder = context === 'town' && townContact(state).status === 'active';
  const progress = countyWorkOrderProgress(state, { pickupPresent: pickupPresent === true, source: 'pickup' });
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
    title: actions.context === 'town' ? 'County Feed & Seed' : 'Seed Bags & Pickup',
    className: 'panel-wide',
    body: (body: HTMLElement): void => renderSeedShop(body, state, actions),
  };
  openPanel(spec);
}

function renderSeedShop(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
  clearChildren(body);
  body.classList.toggle('farm-seed-transfer-context', actions.context === 'farm');
  const farm = farmOf(state);
  const cargoUsed = pickupCargoUsed(state);
  const cargoCapacity = pickupCargoCapacity(state);
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', {}, `Available cash: ${formatMoney(farm.cashCents)}`),
    h('strong', { 'data-testid': 'seed-shop-pickup-capacity' }, `Pickup capacity: ${formatFarmCapacity(cargoUsed, cargoCapacity)} · ${formatFarmOpenCapacity(cargoUsed, cargoCapacity)}`),
    h('span', {}, actions.context === 'town' ? 'Purchased seed bags enter the pickup.' : 'Farm seed bags stay here until you load them into the pickup.'),
    ...(actions.context === 'town' && !actions.pickupPresent ? [h('strong', { class: 'panel-note' }, 'On foot: bring the pickup here to buy seeds.')] : []),
  ));
  const list = h('div', { class: 'farm-card-list' });
  const rerender = (): void => renderSeedShop(body, state, actions);
  for (const def of allFarmCrops()) {
    const unlock = farmCropUnlockInfo(state, def.id);
    const gross = def.harvestYield * def.basePriceCents;
    const margin = gross - def.seedPriceCents;
    const seedQuantity = h('input', { class: 'market-qty', type: 'number', min: '1', value: '1', 'aria-label': `${def.name} seed quantity`, 'data-testid': `seed-quantity-${def.id}` }) as HTMLInputElement;
    const maxTownPurchase = maxTownSeedPurchase(state, def.id, actions.pickupPresent);
    if (maxTownPurchase > 0) seedQuantity.max = String(maxTownPurchase);
    else if (actions.context === 'town') seedQuantity.disabled = true;
    const maxFarmToPickup = maxFarmSeedLoadToPickup(state, def.id);
    const maxPickupToFarm = maxPickupSeedUnloadToFarm(state, def.id);
    list.append(h('div', { class: 'farm-card', 'data-testid': `seed-card-${def.id}` },
      spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-lg'),
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, def.name),
        h('div', { class: 'farm-card-sub' },
          `${formatMoney(def.seedPriceCents)} / bag · ${Math.round(def.growMs / 1000)}s · ${def.harvestYield} harvest`,
        ),
        h('div', { class: 'farm-card-stock', 'data-testid': `seed-count-${def.id}` }, `Farm seeds: ${farm.seeds[def.id] ?? 0} · Pickup: ${pickupSeedUnits(state, def.id)}`),
        ...(actions.context === 'town' ? [h('details', { class: 'farm-card-details' },
          h('summary', {}, 'Business details'),
          h('div', { class: 'farm-card-sub' }, `${def.role} · Gross ${formatMoney(gross)} · Margin ${formatMoney(margin)}`),
          h('div', { class: 'farm-card-sub' }, `1 ${def.name} per produce unit · ${unlock.unlocked ? unlock.requirement : `Locked: ${unlock.requirement}`}`),
        )] : []),
      ),
      h('div', { class: 'farm-card-actions' },
        ...(actions.context === 'town' ? [
          seedQuantity,
          h('button', { class: 'btn btn-primary btn-sm', 'data-testid': `buy-seeds-${def.id}`, ...(!maxTownPurchase ? { disabled: 'true', title: !unlock.unlocked ? unlock.requirement : !actions.pickupPresent ? 'Bring the pickup to town.' : pickupCargoRemaining(state) <= 0 ? 'Pickup cargo is full.' : 'Not enough cash.' } : {}), onclick: () => runAndRender(actions.buySeeds(def.id, Number(seedQuantity.value)), actions, rerender) }, 'Buy'),
          h('button', { class: 'btn btn-sm', 'data-testid': `buy-max-seeds-${def.id}`, ...(!maxTownPurchase ? { disabled: 'true', title: !unlock.unlocked ? unlock.requirement : !actions.pickupPresent ? 'Bring the pickup to town.' : pickupCargoRemaining(state) <= 0 ? 'Pickup cargo is full.' : 'Not enough cash.' } : {}), onclick: () => runAndRender(actions.buySeeds(def.id, maxTownPurchase), actions, rerender) }, maxTownPurchase ? `Max ${maxTownPurchase}` : 'Max'),
        ] : [
          seedQuantity,
          ...(actions.loadSeeds ? [h('button', { class: 'btn btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.loadSeeds!(def.id, Number(seedQuantity.value)), actions, rerender) }, 'Farm → Pickup')] : []),
          ...(actions.loadSeeds ? [h('button', { class: 'btn btn-sm', 'data-testid': `seed-all-farm-to-pickup-${def.id}`, ...(!maxFarmToPickup ? { disabled: 'true', title: !actions.cargoAtPad ? 'Park at the barn cargo pad.' : 'No seed cargo can fit.' } : {}), onclick: () => runAndRender(actions.loadSeeds!(def.id, maxFarmToPickup), actions, rerender) }, 'All → Pickup')] : []),
          ...(actions.unloadSeeds ? [h('button', { class: 'btn btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.unloadSeeds!(def.id, Number(seedQuantity.value)), actions, rerender) }, 'Pickup → Farm')] : []),
          ...(actions.unloadSeeds ? [h('button', { class: 'btn btn-sm', 'data-testid': `seed-all-pickup-to-farm-${def.id}`, ...(!maxPickupToFarm ? { disabled: 'true', title: !actions.cargoAtPad ? 'Park at the barn cargo pad.' : 'No pickup seeds to unload.' } : {}), onclick: () => runAndRender(actions.unloadSeeds!(def.id, maxPickupToFarm), actions, rerender) }, 'All → Farm')] : []),
        ]),
      ),
    ));
  }
  body.append(list);
}

export function openFarmMarket(state: GameState, actions: FarmPanelActions, context: FarmMarketContext = 'farm'): void {
  const spec = {
    title: context === 'town' ? 'County Grain Exchange' : 'Barn & Pickup Cargo',
    className: 'panel-wide',
    body: (body: HTMLElement): void => renderMarket(body, state, actions, context),
  };
  openPanel(spec);
}

function quantitySelector(defName: string, max: number, value: number, onChange: (value: number) => void, testId: string): HTMLElement {
  const exact = h('output', { class: 'quantity-value', 'data-testid': `${testId}-value`, 'aria-live': 'polite' }, String(value));
  const slider = h('input', { class: 'quantity-slider', type: 'range', min: '0', max: String(max), step: '1', value: String(value), 'aria-label': `${defName} quantity`, 'data-testid': `${testId}-slider` }) as HTMLInputElement;
  const set = (next: number): void => { const safe = Math.max(0, Math.min(max, Math.floor(next))); slider.value = String(safe); exact.textContent = String(safe); onChange(safe); };
  slider.addEventListener('input', () => set(Number(slider.value)));
  return h('div', { class: 'quantity-selector', 'data-testid': testId },
    h('div', { class: 'quantity-selector-head' }, h('span', {}, defName), exact),
    h('div', { class: 'quantity-selector-controls' },
      h('button', { class: 'btn btn-sm quantity-step', type: 'button', 'aria-label': `Decrease ${defName}`, onclick: () => set(Number(slider.value) - 1) }, '−'),
      slider,
      h('button', { class: 'btn btn-sm quantity-step', type: 'button', 'aria-label': `Increase ${defName}`, onclick: () => set(Number(slider.value) + 1) }, '+'),
      h('button', { class: 'btn btn-sm', type: 'button', 'data-testid': `${testId}-max`, onclick: () => set(max) }, 'Max'),
    ),
  );
}

function renderMarket(body: HTMLElement, state: GameState, actions: FarmPanelActions, context: FarmMarketContext): void {
  clearChildren(body);
  body.classList.toggle('farm-cargo-context', context === 'farm');
  body.classList.remove('farm-seed-transfer-context');
  const farm = farmOf(state);
  const used = storageUsed(state);
  const pickupUsed = pickupCargoUsed(state);
  const cargoPresentation = cargoPanelPresentation(state, context);
  const { pickupProduceUsed, pickupSeedUsed } = cargoPresentation;
  body.append(h('div', { class: 'farm-panel-summary' },
      h('strong', { 'data-testid': 'market-cash' }, `Cash: ${formatMoney(farm.cashCents)}`),
    ...(context === 'farm' ? [h('div', { class: 'cargo-capacity-grid', 'data-testid': 'market-capacity' },
      h('strong', { class: 'cargo-capacity barn' }, `Storage · ${formatFarmCapacity(used, farm.storageCapacity)} · ${formatFarmOpenCapacity(used, farm.storageCapacity)}`),
      h('strong', { class: 'cargo-capacity pickup' }, `Pickup · ${formatFarmCapacity(pickupUsed, pickupCargoCapacity(state))}`),
      h('strong', { class: 'cargo-capacity wagon' }, `Harvest wagon · ${harvestWagonReadout(state).replace(/\blb\b/g, '')}`),
    )] : [h('strong', { 'data-testid': 'market-capacity' }, `Pickup · Produce ${pickupProduceUsed} · Seed bags ${pickupSeedUsed} · Total ${formatFarmCapacity(pickupUsed, pickupCargoCapacity(state))}`)]),
    h('span', {}, context === 'town' ? (actions.pickupPresent ? 'Sell pickup produce or deliver a County order.' : 'On foot: bring the pickup to sell or deliver.') : 'Barn and pickup transfer produce here. Harvest wagon unloads only at the receiving bay.'),
    ...(context === 'farm' && !actions.cargoAtPad ? [h('strong', { class: 'panel-note', 'data-testid': 'cargo-pad-guidance' }, 'Park the pickup at the barn cargo pad to load or unload.')] : []),
  ));

  if (context === 'farm') body.append(h('div', { class: 'cargo-panel-switch' },
    h('strong', {}, 'Produce cargo'),
    h('button', { class: 'btn btn-sm', 'data-testid': 'open-seed-cargo', onclick: () => openFarmSeedShop(state, actions) }, 'Seed Bags'),
  ));

  if (context === 'town') {
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
  }

  const countyDelivery = countyDeliveryMarketState(state, context, actions.pickupPresent);
  if (countyDelivery.showCountyOrder) {
    const progress = countyWorkOrderProgress(state, { pickupPresent: actions.pickupPresent, source: 'pickup' });
    const order = h('div', { class: 'farm-card county-work-order', 'data-testid': 'county-work-order-market' },
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, COUNTY_PANTRY_CORN_ORDER.title),
        h('div', { class: 'farm-card-sub' }, `County delivery: ${progress.storedUnits} / ${progress.requiredUnits} corn in pickup · fixed ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)} payout`),
        h('div', { class: 'farm-card-stock' }, countyDelivery.deliveryReady ? 'Ready for Eli to accept.' : 'Load the remaining corn into the pickup.'),
      ),
      h('button', {
        class: 'btn btn-primary btn-sm', 'data-testid': 'deliver-county-work-order',
        ...(countyDelivery.deliveryReady ? {} : { disabled: 'true' }),
        onclick: () => runAndRender(actions.fulfillCountyWorkOrder(), actions, rerender),
      }, `Deliver ${progress.requiredUnits} corn`),
    );
    body.append(order);
  }

  const freightMarket = countyFreightMarketState(state, context, actions.pickupPresent);
  if (freightMarket.showBoard) {
    const board = countyFreightBoardState(state);
    if (board.active) {
      const contract = board.active;
      const template = countyFreightTemplate(contract.cropId);
      const crop = farmCropDef(contract.cropId);
      const progress = countyFreightProgress(state, { pickupPresent: actions.pickupPresent, source: 'pickup' });
      body.append(h('div', { class: 'farm-card county-work-order', 'data-testid': 'county-freight-active' },
        h('div', { class: 'farm-card-main' },
          h('div', { class: 'farm-card-title' }, `${contract.kind === 'bulk' ? 'Commercial Bulk Route · ' : 'County Freight Board · '}${template.title}`),
          h('div', { class: 'farm-card-sub' }, `${template.buyer} · ${progress.loadedUnits} / ${contract.requiredUnits} ${crop.name} in pickup`),
          h('div', { class: 'farm-card-stock' }, `Accepted Day ${contract.issuedDay} · locked payout ${formatMoney(contract.payoutCents)} · ${contract.kind === 'bulk' ? 'TRAILER REQUIRED · 40% above today’s posted rate' : '25% above today’s posted rate'} · no deadline`),
        ),
        h('button', {
          class: 'btn btn-primary btn-sm', 'data-testid': 'deliver-county-freight',
          ...(freightMarket.deliveryReady ? {} : { disabled: 'true' }),
          onclick: () => runAndRender(actions.fulfillCountyFreight(), actions, rerender),
        }, `Deliver ${contract.requiredUnits}`),
      ));
    } else if (board.offers.length > 0) {
      body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-freight-choice-summary' },
        h('strong', {}, board.offers.some((offer) => offer.kind === 'bulk') ? 'County Freight Board · 3 routes posted · one commercial bulk load' : `County Freight Board · ${board.offers.length} routes posted`),
        h('span', {}, 'Choose one route. Posted bids refresh with the next farm day; accepted terms remain locked until delivery.'),
      ));
      for (const offer of board.offers) {
        const template = countyFreightTemplate(offer.cropId);
        const crop = farmCropDef(offer.cropId);
        const premiumBps = offer.kind === 'bulk' ? COUNTY_FREIGHT_BULK_PREMIUM_BPS : COUNTY_FREIGHT_PREMIUM_BPS;
        body.append(h('div', { class: 'farm-card county-work-order', 'data-testid': `county-freight-offer-${offer.cropId}` },
          h('div', { class: 'farm-card-main' },
            h('div', { class: 'farm-card-title' }, `${offer.kind === 'bulk' ? 'Commercial Bulk Route · ' : ''}${template.title}`),
            h('div', { class: 'farm-card-sub' }, `${template.buyer} requests ${offer.requiredUnits} ${crop.name}.`),
            h('div', { class: 'farm-card-stock' }, `${offer.kind === 'bulk' ? 'TRAILER REQUIRED · ' : ''}Pickup: ${pickupCropUnits(state, offer.cropId)} · ${formatMoney(offer.payoutCents)} locked payout · ${(premiumBps / 100).toFixed(0)}% above today’s posted rate`),
          ),
          h('button', { class: 'btn btn-primary btn-sm', 'data-testid': `accept-county-freight-${offer.cropId}`, onclick: () => runAndRender(actions.acceptCountyFreight(offer.id), actions, rerender) }, 'Accept Route'),
        ));
      }
    } else {
      body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-freight-completed-today' },
        h('strong', {}, 'County Freight Board · route complete'),
        h('span', {}, 'Eli will post another crop haul on the next farm day.'),
      ));
    }
  }

  const rerender = (): void => renderMarket(body, state, actions, context);
  const list = h('div', { class: 'farm-card-list market-list' });
  const selected: Record<string, number> = {};
  const selectionMax = (defId: string): number => context === 'town' ? maxPickupCropSale(state, defId) : maxBarnCropLoadToPickup(state, defId);
  const submitBatch = (): void => {
    const batch = Object.fromEntries(Object.entries(selected).filter(([, count]) => count > 0));
    if (Object.keys(batch).length === 0) return;
    const result = context === 'town' ? actions.sellBatch?.(batch) : actions.loadBatch?.(batch);
    if (result) runAndRender(result, actions, rerender);
  };
  for (const def of allFarmCrops()) {
    const quote = farm.market.quotes[def.id];
    const movement = marketMovement(quote.currentCents, quote.previousCents);
    const stored = context === 'town' ? pickupCropUnits(state, def.id) : farm.storage[def.id] ?? 0;
    const maxBarnToPickup = maxBarnCropLoadToPickup(state, def.id);
    const maxPickupToBarn = maxPickupCropUnloadToBarn(state, def.id);
    if (!cargoPresentation.cropIds.includes(def.id)) continue;
    const canLoad = maxBarnToPickup > 0;
    const canUnload = maxPickupToBarn > 0;
    const max = selectionMax(def.id);
    selected[def.id] = context === 'town' ? max : 0;
    const input = quantitySelector(def.name, max, Math.min(max, stored), (value) => { selected[def.id] = value; }, `quantity-${def.id}`);
    list.append(h('div', { class: 'farm-card', 'data-testid': `market-card-${def.id}` },
      spriteImg(`icon:produce_${def.id.replace('crop_', '')}`, 'icon-lg'),
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, def.name),
        h('div', { class: `market-price ${movement.direction}` },
          `${formatMoney(quote.currentCents)} each · ${movement.direction === 'up' ? '▲' : movement.direction === 'down' ? '▼' : '•'} ${formatMoney(Math.abs(movement.delta))}`,
        ),
        h('div', { class: 'farm-card-stock', 'data-testid': `stored-${def.id}` }, `${context === 'town' ? 'Pickup' : 'Barn'}: ${stored} · ${context === 'town' && reservedMarketCropUnits(state, def.id) > 0 ? `${reservedMarketCropUnits(state, def.id)} reserved` : ''}`),
      ),
      h('div', { class: 'market-sell-controls' },
        ...(context === 'town' ? [
          input,
        ] : [
          ...(canLoad ? [input] : []),
          ...(canUnload && actions.unloadCrop ? [h('button', { class: 'btn btn-sm', 'data-testid': `unload-${def.id}`, onclick: () => runAndRender(actions.unloadCrop!(def.id, maxPickupToBarn), actions, rerender) }, 'Pickup → Barn')] : []),
          ...(!canLoad && !canUnload ? [h('span', { class: 'panel-note cargo-control-unavailable' }, !actions.cargoAtPad ? 'Park pickup at cargo pad' : stored > 0 ? 'Pickup has no open payload' : 'Barn has no open storage')] : []),
        ]),
      ),
    ));
  }
  if (Object.keys(selected).length > 0) list.insertBefore(h('button', { class: 'btn btn-primary cargo-batch-submit', 'data-testid': context === 'town' ? 'sell-selected-produce' : 'load-pickup', onclick: submitBatch }, context === 'town' ? 'Sell All Surplus' : 'Load Pickup'), list.firstChild);
  if (context === 'town' && list.childElementCount === 0) {
    list.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'town-empty-produce' },
      h('strong', {}, 'No produce loaded'),
      h('span', {}, `Seed bags: ${pickupSeedUsed} · Total pickup: ${formatFarmCapacity(pickupUsed, pickupCargoCapacity(state))}`),
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
  const progress = countyWorkOrderProgress(state, { pickupPresent: actions.pickupPresent, source: 'pickup' });
  const farm = farmOf(state);
  const loftOwned = farm.equipment.barnLoftExpansionOwned;
  const loftCard = h('div', { class: 'farm-card', 'data-testid': 'barn-loft-expansion' },
    h('div', { class: 'farm-card-main' },
      h('div', { class: 'farm-card-title' }, BARN_LOFT_DEF.name),
      h('div', { class: 'farm-card-sub' }, `One-time investment · ${formatMoney(BARN_LOFT_DEF.priceCents)} · storage ${BARN_LOFT_DEF.fromCapacity} → ${BARN_LOFT_DEF.toCapacity}`),
      h('div', { class: 'farm-card-stock' }, loftOwned ? 'Owned · barn loft installed' : farm.parcels.northOwned ? 'Unlocked · neighboring parcel owned' : 'Locked · buy the neighboring parcel first'),
    ),
    ...(!loftOwned && farm.parcels.northOwned ? [h('button', { class: 'btn btn-primary btn-sm', 'data-testid': 'buy-barn-loft', onclick: () => runAndRender(actions.purchaseBarnLoft(), actions, () => renderCountyWorkOrder(body, state, actions)) }, `Purchase for ${formatMoney(BARN_LOFT_DEF.priceCents)}`)] : []),
  );
  body.append(loftCard);
  const cheapest = cheapestFarmSeed();
  const relief = h('div', { class: 'farm-card', 'data-testid': 'county-relief' },
    h('div', { class: 'farm-card-title' }, 'Last-resort seed relief'),
    h('div', { class: 'farm-card-sub' }, `Mae can issue exactly one ${cheapest.name} seed only when cash is below ${formatMoney(cheapest.priceCents)}, every seed and stored crop is gone, and no field crop can still mature or be harvested. Withered sections do not block relief.`),
    h('button', { class: 'btn btn-sm', 'data-testid': 'claim-county-relief', onclick: () => runAndRender(actions.issueCountyReliefSeed(), actions, () => renderCountyWorkOrder(body, state, actions)) }, 'Check relief eligibility'),
  );
  body.append(relief);
  if (status === 'completed') {
    const freight = countyFreightBoardState(state);
    const freightLine = freight.active
      ? `Active freight: ${countyFreightTemplate(freight.active.cropId).title} · ${countyFreightProgress(state, { pickupPresent: actions.pickupPresent, source: 'pickup' }).loadedUnits} / ${freight.active.requiredUnits} loaded.`
      : freight.offers.length > 0
        ? `${freight.offers.length} Freight Board routes are posted at Eli's Grain Exchange.`
        : 'Today\'s freight route is complete; a new offer posts next farm day.';
    body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-completed' },
      h('strong', {}, 'First delivery recorded'),
      h('span', {}, 'Mae Carter: The County Pantry has your corn, and your farm is on the board now. The Equipment Desk can restore that inherited tractor when you are ready.'),
      h('span', { 'data-testid': 'county-freight-mae-status' }, freightLine),
    ));
    return;
  }
  if (status === 'active') {
    body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-active' },
      h('strong', {}, COUNTY_PANTRY_CORN_ORDER.title),
      h('span', {}, `Mae Carter: Take ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} corn in the pickup to Eli at the Grain Exchange.`),
      h('span', {}, `Pickup cargo progress: ${progress.storedUnits} / ${progress.requiredUnits} corn.`),
      h('span', {}, `Fixed county payout: ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)}.`),
    ));
    return;
  }
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-offer' },
    h('strong', {}, 'A first county delivery'),
    h('span', {}, 'Mae Carter: The County Pantry could use your first corn delivery.'),
    h('span', {}, `Grow ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} corn by hand, carry it through barn and pickup, then let Eli accept it at the Grain Exchange for ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)}.`),
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
  const parcel = farmParcelDef('north');
  const sectionCount = farmParcelSectionCount('north');
  const rerender = (): void => renderLand(body, state, actions);
  body.append(h('div', { class: `land-card ${owned ? 'owned' : 'locked'}`, 'data-testid': 'neighbor-parcel-card' },
    h('div', { class: 'land-card-badge' }, owned ? 'OWNED' : 'LOCKED'),
    h('div', { class: 'farm-card-title' }, parcel.name),
    h('div', { class: 'land-price', 'data-testid': 'parcel-price' }, `${formatMoney(FIRST_PARCEL_PRICE_CENTS)} plus working seed capital`),
    h('p', {}, `Adds ${sectionCount} usable field sections across an ${parcel.columns}×${parcel.rows} commercial acreage. Ownership is permanent, visibly expands the farmhouse, and repeat purchases are blocked.`),
    owned
      ? h('div', { class: 'owned-mark', 'data-testid': 'parcel-owned' }, 'Purchased · field sections unlocked · farmhouse expanded')
      : h('button', { class: 'btn btn-primary', 'data-testid': 'buy-parcel-button', onclick: () => runAndRender(actions.buyLand(), actions, rerender) }, 'Purchase Parcel'),
  ));
  const selected = farmCropDef(farm.selectedCropId);
  const acreagePlan = farmCropEconomics(selected, { sectionCount });
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'land-working-capital' },
    h('strong', {}, `Cash after parcel: ${formatMoney(farm.cashCents - (owned ? 0 : FIRST_PARCEL_PRICE_CENTS))}`),
    h('span', {}, `A full ${sectionCount}-section planting needs ${formatMoney(acreagePlan.seedCostCents)} in ${selected.name} seed capital. You can work any portion of the acreage; this is planning guidance, not a purchase block.`),
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
  onRestoreTractor?: () => ActionResult;
  onPurchaseKit?: () => ActionResult;
  onPurchaseTrailer?: () => ActionResult;
  onPurchaseSilo?: () => ActionResult;
  onPurchaseWagon?: () => ActionResult;
  dispatch?: Dispatch;
  onClose: () => void;
}

export function openCountyKitchen(state: GameState, actions: FarmPanelActions): void {
  openPanel({ title: 'Rosa Alvarez · County Pantry & Kitchen', body: (body) => renderCountyKitchen(body, state, actions) });
}

export interface CountyKitchenPanelState { locked: boolean; status: 'unmet' | 'offered' | 'active' | 'completed'; }
/** Presentation guard shared by Rosa and the kitchen doorway; core retains the authority check. */
export function countyKitchenPanelState(state: GameState): CountyKitchenPanelState {
  const status = farmOf(state).countyKitchen.status;
  return { locked: townContact(state).status !== 'completed', status };
}

function renderCountyKitchen(body: HTMLElement, state: GameState, actions: FarmPanelActions): void {
  clearChildren(body); const farm = farmOf(state); const kitchen = farm.countyKitchen; const panel = countyKitchenPanelState(state); const cargo = COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.cargo;
  const progress = countyKitchenProgress(state, { pickupPresent: actions.pickupPresent, source: 'pickup' });
  const ready = actions.pickupPresent && progress.crop_corn >= cargo.crop_corn && progress.crop_carrots >= cargo.crop_carrots && progress.crop_tomatoes >= cargo.crop_tomatoes;
  const line = `Corn ${Math.min(progress.crop_corn, cargo.crop_corn)}/${cargo.crop_corn} · Carrots ${Math.min(progress.crop_carrots, cargo.crop_carrots)}/${cargo.crop_carrots} · Tomatoes ${Math.min(progress.crop_tomatoes, cargo.crop_tomatoes)}/${cargo.crop_tomatoes}`;
  const rerender = (): void => renderCountyKitchen(body, state, actions);
  if (panel.locked) { body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-kitchen-locked' }, h('strong', {}, 'County Pantry first'), h('span', {}, 'Complete Mae and Eli’s County Pantry delivery before Rosa can post a Garden Table order.'))); return; }
  if (kitchen.status === 'completed') { body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-kitchen-completed' }, h('strong', {}, 'Garden Table Delivery served'), h('span', {}, 'Rosa Alvarez: The table is full, and the kitchen is grateful.'))); return; }
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-kitchen-delivery' }, h('strong', {}, 'Garden Table Delivery'), h('span', {}, 'Rosa needs one exact pickup load: 8 corn, 6 carrots, and 4 tomatoes.'), h('span', { 'data-testid': 'county-kitchen-progress' }, line), h('span', {}, `One-time payout: ${formatMoney(COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY.payoutCents)}.`), kitchen.status === 'active'
    ? h('button', { class: 'btn btn-primary', 'data-testid': 'deliver-county-kitchen', ...(ready ? {} : { disabled: 'true' }), onclick: () => runAndRender(actions.fulfillCountyKitchenDelivery(), actions, rerender) }, 'Serve Garden Table')
    : h('button', { class: 'btn btn-primary', 'data-testid': 'accept-county-kitchen', onclick: () => runAndRender(actions.acceptCountyKitchenDelivery(), actions, rerender) }, 'Accept Garden Table Delivery')));
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
  const restored = tractor.status === 'operational';
  const countyComplete = farmOf(state).townContact.status === 'completed';
  const kitOwned = farmOf(state).equipment.countyRowCropFieldKitOwned;
  const kitUnlocked = countyComplete && restored;
  const trailerOwned = farmOf(state).equipment.countyUtilityTrailerOwned;
  const trailerUnlocked = farmOf(state).countyFreight.lastCompletedDay > 0;
  const siloOwned = farmOf(state).equipment.countyGrainSiloOwned;
  const siloUnlocked = farmOf(state).equipment.barnLoftExpansionOwned;
  const wagon = farmOf(state).equipment.harvestWagon;
  const wagonPresentation = harvestWagonProgressPresentation(state);
  const wagonUnlocked = wagonPresentation.unlocked;
  openPanel({
    title: onFarm ? 'Farm Equipment' : 'County Equipment Desk',
    onClose: actions.onClose,
    body: (body) => {
      const restorationStatus = restored
        ? 'Complete · operational'
        : countyComplete ? 'Available here' : 'Locked · County Pantry';
      const kitStatus = kitOwned ? 'Owned · installed' : kitUnlocked ? 'Available here' : countyComplete ? 'Locked · restore tractor' : 'Locked · County Pantry';
      const trailerStatus = trailerOwned ? `Owned · capacity ${pickupCargoCapacity(state)}` : trailerUnlocked ? 'Available here' : 'Locked · one freight haul';
      const siloStatus = siloOwned ? `Owned · capacity ${farmOf(state).storageCapacity}` : siloUnlocked ? 'Available here' : 'Locked · acreage + barn loft';
      const operateButton = onFarm ? h('button', {
        class: 'btn btn-primary equipment-operate',
        'data-testid': operating ? 'exit-tractor' : 'operate-tractor',
        ...(jobActive || !restored ? { disabled: 'true' } : {}),
        onclick: () => {
          closePanel();
          onToggleOperating?.();
        },
      }, operating ? jobActive ? 'Field job in progress' : 'Exit Tractor' : restored ? 'Operate Tractor' : 'Restoration Required') : null;
      body.append(h('div', { class: 'equipment-card', 'data-testid': 'tractor-panel' },
        h('div', { class: 'equipment-hero' },
          h('div', { class: 'tractor-illustration' }, 'TRACTOR'),
          h('div', { class: 'equipment-hero-copy' },
            h('div', { class: 'farm-card-title' }, tractor.name),
            h('div', { class: `equipment-status ${tractor.status}` }, restored ? 'Operational' : 'Needs restoration'),
          ),
          operateButton,
        ),
        ...(!onFarm ? [h('div', { class: 'panel-note' }, 'Equipment purchases only.')] : []),
        h('div', { class: 'equipment-section-label' }, 'Equipment & upgrades'),
        h('details', { class: 'equipment-kit equipment-disclosure', 'data-testid': 'tractor-restoration', ...(!onFarm && !restored && countyComplete ? { open: 'true' } : {}) },
          h('summary', {}, h('span', { class: 'farm-card-title' }, OLD_TRACTOR_RESTORATION.name), h('span', { class: 'equipment-summary-status' }, restorationStatus)),
          h('p', {}, `${formatMoney(OLD_TRACTOR_RESTORATION.priceCents)} · restores the inherited tractor for field service`),
          h('div', { class: 'equipment-mode', 'data-testid': 'tractor-restoration-status' }, restorationStatus),
          ...(!onFarm && !restored && countyComplete && actions.context === 'town' ? [h('button', {
            class: 'btn btn-primary', 'data-testid': 'restore-old-tractor', onclick: () => {
              const result = actions.onRestoreTractor?.(); if (!result) return; actions.dispatch?.(result); if (result.ok) openFarmEquipment(state, actions);
            },
          }, `Restore · ${formatMoney(OLD_TRACTOR_RESTORATION.priceCents)}`)] : []),
        ),
        h('details', { class: 'equipment-kit equipment-disclosure', 'data-testid': 'county-field-kit', ...(!onFarm && !kitOwned && kitUnlocked ? { open: 'true' } : {}) },
          h('summary', {}, h('span', { class: 'farm-card-title' }, COUNTY_ROW_CROP_FIELD_KIT.name), h('span', { class: 'equipment-summary-status' }, kitStatus)),
          h('p', {}, `${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)} · +${COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps / 100}% establishment · +${COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits} harvest item`),
          h('div', { class: 'equipment-mode', 'data-testid': 'county-field-kit-status' }, kitStatus),
          ...(!onFarm && !kitOwned && kitUnlocked && actions.context === 'town' ? [h('button', { class: 'btn btn-primary', 'data-testid': 'buy-county-field-kit', onclick: () => {
            const result = actions.onPurchaseKit?.(); if (!result) return; actions.dispatch?.(result); if (result.ok) openFarmEquipment(state, actions);
          } }, `Purchase · ${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)}`)] : []),
        ),
        h('details', { class: 'equipment-kit equipment-disclosure', 'data-testid': 'harvest-wagon', ...(actions.context === 'town' && wagon.tier !== 'county' && wagonUnlocked ? { open: 'true' } : {}) },
          h('summary', {}, h('span', { class: 'farm-card-title' }, 'Harvest Wagon'), h('span', { class: 'equipment-summary-status' }, wagon.owned ? `${wagon.tier === 'county' ? 'County' : 'Basic'} · ${harvestWagonReadout(state)}` : 'Included with restoration')),
          h('p', { 'data-testid': 'harvest-wagon-current' }, wagonPresentation.current),
          h('div', { class: 'equipment-mode', 'data-testid': 'harvest-wagon-next' }, wagonPresentation.next),
          ...(actions.context === 'town' && wagon.tier !== 'county' && wagonUnlocked ? [h('button', { class: 'btn btn-primary', 'data-testid': 'buy-county-harvest-wagon', onclick: () => { const result = actions.onPurchaseWagon?.(); if (!result) return; actions.dispatch?.(result); if (result.ok) openFarmEquipment(state, actions); } }, `Purchase · ${formatMoney(COUNTY_HARVEST_WAGON.priceCents)}`)] : []),
        ),
        h('details', { class: 'equipment-kit equipment-disclosure', 'data-testid': 'county-utility-trailer', ...(!onFarm && !trailerOwned && trailerUnlocked ? { open: 'true' } : {}) },
          h('summary', {}, h('span', { class: 'farm-card-title' }, COUNTY_UTILITY_TRAILER.name), h('span', { class: 'equipment-summary-status' }, trailerStatus)),
          h('p', {}, `${formatMoney(COUNTY_UTILITY_TRAILER.priceCents)} · pickup capacity ${COUNTY_UTILITY_TRAILER.fromCapacity} → ${COUNTY_UTILITY_TRAILER.toCapacity}`),
          h('div', { class: 'equipment-mode', 'data-testid': 'county-utility-trailer-status' }, trailerStatus),
          ...(!onFarm && !trailerOwned && trailerUnlocked && actions.context === 'town' ? [h('button', {
            class: 'btn btn-primary', 'data-testid': 'buy-county-utility-trailer', onclick: () => {
              const result = actions.onPurchaseTrailer?.(); if (!result) return; actions.dispatch?.(result); if (result.ok) openFarmEquipment(state, actions);
            },
          }, `Purchase · ${formatMoney(COUNTY_UTILITY_TRAILER.priceCents)}`)] : []),
        ),
        h('details', { class: 'equipment-kit equipment-disclosure', 'data-testid': 'county-grain-silo', ...(!onFarm && !siloOwned && siloUnlocked ? { open: 'true' } : {}) },
          h('summary', {}, h('span', { class: 'farm-card-title' }, COUNTY_GRAIN_SILO.name), h('span', { class: 'equipment-summary-status' }, siloStatus)),
          h('p', {}, `${formatMoney(COUNTY_GRAIN_SILO.priceCents)} · ${COUNTY_GRAIN_SILO.toCapacity} farm storage`),
          h('div', { class: 'equipment-mode', 'data-testid': 'county-grain-silo-status' }, siloStatus),
          ...(!onFarm && !siloOwned && siloUnlocked && actions.context === 'town' ? [h('button', {
            class: 'btn btn-primary', 'data-testid': 'buy-county-grain-silo', onclick: () => {
              const result = actions.onPurchaseSilo?.(); if (!result) return; actions.dispatch?.(result); if (result.ok) openFarmEquipment(state, actions);
            },
          }, `Build · ${formatMoney(COUNTY_GRAIN_SILO.priceCents)}`)] : []),
        ),
        h('details', { class: 'farm-card-details equipment-help' },
          h('summary', {}, onFarm ? 'Controls & operation notes' : 'Desk notes'),
          h('p', { class: 'equipment-mode', 'data-testid': 'tractor-mode' }, !onFarm
            ? restored ? 'Tractor operation is available back at the farm.' : 'Restoration is handled at this desk.'
            : operating ? jobActive ? 'Field job in progress.' : 'Operating and ready.' : restored ? 'Parked and ready.' : 'Restoration required.'),
          h('div', { class: 'panel-note', 'data-testid': onFarm ? 'farm-equipment-note' : 'town-equipment-note' }, !onFarm
            ? 'Return to the farm to operate equipment.'
            : 'Drive with WASD, arrows, or click. Select a field to work. Active jobs can be cancelled safely.'),
        ),
      ));
    },
  });
}
