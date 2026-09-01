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

/** All sections in the clicked owned acreage, in stable row-major order. */
export function manualFieldAcreagePlotUids(state: GameState, anchorPlotUid: number): number[] {
  const anchor = state.plots.find((plot) => plot.uid === anchorPlotUid);
  if (!anchor) return [];
  const parcelId = farmParcelAtTile(anchor.x, anchor.y);
  if (!parcelId) return [];
  const byCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot.uid]));
  return farmParcelDef(parcelId) ? Array.from({ length: farmParcelDef(parcelId).rows }, (_, row) =>
    Array.from({ length: farmParcelDef(parcelId).columns }, (_, column) => byCoordinate.get(`${farmParcelDef(parcelId).originX + column}:${farmParcelDef(parcelId).originY + row}`))
      .filter((uid): uid is number => uid !== undefined),
  ).flat() : [];
}

/**
 * Deterministic rectangular drag selection within one owned acreage. The
 * returned route is serpentine so the existing manual job runner can walk it
 * without jumping back to the same edge after every row.
 */
export function manualFieldRectanglePlotUids(
  state: GameState,
  anchorPlotUid: number,
  endPlotUid: number,
): number[] {
  const anchor = state.plots.find((plot) => plot.uid === anchorPlotUid);
  const end = state.plots.find((plot) => plot.uid === endPlotUid);
  if (!anchor || !end) return [];
  const parcelId = farmParcelAtTile(anchor.x, anchor.y);
  if (!parcelId || farmParcelAtTile(end.x, end.y) !== parcelId) return [];
  const minX = Math.min(anchor.x, end.x);
  const maxX = Math.max(anchor.x, end.x);
  const minY = Math.min(anchor.y, end.y);
  const maxY = Math.max(anchor.y, end.y);
  const plotsByCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot]));
  const result: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    const xs = Array.from({ length: maxX - minX + 1 }, (_, index) => minX + index);
    if ((y - minY) % 2 === 1) xs.reverse();
    for (const x of xs) {
      const plot = plotsByCoordinate.get(`${x}:${y}`);
      if (plot && farmParcelAtTile(plot.x, plot.y) === parcelId) result.push(plot.uid);
    }
  }
  return result;
}
