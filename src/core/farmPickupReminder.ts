import type { GameState } from './types';
import { farmOf } from './farmBusiness';
import { pickupCargoUsed, reservedMarketCropUnits } from './farmPickup';

export interface FarmPickupReminderContext {
  mode: 'farm' | 'town';
  pickupAtTown: boolean;
  driving: boolean;
  basketUnits: number;
}

export function pickupReminderSignature(state: GameState, context: FarmPickupReminderContext): string {
  const farm = farmOf(state);
  const crops = Object.entries(farm.pickup.cargo.crops).filter(([, count]) => count > 0).sort().map(([id, count]) => `${id}:${count}`).join(',');
  const seeds = Object.entries(farm.pickup.cargo.seeds).filter(([, count]) => count > 0).sort().map(([id, count]) => `${id}:${count}`).join(',');
  const reserved = Object.keys(farm.pickup.cargo.crops).reduce((sum, id) => sum + reservedMarketCropUnits(state, id), 0);
  return `${context.mode}|${context.pickupAtTown}|${context.driving}|${context.basketUnits}|${crops}|${seeds}|${reserved}|${pickupCargoUsed(state)}`;
}

export function pickupReminderText(state: GameState, context: FarmPickupReminderContext): string | null {
  if (context.mode !== 'farm' || context.driving || context.pickupAtTown) return null;
  const farm = farmOf(state);
  const produce = Object.values(farm.pickup.cargo.crops).reduce((sum, count) => sum + Math.max(0, count), 0);
  const seeds = Object.values(farm.pickup.cargo.seeds).reduce((sum, count) => sum + Math.max(0, count), 0);
  const reserved = Object.keys(farm.pickup.cargo.crops).some((id) => reservedMarketCropUnits(state, id) > 0);
  if (context.basketUnits > 0 && produce === 0 && seeds === 0) return 'Basket contents are safe · unload at the barn';
  if (reserved) return 'County cargo is reserved · deliver it before selling';
  if (produce > 0) return 'Produce is loaded · visit the Grain Exchange or County delivery';
  if (seeds > 0) return 'Seed bags are still in the pickup · unload at the barn';
  return null;
}

export function reminderWindow(now: number, delayMs = 650, durationMs = 10_000): { showAt: number; expiresAt: number } {
  return { showAt: now + Math.max(0, delayMs), expiresAt: now + Math.max(0, delayMs) + Math.max(0, durationMs) };
}
