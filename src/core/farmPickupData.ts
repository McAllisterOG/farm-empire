import type { FarmPickupCargo } from './types';
import { FARM_TOWN_GATE } from './townGateway';

export const PICKUP_ID = 'old-pickup' as const;
export const PICKUP_NAME = 'Old Pickup';
export const PICKUP_CARGO_CAPACITY = 72;
// Keep the cargo pad visually clear of the barn while remaining close enough
// that loading and unloading still reads as one compact farmyard interaction.
export const PICKUP_START = Object.freeze({ x: 6.25, y: 5.1 });
export const PICKUP_CARGO_PAD = PICKUP_START;
export const PICKUP_CARGO_PAD_TOLERANCE = .8;
export const PICKUP_GATE_CONFLICT_TOLERANCE = .9;

export function pickupAtCargoPad(pickup: { x: number; y: number }, tolerance = PICKUP_CARGO_PAD_TOLERANCE): boolean {
  return Math.hypot(pickup.x - PICKUP_CARGO_PAD.x, pickup.y - PICKUP_CARGO_PAD.y) <= tolerance;
}

export function sanitizePickupPosition(x: unknown, y: unknown): { x: number; y: number } {
  const nextX = Number(x); const nextY = Number(y);
  if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || nextX < 0 || nextX > 24 || nextY < 0 || nextY > 24) return { ...PICKUP_START };
  return Math.hypot(nextX - FARM_TOWN_GATE.x, nextY - FARM_TOWN_GATE.y) <= PICKUP_GATE_CONFLICT_TOLERANCE
    ? { ...PICKUP_START }
    : { x: nextX, y: nextY };
}

export function pickupPositionForSave(pickupAtTown: boolean, current: { x: number; y: number }): { x: number; y: number } {
  return pickupAtTown ? { x: PICKUP_CARGO_PAD.x, y: PICKUP_CARGO_PAD.y } : { x: current.x, y: current.y };
}

export function emptyPickupCargo(): FarmPickupCargo {
  return { crops: {}, seeds: {} };
}
