import { FARM_PARCEL_DEFS, type FarmParcelId } from '../data/farmParcels.data';
import type { FarmPlot, GameState } from './types';

export type { FarmParcelId } from '../data/farmParcels.data';

export interface FarmParcelTile { x: number; y: number }

export function farmParcelDef(parcelId: FarmParcelId): typeof FARM_PARCEL_DEFS[FarmParcelId] {
  return FARM_PARCEL_DEFS[parcelId];
}

export function farmParcelTiles(parcelId: FarmParcelId): FarmParcelTile[] {
  const def = farmParcelDef(parcelId);
  return Array.from({ length: def.columns * def.rows }, (_, index) => ({
    x: def.originX + index % def.columns,
    y: def.originY + Math.floor(index / def.columns),
  }));
}

export const STARTER_FIELD_TILES = farmParcelTiles('starter');
export const NEIGHBOR_FIELD_TILES = farmParcelTiles('north');

export function farmParcelSectionCount(parcelId: FarmParcelId): number {
  const def = farmParcelDef(parcelId);
  return def.columns * def.rows;
}

export function farmParcelContainsTile(parcelId: FarmParcelId, x: number, y: number): boolean {
  const def = farmParcelDef(parcelId);
  return Number.isInteger(x) && Number.isInteger(y)
    && x >= def.originX && x < def.originX + def.columns
    && y >= def.originY && y < def.originY + def.rows;
}

export function farmParcelAtTile(x: number, y: number): FarmParcelId | null {
  if (farmParcelContainsTile('starter', x, y)) return 'starter';
  if (farmParcelContainsTile('north', x, y)) return 'north';
  return null;
}

/** Fractional logical point test used to keep saved vehicles out of field soil. */
export function pointInFarmParcel(point: { x: number; y: number }, parcelId?: FarmParcelId): boolean {
  const ids: FarmParcelId[] = parcelId ? [parcelId] : ['starter', 'north'];
  return ids.some((id) => {
    const def = farmParcelDef(id);
    return point.x >= def.originX - .48 && point.x <= def.originX + def.columns - .52
      && point.y >= def.originY - .48 && point.y <= def.originY + def.rows - .52;
  });
}

/**
 * Add every missing section for owned acreage while preserving all existing
 * UIDs and crops. This is safe to run repeatedly during save normalization.
 */
export function ensureOwnedFarmParcelPlots(
  state: GameState,
  ownership: { starterOwned: boolean; northOwned: boolean },
): void {
  if (!Array.isArray(state.plots)) state.plots = [];
  const storedCounter = Number.isInteger(state.uidCounter) && state.uidCounter >= 0 ? state.uidCounter : 0;
  state.uidCounter = Math.max(storedCounter, ...state.plots.map((plot) => Number.isInteger(plot.uid) ? plot.uid : 0));
  const existing = new Set(state.plots.map((plot) => `${plot.x}:${plot.y}`));
  const ids: FarmParcelId[] = [
    ...(ownership.starterOwned ? ['starter' as const] : []),
    ...(ownership.northOwned ? ['north' as const] : []),
  ];
  for (const id of ids) for (const tile of farmParcelTiles(id)) {
    const key = `${tile.x}:${tile.y}`;
    if (existing.has(key)) continue;
    state.uidCounter += 1;
    state.plots.push({ uid: state.uidCounter, x: tile.x, y: tile.y, crop: null } satisfies FarmPlot);
    existing.add(key);
  }
}
