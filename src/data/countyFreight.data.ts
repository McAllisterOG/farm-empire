/**
 * One compact freight template per Farm Empire crop. Offers only select crops
 * that are already unlocked, and the core snapshots the live quote on accept.
 */
export interface CountyFreightTemplate {
  cropId: string;
  title: string;
  buyer: string;
  requiredUnits: number;
}

export const COUNTY_FREIGHT_PREMIUM_BPS = 2_500;
export const COUNTY_FREIGHT_BULK_PREMIUM_BPS = 4_000;
export const COUNTY_FREIGHT_BID_COUNT = 3;

export type CountyFreightKind = 'standard' | 'bulk';

/** Commercial loads intentionally exceed the base pickup but fit its trailer. */
export function countyFreightBulkAllowedUnits(storageUnitsPerItem: number): readonly number[] {
  if (storageUnitsPerItem === 1) return [96, 104, 112, 120];
  if (storageUnitsPerItem === 3) return [32, 36, 40];
  return [];
}

export const COUNTY_FREIGHT_TEMPLATES: readonly CountyFreightTemplate[] = Object.freeze([
  { cropId: 'crop_corn', title: 'School Lunch Corn', buyer: 'County school kitchens', requiredUnits: 16 },
  { cropId: 'crop_wheat', title: 'Bakery Wheat Run', buyer: 'Main Street Bakery', requiredUnits: 14 },
  { cropId: 'crop_soybean', title: 'Co-op Feed Order', buyer: 'County livestock co-op', requiredUnits: 18 },
  { cropId: 'crop_potato', title: 'Diner Potato Order', buyer: 'Route 8 Diner', requiredUnits: 20 },
  { cropId: 'crop_carrot', title: 'Produce Box Carrots', buyer: 'County Pantry produce boxes', requiredUnits: 18 },
  { cropId: 'crop_tomato', title: 'Canning Kitchen Tomatoes', buyer: 'Community canning kitchen', requiredUnits: 36 },
  { cropId: 'crop_cabbage', title: 'Cold Storage Cabbage', buyer: 'County cold-storage buyer', requiredUnits: 16 },
  { cropId: 'crop_pumpkin', title: 'Market Pumpkin Load', buyer: 'Seasonal market committee', requiredUnits: 8 },
]);

export function countyFreightTemplate(cropId: string): CountyFreightTemplate {
  const template = COUNTY_FREIGHT_TEMPLATES.find((candidate) => candidate.cropId === cropId);
  if (!template) throw new Error(`unknown County freight crop: ${cropId}`);
  return template;
}
