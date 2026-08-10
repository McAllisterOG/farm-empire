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
