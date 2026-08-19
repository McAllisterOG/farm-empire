import type { FarmCropDef } from './types';

/**
 * Farm cargo is stored as compact integer lots for save compatibility and
 * deterministic transactions.  Player-facing capacity is expressed as
 * pounds: one internal cargo unit is one 10 lb handling lot.
 */
export const FARM_CARGO_POUNDS_PER_UNIT = 10;

export function farmCargoPounds(units: number): number {
  if (!Number.isFinite(units)) return 0;
  return Math.max(0, Math.floor(units)) * FARM_CARGO_POUNDS_PER_UNIT;
}

export function formatFarmCargoWeight(units: number): string {
  return `${farmCargoPounds(units).toLocaleString('en-US')} lb`;
}

export function farmCropCargoPounds(crop: Pick<FarmCropDef, 'storageUnitsPerItem'>, count: number): number {
  return farmCargoPounds(Math.max(0, Math.floor(count)) * crop.storageUnitsPerItem);
}

export function formatFarmCropWeight(crop: Pick<FarmCropDef, 'storageUnitsPerItem'>, count: number): string {
  return `${farmCropCargoPounds(crop, count).toLocaleString('en-US')} lb`;
}

export function farmCropPricePerPoundCents(crop: Pick<FarmCropDef, 'basePriceCents' | 'storageUnitsPerItem'>): number {
  return crop.basePriceCents / farmCargoPounds(crop.storageUnitsPerItem);
}
