import type { ActionResult, GameState } from '../../core/types';
import { allFarmCrops, farmCropDef } from '../../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, cheapestFarmSeed, farmCropUnlockInfo, farmOf, formatMoney, marketMovement, storageRemaining, storageUsed,
} from '../../core/farmBusiness';
import { BARN_LOFT_EXPANSION as BARN_LOFT_DEF, COUNTY_ROW_CROP_FIELD_KIT } from '../../data/farmEquipment.data';
import { farmParcelDef, farmParcelSectionCount } from '../../core/farmParcels';
import { COUNTY_PANTRY_CORN_ORDER } from '../../data/townWorkOrders.data';
import { countyWorkOrderProgress, townContact } from '../../core/farmTownContact';
import { pickupCargoUsed, pickupCropUnits, pickupSeedUnits } from '../../core/farmPickup';
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
  const pickupUsed = pickupCargoUsed(state);
  body.append(h('div', { class: 'farm-panel-summary' },
    h('strong', { 'data-testid': 'market-cash' }, `Cash: ${formatMoney(farm.cashCents)}`),
    h('strong', { 'data-testid': 'market-capacity' }, `Barn: ${used} / ${farm.storageCapacity} · Pickup: ${pickupUsed} / 72`),
    h('span', {}, context === 'town' ? (actions.pickupPresent ? 'Town services use pickup cargo only.' : 'On foot: bring the pickup to buy, sell, or deliver.') : `${storageRemaining(state)} barn capacity remaining. Load or unload cargo here; ordinary sales happen in town.`),
    ...(context === 'farm' && !actions.cargoAtPad ? [h('strong', { class: 'panel-note', 'data-testid': 'cargo-pad-guidance' }, 'Park the pickup at the barn cargo pad to load or unload.')] : []),
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

  const rerender = (): void => renderMarket(body, state, actions, context);
  const list = h('div', { class: 'farm-card-list market-list' });
  for (const def of allFarmCrops()) {
    const quote = farm.market.quotes[def.id];
    const movement = marketMovement(quote.currentCents, quote.previousCents);
    const stored = context === 'town' ? pickupCropUnits(state, def.id) : farm.storage[def.id] ?? 0;
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
          h('button', { class: 'btn btn-sm', ...(!actions.pickupPresent ? { disabled: 'true' } : {}), title: actions.pickupPresent ? 'Sell pickup cargo.' : 'Bring the pickup to town.', 'data-testid': `sell-one-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, 1), actions, rerender) }, 'Sell 1'),
          h('button', { class: 'btn btn-primary btn-sm', ...(!actions.pickupPresent ? { disabled: 'true' } : {}), title: actions.pickupPresent ? 'Sell pickup cargo.' : 'Bring the pickup to town.', 'data-testid': `sell-chosen-${def.id}`, onclick: sellChosen }, 'Sell amount'),
          h('button', { class: 'btn btn-sm', ...(!actions.pickupPresent ? { disabled: 'true' } : {}), title: actions.pickupPresent ? 'Sell pickup cargo.' : 'Bring the pickup to town.', 'data-testid': `sell-all-${def.id}`, onclick: () => runAndRender(actions.sellCrop(def.id, stored), actions, rerender) }, 'Sell all'),
        ] : [
          ...(actions.loadCrop ? [h('button', { class: 'btn btn-primary btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.loadCrop!(def.id, Number(input.value)), actions, rerender) }, 'Load crop')] : []),
          ...(actions.unloadCrop ? [h('button', { class: 'btn btn-sm', ...(!actions.cargoAtPad ? { disabled: 'true', title: 'Park at the barn cargo pad.' } : {}), onclick: () => runAndRender(actions.unloadCrop!(def.id, Number(input.value)), actions, rerender) }, 'Unload crop')] : []),
          h('span', { class: 'panel-note' }, `Pickup: ${pickupCropUnits(state, def.id)}`),
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
      h('span', {}, `Pickup cargo progress: ${progress.storedUnits} / ${progress.requiredUnits} corn.`),
      h('span', {}, `Fixed county payout: ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)}.`),
    ));
    return;
  }
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'county-work-order-offer' },
    h('strong', {}, 'A first county delivery'),
    h('span', {}, 'Mae Carter: Welcome to the County Service Center. The County Pantry needs a dependable first corn delivery.'),
    h('span', {}, `Grow and harvest ${COUNTY_PANTRY_CORN_ORDER.requiredUnits} corn, load it into the pickup, and Eli will pay a fixed ${formatMoney(COUNTY_PANTRY_CORN_ORDER.payoutCents)} at the Grain Exchange.`),
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
    h('div', { class: 'land-price', 'data-testid': 'parcel-price' }, formatMoney(FIRST_PARCEL_PRICE_CENTS)),
    h('p', {}, `Adds ${sectionCount} usable field sections across an ${parcel.columns}×${parcel.rows} commercial acreage. Ownership is permanent and saved; repeat purchases are blocked.`),
    owned
      ? h('div', { class: 'owned-mark', 'data-testid': 'parcel-owned' }, 'Purchased · field sections unlocked')
      : h('button', { class: 'btn btn-primary', 'data-testid': 'buy-parcel-button', onclick: () => runAndRender(actions.buyLand(), actions, rerender) }, 'Purchase Parcel'),
  ));
  const selected = farmCropDef(farm.selectedCropId);
  const acreageSeedCapital = selected.seedPriceCents * sectionCount;
  body.append(h('div', { class: 'farm-panel-summary', 'data-testid': 'land-working-capital' },
    h('strong', {}, `Cash after parcel: ${formatMoney(farm.cashCents - (owned ? 0 : FIRST_PARCEL_PRICE_CENTS))}`),
    h('span', {}, `A full ${sectionCount}-section planting needs ${formatMoney(acreageSeedCapital)} in ${selected.name} seed capital at current prices. You can work any portion of the acreage; this is planning guidance, not a purchase block.`),
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
  onPurchaseKit?: () => ActionResult;
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
  const kitOwned = farmOf(state).equipment.countyRowCropFieldKitOwned;
  const kitUnlocked = farmOf(state).townContact.status === 'completed';
  openPanel({
    title: onFarm ? 'Farm Equipment' : 'Farm Services Equipment Desk',
    onClose: actions.onClose,
    body: (body) => body.append(h('div', { class: 'equipment-card', 'data-testid': 'tractor-panel' },
      h('div', { class: 'tractor-illustration' }, 'TRACTOR'),
      h('div', { class: 'farm-card-title' }, tractor.name),
      h('div', { class: `equipment-status ${tractor.status}` }, `Status: ${tractor.status === 'operational' ? 'Operational' : 'Maintenance'}`),
      h('p', {}, kitOwned
        ? `Installed effect: +${COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps / 100}% operated tractor crop cycles and +${COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits} operated tractor harvest unit.`
        : 'Base crop time and yield apply until the County Row-Crop Field Kit is installed.'),
      h('div', { class: 'equipment-kit', 'data-testid': 'county-field-kit' },
        h('div', { class: 'farm-card-title' }, COUNTY_ROW_CROP_FIELD_KIT.name),
        h('p', {}, `One-time upgrade · ${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)} · +${COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps / 100}% operated tractor crop speed · +${COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits} operated tractor harvest unit`),
        h('div', { class: 'equipment-mode', 'data-testid': 'county-field-kit-status' }, kitOwned ? 'Owned · installed' : kitUnlocked ? 'Unlocked at the County Equipment Desk' : 'Locked · complete the County Pantry order'),
        ...(!onFarm && !kitOwned && kitUnlocked && actions.context === 'town' ? [h('button', { class: 'btn btn-primary', 'data-testid': 'buy-county-field-kit', onclick: () => {
          const result = actions.onPurchaseKit?.();
          if (!result) return;
          actions.dispatch?.(result);
          if (result.ok) openFarmEquipment(state, actions);
        } }, `Purchase for ${formatMoney(COUNTY_ROW_CROP_FIELD_KIT.priceCents)}`)] : []),
      ),
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
          ? 'Click open ground to drive. Click an owned field section to choose acreage planting or harvesting. Escape cancels active work.'
          : 'The driver is hidden while aboard. Tractor position is saved; active field jobs safely reset after reload.'),
    )),
  });
}
