import type { GameState } from '../core/types';
import { farmCropDef } from '../core/registry';
import { farmOf, formatMoney, harvestWagonReadout, storageUsed } from '../core/farmBusiness';
import { pickupCargoCapacity, pickupCargoUsed } from '../core/farmPickup';
import { formatFarmCapacity } from '../core/farmCargoScale';
import { HAND_BASKET_CAPACITY, handBasketUsed } from '../core/farmHarvestBasket';
import { nextFarmGuideStep, farmerKnowledgeSummary } from '../core/farmKnowledge';
import { currentFarmWeather } from '../core/farmWeather';
import { firstFarmMorningGuide } from '../core/firstFarmMorning';
import { h } from './dom';

export interface FarmHudCallbacks {
  onSelectCrop: (cropId: string) => void;
  onOpenCropChooser: () => void;
  onWeather: () => void;
  onMarket: () => void;
  onEquipment: () => void;
  onFarmbook?: () => void;
  onToggleHarvestDestination: () => void;
  onUnloadBasket: () => void;
  onCancelOperation: () => void;
  onReturnFarm: () => void;
  onSave: () => void;
  onFitFarm: () => void;
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
  canCancel?: boolean;
}

export function vehicleOperationHelp(activeVehicle: TractorHudRuntime['activeVehicle']): string {
  return activeVehicle === 'pickup'
    ? 'Drive · WASD / arrows / click · cargo pad or County Road.'
    : 'Drive · WASD / arrows / click · Select a field parcel to work.';
}

export function shouldShowFirstDeliveryChip(mode: FarmHudMode, complete: boolean, runtime?: TractorHudRuntime): boolean {
  return mode === 'farm' && !complete && !runtime?.operating && !runtime?.working && !runtime?.manualWorking && !runtime?.farmhandWorking;
}

export function shouldShowOperationCancel(runtime?: TractorHudRuntime): boolean {
  return runtime?.canCancel === true;
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
  private cropControlButton: HTMLButtonElement;
  private tractorEl: HTMLElement;
  private operationEl: HTMLElement;
  private operationTextEl: HTMLElement;
  private cancelOperationButton: HTMLButtonElement;
  private helpEl: HTMLElement;
  private brandSubEl: HTMLElement;
  private storageButton: HTMLButtonElement;
  private equipmentButton: HTMLButtonElement;
  private locationStat: HTMLElement;
  private basketButton: HTMLButtonElement;
  private farmControls: HTMLElement;
  private townControls: HTMLElement;
  private morningCard: HTMLElement;
  private deliveryChip: HTMLElement;
  private pickupReminder: HTMLElement;
  private morningDismissed = false;
  private mode: FarmHudMode = 'farm';

  constructor(cb: FarmHudCallbacks) {
    this.cashEl = h('strong', { 'data-testid': 'cash' }, '$0.00');
    this.clockEl = h('strong', { 'data-testid': 'farm-clock' }, 'Day 1 · 8:00 AM');
    this.weatherEl = h('strong', { 'data-testid': 'farm-weather' }, 'Clear');
    this.weatherStat = h('button', { class: 'farm-stat farm-stat-button farm-weather-stat', type: 'button', 'data-testid': 'farm-weather-button', onclick: cb.onWeather }, h('span', {}, 'Weather'), this.weatherEl);
    this.storageEl = h('strong', { 'data-testid': 'storage-summary' }, '0 / 0');
    this.tractorEl = h('strong', { 'data-testid': 'tractor-status' }, 'Operational');
    this.operationTextEl = h('span', {
      class: 'farm-operation-copy',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'tractor-operation-status',
    });
    this.cancelOperationButton = h('button', {
      class: 'btn btn-sm farm-operation-cancel hidden',
      type: 'button',
      'data-testid': 'cancel-operation-button',
      'aria-label': 'Cancel active farm work safely',
      onclick: cb.onCancelOperation,
    }, 'Cancel') as HTMLButtonElement;
    this.operationEl = h('div', { class: 'farm-operation-status hidden' }, this.operationTextEl, this.cancelOperationButton);
    this.brandSubEl = h('div', { class: 'farm-brand-sub' }, 'Farm Manager · Farming Business');
    this.storageButton = h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'storage-button', onclick: cb.onMarket }, h('span', {}, 'Barn'), this.storageEl) as HTMLButtonElement;
    this.equipmentButton = h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'equipment-button', onclick: cb.onEquipment }, h('span', {}, 'Old Tractor'), this.tractorEl) as HTMLButtonElement;
    this.locationStat = h('div', { class: 'farm-stat town-location-stat hidden', 'data-testid': 'town-location-stat' }, h('span', {}, 'Location'), h('strong', {}, 'County Service Center'));
    this.cropControlButton = h('button', { class: 'btn farm-crop-control', type: 'button', 'data-testid': 'compact-crop-control', 'aria-label': 'Choose crop', onclick: cb.onOpenCropChooser }, 'Crop · Corn · 0') as HTMLButtonElement;
    this.basketButton = h('button', { class: 'btn btn-primary hidden basket-chip', type: 'button', 'data-testid': 'basket-chip', onclick: cb.onToggleHarvestDestination }, 'Basket · 0 / 24 · Unload') as HTMLButtonElement;
    this.deliveryChip = h('div', { class: 'first-delivery-chip', 'data-testid': 'first-delivery-chip' });
    this.pickupReminder = h('div', { class: 'pickup-reminder hidden', role: 'status', 'aria-live': 'polite', 'data-testid': 'pickup-reminder' });
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
      h('button', {
        class: 'btn farm-fit-button',
        type: 'button',
        'aria-label': 'Fit farm to screen',
        'data-testid': 'fit-farm-button',
        onclick: cb.onFitFarm,
      }, 'Fit'),
      h('button', { class: 'btn farm-menu-button', 'aria-label': 'Open game menu', 'data-testid': 'game-menu-button', onclick: cb.onMenu }, '☰'),
    );

    this.farmControls = h('div', { class: 'farm-hud-farm-controls' },
      this.cropControlButton,
      h('div', { class: 'farm-actions' },
        this.basketButton,
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
    this.root = h('div', { class: 'farm-hud-root' }, top, bottom, this.deliveryChip, this.pickupReminder, this.morningCard, this.operationEl, this.helpEl);
    document.body.append(this.root);
  }

  setPickupReminder(text: string | null): void {
    this.pickupReminder.textContent = text ?? '';
    this.pickupReminder.classList.toggle('hidden', !text || this.mode !== 'farm');
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
    this.brandSubEl.textContent = town ? 'County Service Center' : 'Farm Manager · Farming Business';
    this.operationEl.classList.toggle('hidden', town || !this.operationTextEl.textContent);
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
    this.storageEl.textContent = `Storage ${formatFarmCapacity(storageUsed(state), farm.storageCapacity)} · Pickup ${formatFarmCapacity(pickupCargoUsed(state), pickupCargoCapacity(state))}`;
    const selectedSeeds = farm.seeds[farm.selectedCropId] ?? 0;
    this.cropControlButton.textContent = `Crop · ${farmCropDef(farm.selectedCropId).name} · ${selectedSeeds}`;
    this.cropControlButton.setAttribute('aria-label', `Choose crop. Selected ${farmCropDef(farm.selectedCropId).name}, ${selectedSeeds} seeds.`);
    const basketUsed = handBasketUsed(state);
    this.basketButton.classList.toggle('hidden', basketUsed <= 0 || this.mode !== 'farm');
    this.basketButton.textContent = `Basket · ${basketUsed} / ${HAND_BASKET_CAPACITY} · Unload`;
    const nextGuide = nextFarmGuideStep(state);
    const morning = firstFarmMorningGuide(state, Date.now());
    if (this.mode === 'farm') this.brandSubEl.textContent = `${farmerKnowledgeSummary(state).level.name} · Farming Business`;
    this.deliveryChip.classList.toggle('hidden', !shouldShowFirstDeliveryChip(this.mode, morning.complete, runtime));
    this.deliveryChip.textContent = `County Pantry · Pickup loaded · ${morning.cornProgress.current}/${morning.cornProgress.required} corn`;
    const morningVisible = this.mode === 'farm' && !this.morningDismissed && morning.showWelcome;
    this.morningCard.classList.toggle('hidden', !morningVisible);
    this.root.classList.toggle('first-morning-active', morningVisible);
    const greeting = this.morningCard.querySelector('strong');
    if (greeting) greeting.textContent = `Good morning, ${state.player.name?.trim() || 'Farm'}.`;
    const wagonChip = farm.equipment.harvestWagon.owned ? ` · W ${harvestWagonReadout(state)}` : '';
    this.tractorEl.textContent = runtime?.activeVehicle === 'tractor' && runtime.working
      ? `Field job${wagonChip}`
      : runtime?.activeVehicle === 'tractor'
        ? `Operating${wagonChip}`
        : farm.equipment.tractor.status === 'operational' ? `Operational${wagonChip}` : 'Needs restoration';
    this.operationEl.classList.toggle('hidden', this.mode === 'town' || (!runtime?.operating && !runtime?.manualWorking && !runtime?.farmhandWorking));
    this.operationEl.classList.toggle('working', !!runtime?.working || !!runtime?.manualWorking || !!runtime?.farmhandWorking);
    this.operationTextEl.textContent = runtime?.statusText ?? '';
    this.cancelOperationButton.classList.toggle('hidden', !shouldShowOperationCancel(runtime));
    const contextualHelp = this.mode === 'town'
      ? 'Town services · click a shop or neighbor.'
      : shouldShowOperationCancel(runtime)
        ? ''
      : runtime?.operating
        ? vehicleOperationHelp(runtime.activeVehicle)
        : !morning.complete ? `Today · ${morning.title}` : nextGuide ? `Next · ${nextGuide.label}` : '';
    this.helpEl.textContent = contextualHelp;
    this.helpEl.classList.toggle('hidden', contextualHelp.length === 0);
    this.helpEl.title = !morning.complete ? morning.detail : nextGuide?.hint ?? '';
  }

  destroy(): void {
    this.root.remove();
  }
}
