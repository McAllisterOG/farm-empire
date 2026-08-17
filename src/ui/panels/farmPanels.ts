import type { ActionResult, GameState } from '../../core/types';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, cheapestFarmSeed, farmCropUnlockInfo, farmOf, formatMoney, marketMovement, storageRemaining, storageUsed,
} from '../../core/farmBusiness';
import { BARN_LOFT_EXPANSION as BARN_LOFT_DEF, COUNTY_GRAIN_SILO, COUNTY_ROW_CROP_FIELD_KIT, COUNTY_UTILITY_TRAILER, OLD_TRACTOR_RESTORATION } from '../../data/farmEquipment.data';
import { farmParcelDef, farmParcelSectionCount } from '../../core/farmParcels';
import { farmCropEconomics } from '../../core/farmCropEconomics';
import { COUNTY_PANTRY_CORN_ORDER } from '../../data/townWorkOrders.data';
import { countyWorkOrderProgress, townContact } from '../../core/farmTownContact';
import { countyFreightTemplate, COUNTY_FREIGHT_PREMIUM_BPS } from '../../data/countyFreight.data';
import { countyFreightBoardState, countyFreightProgress } from '../../core/farmCountyFreight';
import { pickupCargoCapacity, pickupCargoUsed, pickupCropUnits, pickupSeedUnits } from '../../core/farmPickup';
import { h, spriteImg, clearChildren } from '../dom';
import { closePanel, openPanel } from '../modal';

type Dispatch = (result: ActionResult) => void;

export interface FarmPanelActions {
  context: FarmMarketContext;
  buySeeds: (cropId: string, count: number) => ActionResult;
  sellCrop: (cropId: string, count: number) => ActionResult;
  loadCrop?: (cropId: string, count: number) => ActionResult;
  unloadCrop?: (cropId: string, count: number) => ActionResult;
  loadSeeds?: (cropId: string, count: number) => ActionResult;
  unloadSeeds?: (cropId: string, count: number) => ActionResult;
  pickupPresent: boolean;
  cargoAtPad: boolean;
  buyLand: () => ActionResult;
  acceptCountyWorkOrder: () => ActionResult;
  fulfillCountyWorkOrder: () => ActionResult;
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
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', {}, `Available cash: ${formatMoney(farm.cashCents)}`),
    h('span', {}, actions.context === 'town' ? 'Purchased seed bags enter the pickup cargo bed.' : 'Farm inventory stays here until you load it into the pickup.'),
    ...(actions.context === 'town' && !actions.pickupPresent ? [h('strong', { class: 'panel-note' }, 'On foot: bring the pickup here to buy seeds.')] : []),
  ));
  const list = h('div', { class: 'farm-card-list' });
  const rerender = (): void => renderSeedShop(body, state, actions);
  for (const def of allFarmCrops()) {
    const unlock = farmCropUnlockInfo(state, def.id);
    const gross = def.harvestYield * def.basePriceCents;
    const margin = gross - def.seedPriceCents;
    const seedQuantity = h('input', { class: 'market-qty', type: 'number', min: '1', value: '1', 'aria-label': `${def.name} seed quantity`, 'data-testid': `seed-quantity-${def.id}` }) as HTMLInputElement;
    list.append(h('div', { class: 'farm-card', 'data-testid': `seed-card-${def.id}` },
      spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-lg'),
      h('div', { class: 'farm-card-main' },
        h('div', { class: 'farm-card-title' }, def.name),
        h('div', { class: 'farm-card-sub' },
          `${formatMoney(def.seedPriceCents)} per seed · ${Math.round(def.growMs / 1000)}s base growth · ${def.harvestYield} units + tractor bonus`,
        ),
        h('div', { class: 'farm-card-sub' }, `${def.role} · Expected gross ${formatMoney(gross)} · margin ${formatMoney(margin)} · ${def.storageUnitsPerItem} barn/unit · ${unlock.unlocked ? unlock.requirement : `Locked: ${unlock.requirement}`}`),
        h('div', { class: 'farm-card-stock', 'data-testid': `seed-count-${def.id}` }, `Farm seeds: ${farm.seeds[def.id] ?? 0} · Pickup: ${pickupSeedUnits(state, def.id)}`),
      ),
      h('div', { class: 'farm-card-actions' },
        ...(actions.context === 'town' ? [
          h('button', { class: 'btn btn-primary btn-sm', 'data-testid': `buy-one-${def.id}`, ...(!unlock.unlocked || !actions.pickupPresent ? { disabled: 'true', title: !unlock.unlocked ? unlock.requirement : 'Bring the pickup to town.' } : {}), onclick: () => runAndRender(actions.buySeeds(def.id, 1), actions, rerender) }, 'Buy 1'),
          h('button', { class: 'btn btn-sm', 'data-testid': `buy-five-${def.id}`, ...(!unlock.unlocked || !actions.pickupPresent ? { disabled: 'true', title: !unlock.unlocked ? unlock.requirement : 'Bring the pickup to town.' } : {}), onclick: () => runAndRender(actions.buySeeds(def.id, 5), actions, rerender) }, 'Buy 5'),
        ] : [
          seedQuantity,
          ...(actions.loadSeeds ? [h('button', { class: 'btn btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.loadSeeds!(def.id, Number(seedQuantity.value)), actions, rerender) }, 'Load seed')] : []),
          ...(actions.unloadSeeds ? [h('button', { class: 'btn btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.unloadSeeds!(def.id, Number(seedQuantity.value)), actions, rerender) }, 'Unload seed')] : []),
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

function renderMarket(body: HTMLElement, state: GameState, actions: FarmPanelActions, context: FarmMarketContext): void {
  clearChildren(body);
  body.classList.toggle('farm-cargo-context', context === 'farm');
  body.classList.remove('farm-seed-transfer-context');
  const farm = farmOf(state);
  const used = storageUsed(state);
  const pickupUsed = pickupCargoUsed(state);
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', { 'data-testid': 'market-cash' }, `Cash: ${formatMoney(farm.cashCents)}`),
    h('strong', { 'data-testid': 'market-capacity' }, `Barn: ${used} / ${farm.storageCapacity} · Pickup: ${pickupUsed} / ${pickupCargoCapacity(state)}`),
    h('span', {}, context === 'town' ? (actions.pickupPresent ? 'Sell pickup produce or deliver a County order.' : 'On foot: bring the pickup to sell or deliver.') : `${storageRemaining(state)} barn capacity remaining. Move produce between Barn and Pickup here; sales happen at the Grain Exchange.`),
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
        h('div', { class: 'farm-card-sub' }, `County delivery: ${progress.storedUnits} / ${progress.requiredUnits} corn in pickup cargo · fixed ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)} payout`),
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
          h('div', { class: 'farm-card-title' }, `County Freight Board · ${template.title}`),
          h('div', { class: 'farm-card-sub' }, `${template.buyer} · ${progress.loadedUnits} / ${contract.requiredUnits} ${crop.name} in pickup cargo`),
          h('div', { class: 'farm-card-stock' }, `Accepted Day ${contract.issuedDay} · locked payout ${formatMoney(contract.payoutCents)} · no deadline`),
        ),
        h('button', {
          class: 'btn btn-primary btn-sm', 'data-testid': 'deliver-county-freight',
          ...(freightMarket.deliveryReady ? {} : { disabled: 'true' }),
          onclick: () => runAndRender(actions.fulfillCountyFreight(), actions, rerender),
        }, `Deliver ${contract.requiredUnits}`),
      ));
    } else if (board.offers.length > 0) {
      body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-freight-choice-summary' },
        h('strong', {}, `County Freight Board · ${board.offers.length} routes posted`),
        h('span', {}, 'Choose one route. Posted bids refresh with the next farm day; accepted terms remain locked until delivery.'),
      ));
      for (const offer of board.offers) {
        const template = countyFreightTemplate(offer.cropId);
        const crop = farmCropDef(offer.cropId);
        body.append(h('div', { class: 'farm-card county-work-order', 'data-testid': `county-freight-offer-${offer.cropId}` },
          h('div', { class: 'farm-card-main' },
            h('div', { class: 'farm-card-title' }, template.title),
            h('div', { class: 'farm-card-sub' }, `${template.buyer} requests ${offer.requiredUnits} ${crop.name}.`),
            h('div', { class: 'farm-card-stock' }, `Pickup: ${pickupCropUnits(state, offer.cropId)} · ${formatMoney(offer.payoutCents)} locked payout · ${(COUNTY_FREIGHT_PREMIUM_BPS / 100).toFixed(0)}% above today's posted rate`),
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
  for (const def of allFarmCrops()) {
    const quote = farm.market.quotes[def.id];
    const movement = marketMovement(quote.currentCents, quote.previousCents);
    const stored = context === 'town' ? pickupCropUnits(state, def.id) : farm.storage[def.id] ?? 0;
    const pickupStored = pickupCropUnits(state, def.id);
    const canSell = actions.pickupPresent && stored > 0;
    const sellUnavailable = actions.pickupPresent ? 'No pickup cargo to sell.' : 'Bring the pickup to town.';
    const canLoad = actions.cargoAtPad && stored > 0;
    const canUnload = actions.cargoAtPad && pickupStored > 0;
    const input = h('input', {
      class: 'market-qty', type: 'number', min: '1', max: String(Math.max(1, stored)), value: String(Math.max(1, Math.min(5, stored))),
      'aria-label': `${def.name} ${context === 'town' ? 'sale' : 'cargo transfer'} quantity`, 'data-testid': `sell-amount-${def.id}`,
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
        h('div', { class: 'farm-card-stock', 'data-testid': `stored-${def.id}` }, `${context === 'town' ? 'Pickup cargo' : 'Barn'}: ${stored}`),
      ),
      h('div', { class: 'market-sell-controls' },
        input,
        ...(context === 'town' ? [
          h('button', { class: 'btn btn-sm', ...(!canSell ? { disabled: 'true' } : {}), title: canSell ? 'Sell 1 from pickup cargo.' : sellUnavailable, 'data-testid': `sell-one-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, 1), actions, rerender) }, 'Sell 1'),
          h('button', { class: 'btn btn-primary btn-sm', ...(!canSell ? { disabled: 'true' } : {}), title: canSell ? 'Sell the entered pickup quantity.' : sellUnavailable, 'data-testid': `sell-chosen-${def.id}`, onclick: sellChosen }, 'Sell amount'),
          h('button', { class: 'btn btn-sm', ...(!canSell ? { disabled: 'true' } : {}), title: canSell ? 'Sell all pickup cargo for this crop.' : sellUnavailable, 'data-testid': `sell-all-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, stored), actions, rerender) }, 'Sell all'),
        ] : [
          ...(actions.loadCrop ? [h('button', { class: 'btn btn-primary btn-sm', ...(!canLoad ? { disabled: 'true' } : {}), title: !actions.cargoAtPad ? 'Park at the barn cargo pad.' : stored <= 0 ? 'No barn crop to load.' : 'Move the entered quantity from Barn to Pickup.', onclick: () => runAndRender(actions.loadCrop!(def.id, Number(input.value)), actions, rerender) }, 'Barn → Pickup')] : []),
          ...(actions.unloadCrop ? [h('button', { class: 'btn btn-sm', ...(!canUnload ? { disabled: 'true' } : {}), title: !actions.cargoAtPad ? 'Park at the barn cargo pad.' : pickupStored <= 0 ? 'No pickup crop to unload.' : 'Move the entered quantity from Pickup to Barn.', onclick: () => runAndRender(actions.unloadCrop!(def.id, Number(input.value)), actions, rerender) }, 'Pickup → Barn')] : []),
          h('span', { class: 'panel-note' }, `Pickup: ${pickupStored}`),
        ]),
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
  dispatch?: Dispatch;
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
  const restored = tractor.status === 'operational';
  const countyComplete = farmOf(state).townContact.status === 'completed';
  const kitOwned = farmOf(state).equipment.countyRowCropFieldKitOwned;
  const kitUnlocked = countyComplete && restored;
  const trailerOwned = farmOf(state).equipment.countyUtilityTrailerOwned;
  const trailerUnlocked = farmOf(state).countyFreight.lastCompletedDay > 0;
  const siloOwned = farmOf(state).equipment.countyGrainSiloOwned;
  const siloUnlocked = farmOf(state).equipment.barnLoftExpansionOwned;
  openPanel({
    title: onFarm ? 'Farm Equipment' : 'Farm Services Equipment Desk',
    onClose: actions.onClose,
    body: (body) => body.append(h('div', { class: 'equipment-card', 'data-testid': 'tractor-panel' },
      h('div', { class: 'tractor-illustration' }, 'TRACTOR'),
      h('div', { class: 'farm-card-title' }, tractor.name),
      h('div', { class: `equipment-status ${tractor.status}` }, `Status: ${restored ? 'Operational' : 'Awaiting restoration'}`),
      h('div', { class: 'equipment-kit', 'data-testid': 'tractor-restoration' },
        h('div', { class: 'farm-card-title' }, OLD_TRACTOR_RESTORATION.name),
        h('p', {}, `One-time restoration · ${formatMoney(OLD_TRACTOR_RESTORATION.priceCents)} · returns the inherited tractor to dependable field service`),
        h('div', { class: 'equipment-mode', 'data-testid': 'tractor-restoration-status' }, restored
          ? 'Complete · tractor operational'
          : countyComplete ? 'Unlocked at the County Equipment Desk' : 'Locked · prove the farm with the County Pantry delivery'),
        ...(!onFarm && !restored && countyComplete && actions.context === 'town' ? [h('button', {
          class: 'btn btn-primary', 'data-testid': 'restore-old-tractor', onclick: () => {
            const result = actions.onRestoreTractor?.();
            if (!result) return;
            actions.dispatch?.(result);
            if (result.ok) openFarmEquipment(state, actions);
          },
        }, `Restore for ${formatMoney(OLD_TRACTOR_RESTORATION.priceCents)}`)] : []),
      ),
      h('p', {}, kitOwned
        ? `Installed effect: +${COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps / 100}% operated tractor crop cycles and +${COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits} operated tractor harvest unit.`
        : 'Base crop time and yield apply until the County Row-Crop Field Kit is installed.'),
      h('div', { class: 'equipment-kit', 'data-testid': 'county-field-kit' },
        h('div', { class: 'farm-card-title' }, COUNTY_ROW_CROP_FIELD_KIT.name),
        h('p', {}, `One-time upgrade · ${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)} · +${COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps / 100}% operated tractor crop speed · +${COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits} operated tractor harvest unit`),
        h('div', { class: 'equipment-mode', 'data-testid': 'county-field-kit-status' }, kitOwned
          ? 'Owned · installed'
          : kitUnlocked ? 'Unlocked at the County Equipment Desk' : countyComplete ? 'Locked · restore the tractor first' : 'Locked · complete the County Pantry order'),
        ...(!onFarm && !kitOwned && kitUnlocked && actions.context === 'town' ? [h('button', { class: 'btn btn-primary', 'data-testid': 'buy-county-field-kit', onclick: () => {
          const result = actions.onPurchaseKit?.();
          if (!result) return;
          actions.dispatch?.(result);
          if (result.ok) openFarmEquipment(state, actions);
        } }, `Purchase for ${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)}`)] : []),
      ),
      h('div', { class: 'equipment-kit', 'data-testid': 'county-utility-trailer' },
        h('div', { class: 'farm-card-title' }, COUNTY_UTILITY_TRAILER.name),
        h('p', {}, `One-time larger mixed-cargo convenience · ${formatMoney(COUNTY_UTILITY_TRAILER.priceCents)} · doubles pickup cargo from ${COUNTY_UTILITY_TRAILER.fromCapacity} to ${COUNTY_UTILITY_TRAILER.toCapacity} units. Freight Board routes already fit the base pickup.`),
        h('div', { class: 'equipment-mode', 'data-testid': 'county-utility-trailer-status' }, trailerOwned
          ? `Owned · attached · ${pickupCargoCapacity(state)} cargo units`
          : trailerUnlocked ? 'Unlocked at the County Equipment Desk' : 'Locked · complete one Freight Board haul'),
        ...(!onFarm && !trailerOwned && trailerUnlocked && actions.context === 'town' ? [h('button', {
          class: 'btn btn-primary', 'data-testid': 'buy-county-utility-trailer', onclick: () => {
            const result = actions.onPurchaseTrailer?.();
            if (!result) return;
            actions.dispatch?.(result);
            if (result.ok) openFarmEquipment(state, actions);
          },
        }, `Purchase for ${formatMoney(COUNTY_UTILITY_TRAILER.priceCents)}`)] : []),
      ),
      h('div', { class: 'equipment-kit', 'data-testid': 'county-grain-silo' },
        h('div', { class: 'farm-card-title' }, COUNTY_GRAIN_SILO.name),
        h('p', {}, `One-time storage build · ${formatMoney(COUNTY_GRAIN_SILO.priceCents)} · ${COUNTY_GRAIN_SILO.toCapacity} combined storage. A full 96-section operated corn, soy, or cabbage harvest fits; tomatoes and pumpkins require load-out.`),
        h('div', { class: 'equipment-mode', 'data-testid': 'county-grain-silo-status' }, siloOwned
          ? `Owned · ${farmOf(state).storageCapacity} farm storage units`
          : siloUnlocked ? 'Unlocked at the County Equipment Desk' : 'Locked · own the neighboring acreage and install the barn loft'),
        ...(!onFarm && !siloOwned && siloUnlocked && actions.context === 'town' ? [h('button', {
          class: 'btn btn-primary', 'data-testid': 'buy-county-grain-silo', onclick: () => {
            const result = actions.onPurchaseSilo?.();
            if (!result) return;
            actions.dispatch?.(result);
            if (result.ok) openFarmEquipment(state, actions);
          },
        }, `Build for ${formatMoney(COUNTY_GRAIN_SILO.priceCents)}`)] : []),
      ),
      h('p', { class: 'equipment-mode', 'data-testid': 'tractor-mode' }, !onFarm
        ? restored ? 'Equipment record on file - tractor operation is available back at the farm' : 'Inherited tractor on file - restoration is handled at this desk'
        : operating
          ? jobActive ? 'Operating - field job in progress' : 'Operating - ready to drive or work a parcel'
          : restored ? 'Parked - select Operate to climb aboard' : 'Parked - restoration required before operation'),
      ...(onFarm ? [h('button', {
        class: 'btn btn-primary equipment-operate',
        'data-testid': operating ? 'exit-tractor' : 'operate-tractor',
        ...(jobActive || !restored ? { disabled: 'true' } : {}),
        onclick: () => {
          closePanel();
          onToggleOperating?.();
        },
      }, operating ? jobActive ? 'Finish or cancel job before exiting' : 'Exit Tractor' : restored ? 'Operate Tractor' : 'Restoration Required')] : []),
      h('div', { class: 'panel-note', 'data-testid': onFarm ? 'farm-equipment-note' : 'town-equipment-note' }, !onFarm
        ? restored ? 'The Equipment Desk can review the tractor record here. Return to the farm to climb aboard and operate it.' : countyComplete ? 'The County delivery is complete. Restore the tractor here when the business can afford it.' : 'Complete Mae and Eli’s first County Pantry delivery to unlock restoration work.'
        : operating
          ? 'Click open ground to drive. Click an owned field section to choose acreage planting or harvesting. Escape cancels active work.'
          : restored ? 'The driver is hidden while aboard. Tractor position is saved; active field jobs safely reset after reload.' : 'Work sections or rows by hand, complete the County Pantry delivery, then visit the Equipment Desk in town.'),
    )),
  });
}
