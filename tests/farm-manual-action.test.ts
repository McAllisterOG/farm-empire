import { describe, expect, it } from 'vitest';
import {
  MANUAL_FIELD_ACTION_DURATIONS,
  createManualFieldAction,
  manualFieldActionComplete,
  manualFieldActionProgress,
  manualFieldRectanglePlotUids,
  manualFieldSelectionPlotUids,
} from '../src/core/farmManualAction';
import { createFarmGame } from '../src/core/state';
import { farmOf, purchaseNeighborParcel } from '../src/core/farmBusiness';

describe('manual field action timing', () => {
  it('creates a deterministic, plot-bound transient action', () => {
    expect(createManualFieldAction('water', 17, { x: 4, y: 9 }, 1_000)).toEqual({
      kind: 'water',
      plotUid: 17,
      x: 4,
      y: 9,
      startedAt: 1_000,
      durationMs: MANUAL_FIELD_ACTION_DURATIONS.water,
    });
  });

  it('clamps progress and completes only at the deterministic boundary', () => {
    const action = createManualFieldAction('harvest', 3, { x: 2, y: 5 }, 2_000);
    expect(manualFieldActionProgress(action, 1_000)).toBe(0);
    expect(manualFieldActionProgress(action, 2_425)).toBe(.5);
    expect(manualFieldActionComplete(action, 2_849)).toBe(false);
    expect(manualFieldActionComplete(action, 2_850)).toBe(true);
    expect(manualFieldActionProgress(action, 9_999)).toBe(1);
  });

  it('uses short action-specific timings without persisting callbacks or game state', () => {
    expect(Object.keys(MANUAL_FIELD_ACTION_DURATIONS)).toEqual([
      'prepare', 'rework', 'plant', 'water', 'harvest', 'clear',
    ]);
    for (const duration of Object.values(MANUAL_FIELD_ACTION_DURATIONS)) {
      expect(duration).toBeGreaterThanOrEqual(600);
      expect(duration).toBeLessThanOrEqual(1_000);
    }
  });

  it('selects a deterministic row and centered three-row block within one acreage', () => {
    const state = createFarmGame('Row Test', 123, 1_000);
    const anchor = state.plots.find((plot) => plot.x === 4 && plot.y === 9)!;
    const row = manualFieldSelectionPlotUids(state, anchor.uid, 'row').map((uid) => state.plots.find((plot) => plot.uid === uid)!).map((plot) => `${plot.x},${plot.y}`);
    expect(row).toEqual(['2,9', '3,9', '4,9', '5,9', '6,9', '7,9']);
    const block = manualFieldSelectionPlotUids(state, anchor.uid, 'three-rows').map((uid) => state.plots.find((plot) => plot.uid === uid)!).map((plot) => `${plot.x},${plot.y}`);
    expect(block).toEqual([
      '2,8', '3,8', '4,8', '5,8', '6,8', '7,8',
      '7,9', '6,9', '5,9', '4,9', '3,9', '2,9',
      '2,10', '3,10', '4,10', '5,10', '6,10', '7,10',
    ]);
  });

  it('clamps edge blocks and never crosses into neighboring acreage', () => {
    const state = createFarmGame('Row Test', 123, 1_000);
    const edge = state.plots.find((plot) => plot.x === 3 && plot.y === 7)!;
    expect(manualFieldSelectionPlotUids(state, edge.uid, 'three-rows')).toHaveLength(18);
    farmOf(state).cashCents = 10_000_000;
    expect(purchaseNeighborParcel(state).ok).toBe(true);
    const north = state.plots.find((plot) => plot.x === 12 && plot.y === 14)!;
    const selected = manualFieldSelectionPlotUids(state, north.uid, 'three-rows').map((uid) => state.plots.find((plot) => plot.uid === uid)!);
    expect(selected).toHaveLength(24);
    expect(new Set(selected.map((plot) => plot.y))).toEqual(new Set([12, 13, 14]));
    expect(selected.every((plot) => plot.x >= 10 && plot.x <= 17)).toBe(true);
  });

  it('fails safely for missing or off-acreage anchors', () => {
    const state = createFarmGame('Row Test', 123, 1_000);
    expect(manualFieldSelectionPlotUids(state, 999_999, 'row')).toEqual([]);
    state.plots.push({ uid: 999_999, x: 50, y: 50, crop: null });
    expect(manualFieldSelectionPlotUids(state, 999_999, 'three-rows')).toEqual([]);
  });

  it('selects an arbitrary drag rectangle in a deterministic serpentine route', () => {
    const state = createFarmGame('Drag Test', 123, 1_000);
    const anchor = state.plots.find((plot) => plot.x === 3 && plot.y === 8)!;
    const end = state.plots.find((plot) => plot.x === 6 && plot.y === 10)!;
    const coordinates = manualFieldRectanglePlotUids(state, anchor.uid, end.uid)
      .map((uid) => state.plots.find((plot) => plot.uid === uid)!)
      .map((plot) => `${plot.x},${plot.y}`);
    expect(coordinates).toEqual([
      '3,8', '4,8', '5,8', '6,8',
      '6,9', '5,9', '4,9', '3,9',
      '3,10', '4,10', '5,10', '6,10',
    ]);
    expect(manualFieldRectanglePlotUids(state, end.uid, anchor.uid)).toEqual(
      manualFieldRectanglePlotUids(state, anchor.uid, end.uid),
    );
  });

  it('keeps drag selection inside one acreage and fails safely for bad endpoints', () => {
    const state = createFarmGame('Drag Test', 123, 1_000);
    farmOf(state).cashCents = 10_000_000;
    expect(purchaseNeighborParcel(state).ok).toBe(true);
    const starter = state.plots.find((plot) => plot.x === 7 && plot.y === 12)!;
    const north = state.plots.find((plot) => plot.x === 10 && plot.y === 12)!;
    expect(manualFieldRectanglePlotUids(state, starter.uid, north.uid)).toEqual([]);
    expect(manualFieldRectanglePlotUids(state, starter.uid, 999_999)).toEqual([]);
  });
});
