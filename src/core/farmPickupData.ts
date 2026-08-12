import type { FarmPickupCargo } from './types';

export const PICKUP_ID = 'old-pickup' as const;
export const PICKUP_NAME = 'Old Pickup';
export const PICKUP_CARGO_CAPACITY = 72;
export const PICKUP_START = Object.freeze({ x: 10.8, y: 6.7 });

export function emptyPickupCargo(): FarmPickupCargo {
  return { crops: {}, seeds: {} };
}
