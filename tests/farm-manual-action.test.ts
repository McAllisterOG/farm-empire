import { describe, expect, it } from 'vitest';
import {
  MANUAL_FIELD_ACTION_DURATIONS,
  createManualFieldAction,
  manualFieldActionComplete,
  manualFieldActionProgress,
} from '../src/core/farmManualAction';

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
});
