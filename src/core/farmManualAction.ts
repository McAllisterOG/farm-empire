export type ManualFieldActionKind = 'prepare' | 'rework' | 'plant' | 'water' | 'harvest' | 'clear';

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
