import type { FarmCropDef } from './types';

/** Internal cargo scale. These helpers remain available to deterministic authorities;
 * Farm Empire UI should use plain quantities and abstract capacity instead. */
export const FARM_CARGO_POUNDS_PER_UNIT = 10;
/** Legacy internal alias retained for save-compatible calculations. */
export const FARM_HANDLING_LOT_POUNDS = FARM_CARGO_POUNDS_PER_UNIT;

export function farmCargoPounds(units: number): number {
  if (!Number.isFinite(units)) return 0;
  return Math.max(0, Math.floor(units)) * FARM_CARGO_POUNDS_PER_UNIT;
}

export function formatFarmCargoWeight(units: number): string {
  return Math.max(0, Math.floor(units)).toLocaleString('en-US');
}

export function formatFarmCapacity(used: number, capacity: number): string {
  return `${Math.max(0, Math.floor(used)).toLocaleString('en-US')} / ${Math.max(0, Math.floor(capacity)).toLocaleString('en-US')}`;
}

export function formatFarmOpenCapacity(used: number, capacity: number): string {
  return `${Math.max(0, Math.floor(capacity - used)).toLocaleString('en-US')} open`;
}

export function farmCropCargoPounds(crop: Pick<FarmCropDef, 'storageUnitsPerItem'>, count: number): number {
  return farmCargoPounds(Math.max(0, Math.floor(count)) * crop.storageUnitsPerItem);
}

export function formatFarmCropWeight(crop: Pick<FarmCropDef, 'storageUnitsPerItem'>, count: number): string {
  return Math.max(0, Math.floor(count)).toLocaleString('en-US');
}

export function farmCropPricePerPoundCents(crop: Pick<FarmCropDef, 'basePriceCents' | 'storageUnitsPerItem'>): number {
  return crop.basePriceCents / farmCargoPounds(crop.storageUnitsPerItem);
}
