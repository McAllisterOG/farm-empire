import type { GameState } from '../core/types';
import { allFarmCrops, farmCropDef } from '../core/registry';
import { farmCropUnlockInfo, farmOf, formatMoney, storageUsed } from '../core/farmBusiness';
import { pickupCargoCapacity, pickupCargoUsed } from '../core/farmPickup';
import { HAND_BASKET_CAPACITY, handBasketUsed } from '../core/farmHarvestBasket';
import { farmGuideSteps, farmerKnowledgeSummary, nextFarmGuideStep } from '../core/farmKnowledge';
import { currentFarmWeather } from '../core/farmWeather';
import { firstFarmMorningGuide } from '../core/firstFarmMorning';
import { h, spriteImg } from './dom';

export interface FarmHudCallbacks {
  onSelectCrop: (cropId: string) => void;
  onMarket: () => void;
  onEquipment: () => void;
  onFarmbook: () => void;
  onToggleHarvestDestination: () => void;
  onUnloadBasket: () => void;
  onReturnFarm: () => void;
  onSave: () => void;
  onMenu: () => void;
}

export type FarmHudMode = 'farm' | 'town';

export interface TractorHudRuntime {
  operating: boolean;
  working: boolean;
  activeVehicle?: 'tractor' | 'pickup' | null;
  statusText?: string;
  manualWorking?: boolean;
  farmhandWorking?: boolean;
}

export function vehicleOperationHelp(activeVehicle: TractorHudRuntime['activeVehicle']): string {
  return activeVehicle === 'pickup'
    ? 'WASD/arrow keys or click/right-click ground to drive. Drive to the cargo pad or County Road.'
    : 'WASD/arrow keys or click/right-click ground to drive. Click an owned field parcel for batch planting or harvesting.';
}

export function shouldShowFirstDeliveryChip(mode: FarmHudMode, complete: boolean, runtime?: TractorHudRuntime): boolean {
  return mode === 'farm' && !complete && !runtime?.operating && !runtime?.working && !runtime?.manualWorking && !runtime?.farmhandWorking;
}
function clockText(minute: number): string {
  const hour24 = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export class FarmHud {
  private root: HTMLElement;
  private cashEl: HTMLElement;
  private clockEl: HTMLElement;
  private weatherEl: HTMLElement;
  private weatherStat: HTMLElement;
  private storageEl: HTMLElement;
  private selectedEl: HTMLElement;
  private tractorEl: HTMLElement;
  private operationEl: HTMLElement;
  private helpEl: HTMLElement;
  private brandSubEl: HTMLElement;
  private storageButton: HTMLButtonElement;
  private equipmentButton: HTMLButtonElement;
  private locationStat: HTMLElement;
  private farmbookButton: HTMLButtonElement;
  private harvestDestinationButton: HTMLButtonElement;
  private unloadBasketButton: HTMLButtonElement;
  private farmControls: HTMLElement;
  private townControls: HTMLElement;
  private morningCard: HTMLElement;
  private deliveryChip: HTMLElement;
  private morningDismissed = false;
  private mode: FarmHudMode = 'farm';
  private cropButtons = new Map<string, HTMLButtonElement>();

  constructor(cb: FarmHudCallbacks) {
    this.cashEl = h('strong', { 'data-testid': 'cash' }, '$0.00');
    this.clockEl = h('strong', { 'data-testid': 'farm-clock' }, 'Day 1 · 8:00 AM');
    this.weatherEl = h('strong', { 'data-testid': 'farm-weather' }, 'Clear');
    this.weatherStat = h('div', { class: 'farm-stat farm-weather-stat' }, h('span', {}, 'Weather'), this.weatherEl);
    this.storageEl = h('strong', { 'data-testid': 'storage-summary' }, '0 / 0');
    this.selectedEl = h('strong', { 'data-testid': 'selected-crop' }, 'Corn');
    this.tractorEl = h('strong', { 'data-testid': 'tractor-status' }, 'Operational');
    this.operationEl = h('div', {
      class: 'farm-operation-status hidden',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'tractor-operation-status',
    });
    this.brandSubEl = h('div', { class: 'farm-brand-sub' }, 'Farming Business V1');
    this.storageButton = h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'storage-button', onclick: cb.onMarket }, h('span', {}, 'Barn'), this.storageEl) as HTMLButtonElement;
    this.equipmentButton = h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'equipment-button', onclick: cb.onEquipment }, h('span', {}, 'Old Tractor'), this.tractorEl) as HTMLButtonElement;
    this.locationStat = h('div', { class: 'farm-stat town-location-stat hidden', 'data-testid': 'town-location-stat' }, h('span', {}, 'Location'), h('strong', {}, 'County Service Center'));
    this.farmbookButton = h('button', { class: 'btn btn-primary farmbook-button', 'data-testid': 'farmbook-button', onclick: cb.onFarmbook }, 'Farmbook') as HTMLButtonElement;
    this.harvestDestinationButton = h('button', {
      class: 'btn harvest-destination-button',
      'data-testid': 'harvest-destination-button',
      onclick: cb.onToggleHarvestDestination,
    }, 'Harvest → Barn') as HTMLButtonElement;
    this.unloadBasketButton = h('button', {
      class: 'btn btn-primary hidden',
      'data-testid': 'unload-basket-button',
      onclick: cb.onUnloadBasket,
    }, 'Unload Basket') as HTMLButtonElement;
    this.deliveryChip = h('div', { class: 'first-delivery-chip', 'data-testid': 'first-delivery-chip' });
    const dismissMorning = (): void => { this.morningDismissed = true; this.morningCard.classList.add('hidden'); };
    this.morningCard = h('section', { class: 'first-morning-card', 'data-testid': 'first-morning-card' },
      h('strong', {}, 'Good morning.'),
      h('span', {}, 'The old place is yours. Today, grow corn for a first County delivery.'),
      h('div', { class: 'first-morning-actions' },
        h('button', { class: 'btn btn-primary btn-sm', 'data-testid': 'start-first-morning', onclick: dismissMorning }, 'Start the morning'),
        h('button', { class: 'btn btn-sm', 'data-testid': 'explore-first', onclick: dismissMorning }, 'I’ll explore first'),
      ),
    );

    const top = h('div', { class: 'farm-hud-top' },
      h('div', { class: 'farm-brand' }, h('span', { class: 'farm-brand-mark' }, 'FE'), h('div', {},
        h('div', { class: 'farm-brand-title' }, 'FARM EMPIRE'),
        this.brandSubEl,
      )),
      h('div', { class: 'farm-stat' }, h('span', {}, 'Cash'), this.cashEl),
      h('div', { class: 'farm-stat' }, h('span', {}, 'Time'), this.clockEl),
      this.weatherStat,
      this.storageButton,
      this.equipmentButton,
      this.locationStat,
      h('button', { class: 'btn farm-menu-button', 'aria-label': 'Open game menu', 'data-testid': 'game-menu-button', onclick: cb.onMenu }, '☰'),
    );

    const cropStrip = h('div', { class: 'farm-crop-strip', 'aria-label': 'Crop selection' });
    for (const [index, def] of allFarmCrops().entries()) {
      const button = h('button', {
        class: 'farm-crop-button',
        'data-crop-id': def.id,
        'data-key': String(index + 1),
        'data-testid': `select-${def.id}`,
        onclick: () => cb.onSelectCrop(def.id),
      }, spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-md'), h('span', {}, def.name)) as HTMLButtonElement;
      this.cropButtons.set(def.id, button);
      cropStrip.append(button);
    }

    this.farmControls = h('div', { class: 'farm-hud-farm-controls' },
      h('div', { class: 'farm-selected' }, h('span', {}, 'Selected crop'), this.selectedEl),
      cropStrip,
      h('div', { class: 'farm-actions' },
        this.harvestDestinationButton,
        this.unloadBasketButton,
        this.farmbookButton,
      ),
    );
    this.townControls = h('div', { class: 'farm-hud-town-controls hidden' },
      h('div', { class: 'town-hud-copy' },
        h('strong', {}, 'COUNTY SERVICE CENTER'),
        h('span', {}, 'Walk to a storefront or townsperson for service.'),
      ),
      h('div', { class: 'farm-actions' },
        h('button', { class: 'btn', 'data-testid': 'town-save-button', onclick: cb.onSave }, 'Save'),
        h('button', { class: 'btn btn-primary', 'data-testid': 'town-return-button', onclick: cb.onReturnFarm }, 'Return to Farm'),
      ),
    );
    const bottom = h('div', { class: 'farm-hud-bottom' }, this.farmControls, this.townControls);

    this.helpEl = h('div', { class: 'farm-help' }, 'Select a crop, then click an empty field section to plant. Click a ready crop to harvest.');
    this.root = h('div', { class: 'farm-hud-root' }, top, bottom, this.deliveryChip, this.morningCard, this.operationEl, this.helpEl);
    document.body.append(this.root);
  }

  setMode(mode: FarmHudMode): void {
    this.mode = mode;
    const town = mode === 'town';
    this.root.classList.toggle('town-mode', town);
    this.farmControls.classList.toggle('hidden', town);
    this.townControls.classList.toggle('hidden', !town);
    this.equipmentButton.classList.toggle('hidden', town);
    this.locationStat.classList.toggle('hidden', !town);
    this.storageButton.disabled = town;
    this.storageButton.classList.toggle('farm-stat-button', !town);
    this.brandSubEl.textContent = town ? 'County Service Center' : 'Farming Business V1';
    this.operationEl.classList.toggle('hidden', town || !this.operationEl.textContent);
  }

  update(state: GameState, runtime?: TractorHudRuntime): void {
    const farm = farmOf(state);
    this.cashEl.textContent = formatMoney(farm.cashCents);
    this.clockEl.textContent = `Day ${farm.clock.day} · ${clockText(farm.clock.minute)}`;
    const weather = currentFarmWeather(state);
    this.weatherEl.textContent = weather.shortForecast;
    this.weatherStat.classList.toggle('rain', weather.kind === 'rain');
    this.weatherStat.classList.toggle('cloudy', weather.kind === 'cloudy');
    this.weatherStat.title = weather.fieldNote;
    this.storageEl.textContent = `${storageUsed(state)} / ${farm.storageCapacity} · P ${pickupCargoUsed(state)} / ${pickupCargoCapacity(state)}`;
    const selectedIndex = allFarmCrops().findIndex((def) => def.id === farm.selectedCropId);
    const selectedSeeds = farm.seeds[farm.selectedCropId] ?? 0;
    this.selectedEl.textContent = `${selectedIndex + 1} · ${farmCropDef(farm.selectedCropId).name} · ${selectedSeeds} seed${selectedSeeds === 1 ? '' : 's'}`;
    const basketUsed = handBasketUsed(state);
    const basketDestination = farm.handBasket.destination === 'pickup' ? 'Pickup' : 'Barn';
    this.harvestDestinationButton.textContent = `Harvest → ${basketDestination}`;
    this.harvestDestinationButton.title = `Click to switch where manual harvest baskets are unloaded. Basket: ${basketUsed} / ${HAND_BASKET_CAPACITY}.`;
    this.unloadBasketButton.classList.toggle('hidden', basketUsed <= 0);
    this.unloadBasketButton.textContent = `Unload Basket · ${basketUsed}/${HAND_BASKET_CAPACITY}`;
    this.unloadBasketButton.title = `Walk to the ${basketDestination.toLowerCase()} and unload the saved harvest basket.`;
    const knowledge = farmerKnowledgeSummary(state);
    const guide = farmGuideSteps(state);
    const nextGuide = nextFarmGuideStep(state);
    const morning = firstFarmMorningGuide(state, Date.now());
    this.farmbookButton.textContent = `Farmbook · ${guide.filter((step) => step.done).length}/${guide.length}`;
    this.farmbookButton.title = `${knowledge.level.name}${nextGuide ? ` · Next: ${nextGuide.label}` : ' · Core route complete'}`;
    if (this.mode === 'farm') this.brandSubEl.textContent = `${knowledge.level.name} · Farming Business`;
    this.deliveryChip.classList.toggle('hidden', !shouldShowFirstDeliveryChip(this.mode, morning.complete, runtime));
    this.deliveryChip.textContent = `County Pantry · Pickup loaded · ${morning.cornProgress.current}/${morning.cornProgress.required} corn`;
    this.morningCard.classList.toggle('hidden', this.mode !== 'farm' || this.morningDismissed || !morning.showWelcome);
    const greeting = this.morningCard.querySelector('strong');
    if (greeting) greeting.textContent = `Good morning, ${state.player.name?.trim() || 'Farm'}.`;
    this.tractorEl.textContent = runtime?.activeVehicle === 'tractor' && runtime.working
      ? 'Field job active'
      : runtime?.activeVehicle === 'tractor'
        ? 'Operating'
        : farm.equipment.tractor.status === 'operational' ? 'Operational' : 'Needs restoration';
    this.operationEl.classList.toggle('hidden', this.mode === 'town' || (!runtime?.operating && !runtime?.manualWorking && !runtime?.farmhandWorking));
    this.operationEl.classList.toggle('working', !!runtime?.working || !!runtime?.manualWorking || !!runtime?.farmhandWorking);
    this.operationEl.textContent = runtime?.statusText ?? '';
    this.helpEl.textContent = this.mode === 'town'
      ? 'Click a townsperson or storefront for service. Walk only on the paved center.'
      : runtime?.manualWorking
        ? 'Manual fieldwork commits when the short action finishes. Press Escape to cancel without changing the field.'
      : runtime?.working
      ? 'The tractor is working section by section. Press Escape to cancel safely.'
      : runtime?.operating
        ? vehicleOperationHelp(runtime.activeVehicle)
        : !morning.complete ? `Today · ${morning.title} — ${morning.detail}` : nextGuide ? `Next · ${nextGuide.label} — ${nextGuide.hint}` : 'Core farm route complete. Keep growing the operation your way.';
    for (const [cropId, button] of this.cropButtons) {
      const unlock = farmCropUnlockInfo(state, cropId);
      const def = farmCropDef(cropId);
      button.classList.toggle('active', cropId === farm.selectedCropId);
      button.classList.toggle('locked', !unlock.unlocked);
      button.disabled = !unlock.unlocked;
      const seedCount = farm.seeds[cropId] ?? 0;
      button.title = unlock.unlocked
        ? `${def.name}: ${seedCount} seed${seedCount === 1 ? '' : 's'}`
        : `${def.name} locked: ${unlock.requirement}`;
      button.setAttribute('aria-label', unlock.unlocked ? `${def.name}, ${seedCount} seeds` : `${def.name}, locked. ${unlock.requirement}`);
      button.dataset.count = String(seedCount);
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
