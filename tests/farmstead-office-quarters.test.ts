import { describe, expect, it } from 'vitest';
import '../src/data';
import { FARMSTEAD_OFFICE_QUARTERS } from '../src/data/farmstead.data';
import { farmOf } from '../src/core/farmBusiness';
import { eliotUnlocked, hireEliotReyes } from '../src/core/farmWorkforce';
import { officeQuartersUnlocked, purchaseFarmsteadOfficeQuarters } from '../src/core/farmstead';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { farmhousePresentationTier, farmLandmarks, farmWorldPoint } from '../src/render/farmLayout';
import { farmInteractionAtWorldPoint } from '../src/render/farmInteractions';

const NOW = 1_700_000_000_000;
function eligible() {
  const state = createFarmGame('Farmstead', 25, NOW); const farm = farmOf(state);
  farm.townContact.status = 'completed'; farm.parcels.northOwned = true;
  farm.workforce.farmhandHired = true; farm.workforce.manager.hired = true;
  return state;
}

describe('Farmstead Office & Crew Quarters V1', () => {
  it('requires every prerequisite, charges exactly once, and leaves workforce economics untouched', () => {
    const state = createFarmGame('Farmstead', 25, NOW); const farm = farmOf(state);
    const before = JSON.stringify({ cash: farm.cashCents, workforce: farm.workforce, storage: farm.storage, pickup: farm.pickup, plots: state.plots });
    expect(purchaseFarmsteadOfficeQuarters(state).ok).toBe(false);
    expect(JSON.stringify({ cash: farm.cashCents, workforce: farm.workforce, storage: farm.storage, pickup: farm.pickup, plots: state.plots })).toBe(before);
    for (const remove of [
      (candidate: ReturnType<typeof eligible>) => { farmOf(candidate).townContact.status = 'unmet'; },
      (candidate: ReturnType<typeof eligible>) => { farmOf(candidate).parcels.northOwned = false; },
      (candidate: ReturnType<typeof eligible>) => { farmOf(candidate).workforce.farmhandHired = false; },
      (candidate: ReturnType<typeof eligible>) => { farmOf(candidate).workforce.manager.hired = false; },
    ]) {
      const gated = eligible(); const gatedFarm = farmOf(gated); const gatedBefore = gatedFarm.cashCents;
      remove(gated); expect(purchaseFarmsteadOfficeQuarters(gated).ok).toBe(false); expect(gatedFarm.cashCents).toBe(gatedBefore);
    }
    farm.townContact.status = 'completed'; farm.parcels.northOwned = true; farm.workforce.farmhandHired = true; farm.workforce.manager.hired = true;
    const cash = farm.cashCents; const workforce = JSON.stringify(farm.workforce);
    expect(officeQuartersUnlocked(state)).toBe(true);
    expect(purchaseFarmsteadOfficeQuarters(state).ok).toBe(true);
    expect(farm.cashCents).toBe(cash - FARMSTEAD_OFFICE_QUARTERS.priceCents);
    expect(JSON.stringify(farm.workforce)).toBe(workforce);
    const after = farm.cashCents;
    expect(purchaseFarmsteadOfficeQuarters(state).ok).toBe(false);
    expect(farm.cashCents).toBe(after);
  });

  it('gates Eliot strictly behind owned quarters and preserves valid v25 ownership on reload', () => {
    const state = eligible();
    expect(eliotUnlocked(state)).toBe(false); expect(hireEliotReyes(state).ok).toBe(false);
    expect(purchaseFarmsteadOfficeQuarters(state).ok).toBe(true);
    expect(eliotUnlocked(state)).toBe(true); expect(hireEliotReyes(state).ok).toBe(true);
    const loaded = deserialize(serialize(state, NOW + 1), NOW + 2);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(farmOf(loaded).farmstead.officeQuartersOwned).toBe(true);
  });

  it('grandfathers only a valid v24 Eliot hire and fails corrupt/inconsistent property closed without disturbing business state', () => {
    const valid = eligible(); const validFarm = farmOf(valid); validFarm.workforce.eliotHired = true;
    const raw = JSON.parse(serialize(valid, NOW)) as any; raw.version = 24; delete raw.farm.farmstead;
    const migrated = deserialize(JSON.stringify(raw), NOW + 1);
    expect(farmOf(migrated).farmstead.officeQuartersOwned).toBe(true);
    const corrupt = eligible(); const corruptFarm = farmOf(corrupt); corruptFarm.cashCents = 321_654; corruptFarm.pickup.cargo.crops.crop_corn = 7; corruptFarm.workforce.lastShiftPaidDay = 1; corruptFarm.workforce.eliotHired = true;
    const bad = JSON.parse(serialize(corrupt, NOW)) as any; bad.farm.farmstead = { officeQuartersOwned: true }; bad.farm.workforce.manager.hired = false;
    const loaded = deserialize(JSON.stringify(bad), NOW + 1);
    expect(farmOf(loaded).farmstead.officeQuartersOwned).toBe(false);
    expect(farmOf(loaded).workforce.eliotHired).toBe(false);
    expect(farmOf(loaded).cashCents).toBe(321_654); expect(farmOf(loaded).pickup.cargo.crops).toEqual({ crop_corn: 7 }); expect(farmOf(loaded).workforce.lastShiftPaidDay).toBe(1);
  });

  it('uses a single crew-quarters farmhouse target without outranking pickup, tractor, or Scout', () => {
    const state = eligible(); const farm = farmOf(state); farm.farmstead.officeQuartersOwned = true;
    expect(farmhousePresentationTier(true, true)).toBe('crew-quarters');
    const home = farmWorldPoint(farmLandmarks().farmhouse);
    const runtime = { pickup: { x: 90, y: 90 }, tractor: { x: 80, y: 80 }, scout: { x: 70, y: 70 }, now: NOW };
    expect(farmInteractionAtWorldPoint(state, home, runtime)).toMatchObject({ kind: 'farmhouse', label: 'Farmstead Office & Crew Quarters' });
    expect(farmInteractionAtWorldPoint(state, home, { ...runtime, pickup: farmLandmarks().farmhouse })).toMatchObject({ kind: 'pickup' });
    expect(farmLandmarks().farmhandHome).not.toEqual(farmLandmarks().crewHandHome);
  });
});
