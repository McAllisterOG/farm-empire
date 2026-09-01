import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { farmOf, farmFieldCondition } from '../src/core/farmBusiness';
import { manualFieldAcreagePlotUids, manualFieldRectanglePlotUids } from '../src/core/farmManualAction';

describe('manual field scope clarity', () => {
  it('keeps whole-field scope inside the clicked starter acreage', () => {
    const state = createFarmGame('scope', 41, Date.UTC(2026, 0, 1));
    const anchor = state.plots[0].uid;
    expect(manualFieldAcreagePlotUids(state, anchor)).toHaveLength(36);
    expect(manualFieldRectanglePlotUids(state, anchor, state.plots[state.plots.length - 1].uid)).toHaveLength(36);
    expect(farmFieldCondition(state, anchor).soil).toBe('rough');
    expect(farmOf(state).parcels.starterOwned).toBe(true);
  });
});
