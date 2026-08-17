import type { FarmHandBasketState } from './types';

/** Three starter corn harvests, one full pumpkin harvest, or one-third of the pickup. */
export const HAND_BASKET_CAPACITY = 24;

export function emptyHandBasket(): FarmHandBasketState {
  return { crops: {}, destination: 'barn' };
}
