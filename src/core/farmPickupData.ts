import type { FarmPickupCargo } from './types';

export const PICKUP_ID = 'old-pickup' as const;
export const PICKUP_NAME = 'Old Pickup';
export const PICKUP_CARGO_CAPACITY = 72;
export const PICKUP_START = Object.freeze({ x: 10.8, y: 6.7 });
export const PICKUP_CARGO_PAD = PICKUP_START;
export const PICKUP_CARGO_PAD_TOLERANCE = 1.35;

export function pickupAtCargoPad(pickup: { x: number; y: number }, tolerance = PICKUP_CARGO_PAD_TOLERANCE): boolean {
  return Math.hypot(pickup.x - PICKUP_CARGO_PAD.x, pickup.y - PICKUP_CARGO_PAD.y) <= tolerance;
}

export function pickupPositionForSave(pickupAtTown: boolean, current: { x: number; y: number }): { x: number; y: number } {
  return pickupAtTown ? { x: PICKUP_CARGO_PAD.x, y: PICKUP_CARGO_PAD.y } : { x: current.x, y: current.y };
}

export function emptyPickupCargo(): FarmPickupCargo {
  return { crops: {}, seeds: {} };
}
