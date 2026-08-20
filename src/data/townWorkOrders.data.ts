/** One deliberate first contract; this is not a generic quest catalogue. */
export interface TownWorkOrderDef {
  id: 'county-pantry-corn-001';
  title: string;
  cropId: 'crop_corn';
  requiredUnits: number;
  payoutCents: number;
}

export const COUNTY_PANTRY_CORN_ORDER: Readonly<TownWorkOrderDef> = Object.freeze({
  id: 'county-pantry-corn-001',
  title: 'County Pantry Corn Order',
  cropId: 'crop_corn',
  requiredUnits: 12,
  payoutCents: 8_500,
});

export const COUNTY_KITCHEN_GARDEN_TABLE_DELIVERY = Object.freeze({
  title: 'Garden Table Delivery', payoutCents: 11_500,
  cargo: { crop_corn: 8, crop_carrots: 6, crop_tomatoes: 4 },
} as const);
