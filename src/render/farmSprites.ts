/** Bounded farm-only animation domains. */
export const FARM_FACINGS = ['south', 'north', 'east', 'west'] as const;
export type FarmFacing = typeof FARM_FACINGS[number];
export const FARM_WALK_FRAME_COUNT = 4;
