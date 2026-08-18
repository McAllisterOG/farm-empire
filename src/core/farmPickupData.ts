import type { FarmPickupCargo } from './types';
import { FARM_TOWN_GATE } from './townGateway';

export const PICKUP_ID = 'old-pickup' as const;
export const PICKUP_NAME = 'Old Pickup';
export const PICKUP_BASE_CARGO_CAPACITY = 72;
export const PICKUP_TRAILER_CARGO_CAPACITY = 144;
/** @deprecated Prefer pickupCargoCapacity(state) for player-facing and transaction logic. */
export const PICKUP_CARGO_CAPACITY = PICKUP_BASE_CARGO_CAPACITY;
// Keep the cargo pad visually clear of the barn while remaining close enough
// that loading and unloading still reads as one compact farmyard interaction.
export const PICKUP_START = Object.freeze({ x: 6.25, y: 5.1 });
export const PICKUP_CARGO_PAD = PICKUP_START;
export const PICKUP_CARGO_PAD_TOLERANCE = .8;
export const PICKUP_GATE_CONFLICT_TOLERANCE = .9;
/** Shared logical movement envelope for the farm's drivable vehicles. */
export const FARM_VEHICLE_MOVEMENT_BOUNDS = Object.freeze({ minX: 0, minY: 0, maxX: 24, maxY: 24 });

export function pickupAtCargoPad(pickup: { x: number; y: number }, tolerance = PICKUP_CARGO_PAD_TOLERANCE): boolean {
  return Math.hypot(pickup.x - PICKUP_CARGO_PAD.x, pickup.y - PICKUP_CARGO_PAD.y) <= tolerance;
}

export function sanitizePickupPosition(x: unknown, y: unknown): { x: number; y: number } {
  const nextX = Number(x); const nextY = Number(y);
  const bounds = FARM_VEHICLE_MOVEMENT_BOUNDS;
  if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || nextX < bounds.minX || nextX > bounds.maxX || nextY < bounds.minY || nextY > bounds.maxY) return { ...PICKUP_START };
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
