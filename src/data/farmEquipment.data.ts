export const OLD_TRACTOR_RESTORATION = {
  id: 'old-tractor-restoration',
  name: 'Old Tractor Restoration',
  priceCents: 195_000,
} as const;

export const COUNTY_ROW_CROP_FIELD_KIT = {
  id: 'county-row-crop-field-kit',
  name: 'County Row-Crop Field Kit',
  priceCents: 125_000,
  workSpeedBonusBps: 2_000,
  harvestBonusUnits: 1,
} as const;

export const BARN_LOFT_EXPANSION = {
  id: 'barn-loft-expansion',
  name: 'Barn Loft Expansion',
  priceCents: 180_000,
  fromCapacity: 150,
  toCapacity: 200,
} as const;
