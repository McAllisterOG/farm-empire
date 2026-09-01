import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { pickupReminderSignature, pickupReminderText, reminderWindow } from '../src/core/farmPickupReminder';

describe('pickup reminder policy', () => {
  it('prioritizes County reservations over ordinary produce advice', () => {
    const state = createFarmGame('reminder', 31, Date.UTC(2026, 0, 1));
    const farm = farmOf(state);
    farm.pickup.cargo.crops.crop_corn = 15;
    farm.townContact.status = 'active';
    const context = { mode: 'farm' as const, pickupAtTown: false, driving: false, basketUnits: 0 };
    expect(pickupReminderText(state, context)).toContain('County cargo');
  });

  it('suggests seed unloading and suppresses advice while driving', () => {
    const state = createFarmGame('seeds', 32, Date.UTC(2026, 0, 1));
    farmOf(state).pickup.cargo.seeds.crop_corn = 2;
    expect(pickupReminderText(state, { mode: 'farm', pickupAtTown: false, driving: false, basketUnits: 0 })).toContain('Seed bags');
    expect(pickupReminderText(state, { mode: 'farm', pickupAtTown: false, driving: true, basketUnits: 0 })).toBeNull();
  });

  it('uses stable revisions and a delayed ten-second window', () => {
    const state = createFarmGame('revision', 33, Date.UTC(2026, 0, 1));
    const context = { mode: 'farm' as const, pickupAtTown: false, driving: false, basketUnits: 0 };
    expect(pickupReminderSignature(state, context)).toBe(pickupReminderSignature(state, context));
    expect(reminderWindow(1000)).toEqual({ showAt: 1650, expiresAt: 11650 });
  });
});
