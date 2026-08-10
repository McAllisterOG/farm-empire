import type { GameState } from '../core/types';
import { allFarmCrops, farmCropDef } from '../core/registry';
import { farmOf, formatMoney, storageUsed } from '../core/farmBusiness';
import { h, spriteImg } from './dom';

export interface FarmHudCallbacks {
  onSelectCrop: (cropId: string) => void;
  onSeedShop: () => void;
  onMarket: () => void;
  onLand: () => void;
  onEquipment: () => void;
  onSave: () => void;
}

export interface TractorHudRuntime {
  operating: boolean;
  working: boolean;
  statusText?: string;
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
  private storageEl: HTMLElement;
  private selectedEl: HTMLElement;
  private tractorEl: HTMLElement;
  private operationEl: HTMLElement;
  private helpEl: HTMLElement;
  private cropButtons = new Map<string, HTMLButtonElement>();

  constructor(cb: FarmHudCallbacks) {
    this.cashEl = h('strong', { 'data-testid': 'cash' }, '$0.00');
    this.clockEl = h('strong', { 'data-testid': 'farm-clock' }, 'Day 1 · 8:00 AM');
    this.storageEl = h('strong', { 'data-testid': 'storage-summary' }, '0 / 0');
    this.selectedEl = h('strong', { 'data-testid': 'selected-crop' }, 'Corn');
    this.tractorEl = h('strong', { 'data-testid': 'tractor-status' }, 'Operational');
    this.operationEl = h('div', { class: 'farm-operation-status hidden', 'data-testid': 'tractor-operation-status' });

    const top = h('div', { class: 'farm-hud-top' },
      h('div', { class: 'farm-brand' }, h('span', { class: 'farm-brand-mark' }, 'FE'), h('div', {},
        h('div', { class: 'farm-brand-title' }, 'FARM EMPIRE'),
        h('div', { class: 'farm-brand-sub' }, 'Farming Business V1'),
      )),
      h('div', { class: 'farm-stat' }, h('span', {}, 'Cash'), this.cashEl),
      h('div', { class: 'farm-stat' }, h('span', {}, 'Time'), this.clockEl),
      h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'storage-button', onclick: cb.onMarket }, h('span', {}, 'Barn'), this.storageEl),
      h('button', { class: 'farm-stat farm-stat-button', 'data-testid': 'equipment-button', onclick: cb.onEquipment }, h('span', {}, 'Old Tractor'), this.tractorEl),
    );

    const cropStrip = h('div', { class: 'farm-crop-strip', 'aria-label': 'Crop selection' });
    for (const def of allFarmCrops()) {
      const button = h('button', {
        class: 'farm-crop-button',
        'data-crop-id': def.id,
        'data-testid': `select-${def.id}`,
        onclick: () => cb.onSelectCrop(def.id),
      }, spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-md'), h('span', {}, def.name)) as HTMLButtonElement;
      this.cropButtons.set(def.id, button);
      cropStrip.append(button);
    }

    const bottom = h('div', { class: 'farm-hud-bottom' },
      h('div', { class: 'farm-selected' }, h('span', {}, 'Selected crop'), this.selectedEl),
      cropStrip,
      h('div', { class: 'farm-actions' },
        h('button', { class: 'btn btn-primary', 'data-testid': 'seed-shop-button', onclick: cb.onSeedShop }, 'Buy Seeds'),
        h('button', { class: 'btn', 'data-testid': 'market-button', onclick: cb.onMarket }, 'Market & Storage'),
        h('button', { class: 'btn', 'data-testid': 'land-button', onclick: cb.onLand }, 'Land'),
        h('button', { class: 'btn', 'data-testid': 'save-button', onclick: cb.onSave }, 'Save'),
      ),
    );

    this.helpEl = h('div', { class: 'farm-help' }, 'Select a crop, then click an empty field section to plant. Click a ready crop to harvest.');
    this.root = h('div', { class: 'farm-hud-root' }, top, bottom, this.operationEl, this.helpEl);
    document.body.append(this.root);
  }

  update(state: GameState, runtime?: TractorHudRuntime): void {
    const farm = farmOf(state);
    this.cashEl.textContent = formatMoney(farm.cashCents);
    this.clockEl.textContent = `Day ${farm.clock.day} · ${clockText(farm.clock.minute)}`;
    this.storageEl.textContent = `${storageUsed(state)} / ${farm.storageCapacity}`;
    this.selectedEl.textContent = farmCropDef(farm.selectedCropId).name;
    this.tractorEl.textContent = runtime?.working
      ? 'Field job active'
      : runtime?.operating
        ? 'Operating'
        : farm.equipment.tractor.status === 'operational' ? 'Operational' : 'Maintenance';
    this.operationEl.classList.toggle('hidden', !runtime?.operating);
    this.operationEl.classList.toggle('working', !!runtime?.working);
    this.operationEl.textContent = runtime?.statusText ?? '';
    this.helpEl.textContent = runtime?.working
      ? 'The tractor is working section by section. Press Escape to cancel safely.'
      : runtime?.operating
        ? 'Click open ground to drive. Click an owned field parcel for batch planting or harvesting.'
        : 'Select a crop, then click an empty field section to plant. Click a ready crop to harvest.';
    for (const [cropId, button] of this.cropButtons) {
      button.classList.toggle('active', cropId === farm.selectedCropId);
      const seedCount = farm.seeds[cropId] ?? 0;
      button.title = `${farmCropDef(cropId).name}: ${seedCount} seed${seedCount === 1 ? '' : 's'}`;
      button.dataset.count = String(seedCount);
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
