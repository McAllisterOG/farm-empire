import type { FarmCropFamily, FarmPlot, GameState } from './types';
import { farmCropDefOrNull } from './registry';

export const ROTATION_BONUS_BPS = 1_000;
export const ESTABLISHMENT_BONUS_BPS = 2_000;
/** A finite presentation-safe timestamp for malformed crops; it can never mature in normal play. */
export const INVALID_FARM_READY_AT = Number.MAX_SAFE_INTEGER;

export interface FarmRotationPreview {
  lastHarvestFamily: FarmCropFamily | null;
  nextFamily: FarmCropFamily | null;
  bonusMs: number;
  label: string;
}

export interface FarmCropCareSummary {
  establishmentMs: number;
  rotationBonusMs: number;
  totalReductionMs: number;
  readyAt: number;
}

export function isFarmCropFamily(value: unknown): value is FarmCropFamily {
  return value === 'grain' || value === 'legume' || value === 'root' || value === 'garden';
}

export function canonicalRotationBonusMs(growMs: number): number {
  return Math.round(growMs * ROTATION_BONUS_BPS / 10_000);
}

/** The only persisted establishment reduction current Farm planting can create. */
export function canonicalEstablishmentBonusMs(crop: NonNullable<FarmPlot['crop']>): number {
  const def = farmCropDefOrNull(crop.defId);
  if (!def) return 0;
  const candidate = (crop as { wateredBonusMs?: unknown }).wateredBonusMs;
  const implemented = Math.round(def.growMs * ESTABLISHMENT_BONUS_BPS / 10_000);
  return candidate === 0 || candidate === implemented ? candidate : 0;
}

export function isValidFarmPlantedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function rotationBonusFor(lastHarvestFamily: unknown, cropId: string): number {
  const def = farmCropDefOrNull(cropId);
  return def && isFarmCropFamily(lastHarvestFamily) && lastHarvestFamily !== def.family
    ? canonicalRotationBonusMs(def.growMs) : 0;
}

export function rotationPreview(plot: FarmPlot | undefined, cropId?: string): FarmRotationPreview {
  const def = cropId ? farmCropDefOrNull(cropId) : null;
  const lastHarvestFamily = isFarmCropFamily(plot?.lastHarvestFamily) ? plot!.lastHarvestFamily! : null;
  const bonusMs = def ? rotationBonusFor(lastHarvestFamily, def.id) : 0;
  return {
    lastHarvestFamily,
    nextFamily: def?.family ?? null,
    bonusMs,
    label: bonusMs > 0 ? `Rotation boost: 10% faster (${Math.round(bonusMs / 1000)}s).` : lastHarvestFamily ? 'Same family: no rotation boost.' : 'First crop: no rotation boost.',
  };
}

/** The only history write: every successful harvest route calls this before clearing the crop. */
export function recordFarmHarvestFamily(plot: FarmPlot): void {
  const family = plot.crop && farmCropDefOrNull(plot.crop.defId)?.family;
  if (family) plot.lastHarvestFamily = family;
}

/** Defensive current-save normalization. Invalid history and forged bonuses fail closed. */
export function normalizeFarmRotation(state: GameState): void {
  for (const plot of state.plots) {
    if (!isFarmCropFamily(plot.lastHarvestFamily)) delete plot.lastHarvestFamily;
    const crop = plot.crop;
    if (!crop) continue;
    crop.wateredBonusMs = canonicalEstablishmentBonusMs(crop);
    const canonical = rotationBonusFor(plot.lastHarvestFamily, crop.defId);
    crop.rotationBonusMs = crop.rotationBonusMs === canonical ? canonical : 0;
  }
}

export function farmGrowthReadyAt(crop: NonNullable<FarmPlot['crop']>): number {
  const def = farmCropDefOrNull(crop.defId);
  if (!isValidFarmPlantedAt(crop.plantedAt)) return INVALID_FARM_READY_AT;
  const plantedAt = crop.plantedAt;
  if (!def) return INVALID_FARM_READY_AT;
  const establishmentMs = canonicalEstablishmentBonusMs(crop);
  // A crop instance does not carry its prior family, so before normalization
  // timing accepts only the exact canonical persisted rotation value.
  const canonicalRotation = canonicalRotationBonusMs(def.growMs);
  const pinnedRotationMs = crop.rotationBonusMs === 0 || crop.rotationBonusMs === canonicalRotation
    ? crop.rotationBonusMs : 0;
  const reduction = Math.min(Math.round(def.growMs * .3), establishmentMs + pinnedRotationMs);
  const readyAt = plantedAt + def.growMs - reduction;
  return Number.isSafeInteger(readyAt) && readyAt >= 0 ? readyAt : INVALID_FARM_READY_AT;
}

/** Pure UI summary; establishment and rotation reductions remain additive and capped at 30%. */
export function farmCropCareSummary(crop: NonNullable<FarmPlot['crop']>): FarmCropCareSummary {
  const establishmentMs = canonicalEstablishmentBonusMs(crop);
  const def = farmCropDefOrNull(crop.defId);
  const rotationBonusMs = def && crop.rotationBonusMs === canonicalRotationBonusMs(def.growMs) ? crop.rotationBonusMs : 0;
  const totalReductionMs = def ? Math.min(Math.round(def.growMs * .3), establishmentMs + rotationBonusMs) : 0;
  return { establishmentMs, rotationBonusMs, totalReductionMs, readyAt: farmGrowthReadyAt(crop) };
}
