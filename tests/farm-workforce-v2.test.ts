import { describe, expect, it } from 'vitest';
import { farmOf } from '../src/core/farmBusiness';
import { approveWorkforceDispatch, eliotUnlocked, hireEliotReyes, hireFarmManager, hireFirstFarmhand, reviewWorkforceDispatch, startWorkerShift, workerDispatchAvailable } from '../src/core/farmWorkforce';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize } from '../src/save/save';

const NOW = 1_730_000_000_000;

function readyCrew() {
  const state = createFarmGame('Crew V2', 414, NOW); const farm = farmOf(state);
  farm.townContact.status = 'completed'; farm.parcels.northOwned = true; farm.cashCents = 1_000_000;
  expect(hireFirstFarmhand(state).ok).toBe(true); expect(hireFarmManager(state).ok).toBe(true);
  return state;
}

describe('Workforce V2', () => {
  it('keeps Eliot gated and never charges approval or empty work', () => {
    const state = readyCrew(); const farm = farmOf(state); const before = farm.cashCents;
    farm.farmstead.officeQuartersOwned = true;
    expect(eliotUnlocked(state)).toBe(true); expect(hireEliotReyes(state).ok).toBe(true);
    const afterHire = farm.cashCents; expect(approveWorkforceDispatch(state).ok).toBe(true); expect(farm.cashCents).toBe(afterHire);
    expect(approveWorkforceDispatch(state).ok).toBe(false); expect(farm.workforce.dispatchApprovedDay).toBe(farm.clock.day);
    expect(startWorkerShift(state, 'eliot-reyes', 'starter', 'prepare', NOW).result.ok).toBe(true);
    expect(farm.cashCents).toBe(afterHire - 10_000);
    expect(before - afterHire).toBe(210_000);
    farm.workforce.workerLastDispatchedDay['eliot-reyes'] = farm.clock.day;
    expect(workerDispatchAvailable(state, 'eliot-reyes')).toBe(false);
  });

  it('uses two stable reviewed slots and migrates v23 without a new hire, wage, approval, or claim', () => {
    const state = readyCrew();
    expect(reviewWorkforceDispatch(state, NOW).map((review) => review.workerId)).toEqual(['mara-bell', 'eliot-reyes']);
    farmOf(state).workforce.workerLastDispatchedDay['mara-bell'] = farmOf(state).clock.day;
    const old = state as unknown as { version: number; farm: Record<string, unknown> }; old.version = 23;
    const loaded = deserialize(JSON.stringify(old), NOW);
    expect(SAVE_VERSION).toBe(26); expect(farmOf(loaded).workforce).toMatchObject({ eliotHired: false, eliotLastShiftPaidDay: 0, dispatchApprovedDay: 0 });
    expect(farmOf(loaded).workforce.slots[1].enabled).toBe(false);
    expect(farmOf(loaded).workforce.workerLastDispatchedDay).toEqual({ 'mara-bell': 0, 'eliot-reyes': 0 });
  });
});
