/**
 * Authoritative Farm Empire acreage geometry in logical simulation tiles.
 * Presentation projects these coordinates; saves persist plots at them.
 */
export const FARM_PARCEL_DEFS = {
  starter: {
    id: 'starter',
    name: 'Starter Acreage',
    originX: 2,
    originY: 7,
    columns: 6,
    rows: 6,
  },
  north: {
    id: 'north',
    name: 'Neighboring Acreage',
    originX: 10,
    originY: 3,
    columns: 8,
    rows: 12,
  },
} as const;

export type FarmParcelId = keyof typeof FARM_PARCEL_DEFS;
