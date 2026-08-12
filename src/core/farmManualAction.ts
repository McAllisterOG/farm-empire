import { farmParcelAtTile, farmParcelDef } from './farmParcels';
import type { GameState } from './types';

export type ManualFieldActionKind = 'prepare' | 'rework' | 'plant' | 'water' | 'harvest' | 'clear';
export type ManualFieldSelectionScope = 'section' | 'row' | 'three-rows';

export interface ManualFieldAction {
  kind: ManualFieldActionKind;
  plotUid: number;
  x: number;
  y: number;
  startedAt: number;
  durationMs: number;
}

export const MANUAL_FIELD_ACTION_DURATIONS: Readonly<Record<ManualFieldActionKind, number>> = {
  prepare: 900,
  rework: 800,
  plant: 650,
  water: 900,
  harvest: 850,
  clear: 700,
};

export const MANUAL_FIELD_ACTION_LABELS: Readonly<Record<ManualFieldActionKind, string>> = {
  prepare: 'Preparing soil',
  rework: 'Reworking stubble',
  plant: 'Planting seed',
  water: 'Watering seedlings',
  harvest: 'Harvesting crop',
  clear: 'Clearing field',
};

export function createManualFieldAction(
  kind: ManualFieldActionKind,
  plotUid: number,
  point: { x: number; y: number },
  startedAt: number,
): ManualFieldAction {
  return {
    kind,
    plotUid,
    x: point.x,
    y: point.y,
    startedAt: Number.isFinite(startedAt) ? startedAt : 0,
    durationMs: MANUAL_FIELD_ACTION_DURATIONS[kind],
  };
}

export function manualFieldActionProgress(action: ManualFieldAction, now: number): number {
  if (!Number.isFinite(now) || action.durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, (now - action.startedAt) / action.durationMs));
}

export function manualFieldActionComplete(action: ManualFieldAction, now: number): boolean {
  return manualFieldActionProgress(action, now) >= 1;
}

/**
 * Deterministic row selection for on-foot fieldwork. A three-row block keeps
 * the clicked row centered when possible and clamps at acreage edges. Rows
 * are traversed serpentine so the player does not teleport back to one side.
 */
export function manualFieldSelectionPlotUids(
  state: GameState,
  anchorPlotUid: number,
  scope: ManualFieldSelectionScope,
): number[] {
  const anchor = state.plots.find((plot) => plot.uid === anchorPlotUid);
  if (!anchor) return [];
  if (scope === 'section') return [anchor.uid];
  const parcelId = farmParcelAtTile(anchor.x, anchor.y);
  if (!parcelId) return [];
  const parcel = farmParcelDef(parcelId);
  const firstY = scope === 'row'
    ? anchor.y
    : Math.max(parcel.originY, Math.min(anchor.y - 1, parcel.originY + parcel.rows - 3));
  const lastY = scope === 'row' ? firstY : Math.min(parcel.originY + parcel.rows - 1, firstY + 2);
  const plotsByCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot]));
  const result: number[] = [];
  for (let y = firstY; y <= lastY; y++) {
    const rowOffset = y - firstY;
    const xs = Array.from({ length: parcel.columns }, (_, index) => parcel.originX + index);
    if (rowOffset % 2 === 1) xs.reverse();
    for (const x of xs) {
      const plot = plotsByCoordinate.get(`${x}:${y}`);
      if (plot) result.push(plot.uid);
    }
  }
  return result;
}
