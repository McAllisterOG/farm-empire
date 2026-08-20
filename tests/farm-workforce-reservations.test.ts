import { describe, expect, it } from 'vitest';
import '../src/data';
import { farmOf } from '../src/core/farmBusiness';
import { FarmWorkforceReservationLedger } from '../src/core/farmWorkforceReservations';
import { createFarmGame } from '../src/core/state';

const NOW = 1_730_000_000_000;

function preparedState() {
  const state = createFarmGame('Claims', 77, NOW); const farm = farmOf(state);
  farm.seeds.crop_corn = 2;
  for (const plot of state.plots.slice(0, 3)) farm.fieldConditions[String(plot.uid)] = { soil: 'tilled' };
  return state;
}

describe('Workforce runtime reservations', () => {
  it('deterministically gives two workers distinct seed and plot claims', () => {
    const state = preparedState(); const ledger = new FarmWorkforceReservationLedger(); const [a, b] = state.plots;
    expect(ledger.reserve(state, { workerId: 'mara-bell', kind: 'plant', cropId: 'crop_corn', targetPlotUids: [a.uid, b.uid] }).targetPlotUids).toEqual([a.uid, b.uid]);
    expect(ledger.reserve(state, { workerId: 'eliot-reyes', kind: 'plant', cropId: 'crop_corn', targetPlotUids: [a.uid, b.uid] }).targetPlotUids).toEqual([]);
    expect(ledger.isClaimed(a.uid)).toBe(true); expect(ledger.heldSeeds('crop_corn')).toBe(2);
  });

  it('releases only unconsumed claims and fails malformed inputs closed', () => {
    const state = preparedState(); const ledger = new FarmWorkforceReservationLedger(); const [a, b] = state.plots;
    ledger.reserve(state, { workerId: 'mara-bell', kind: 'plant', cropId: 'crop_corn', targetPlotUids: [a.uid, b.uid] });
    ledger.consume(state, 'mara-bell', 'plant', a.uid, 'crop_corn');
    expect(ledger.isClaimed(a.uid)).toBe(false); expect(ledger.isClaimed(b.uid)).toBe(true); expect(ledger.heldSeeds('crop_corn')).toBe(1);
    ledger.release('mara-bell'); expect(ledger.heldSeeds('crop_corn')).toBe(0); expect(ledger.isClaimed(b.uid)).toBe(false);
    expect(ledger.reserve(state, { workerId: 'bad' as never, kind: 'plant', cropId: 'crop_corn', targetPlotUids: [a.uid] }).targetPlotUids).toEqual([]);
  });

  it('holds weighted barn capacity for ready harvests before a second worker can claim it', () => {
    const state = preparedState(); const farm = farmOf(state); const [a, b] = state.plots;
    for (const plot of [a, b]) plot.crop = { defId: 'crop_corn', plantedAt: NOW - 100_000, wateredBonusMs: 0, lastWateredAt: NOW, awaitingWater: false, harvestYieldItems: 10, harvestBalanceVersion: 2 };
    farm.storageCapacity = 10; const ledger = new FarmWorkforceReservationLedger();
    expect(ledger.reserve(state, { workerId: 'mara-bell', kind: 'harvest', targetPlotUids: [a.uid] }).targetPlotUids).toEqual([a.uid]);
    expect(ledger.reserve(state, { workerId: 'eliot-reyes', kind: 'harvest', targetPlotUids: [b.uid] }).targetPlotUids).toEqual([]);
  });
});
