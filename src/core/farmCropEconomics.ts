import { COUNTY_ROW_CROP_FIELD_KIT } from '../data/farmEquipment.data';
import type { FarmCropDef } from './types';

export interface FarmCropEconomicsOptions {
  sectionCount: number;
  includeOperatedFieldKitYield?: boolean;
}

export interface FarmCropEconomics {
  sectionCount: number;
  seedCostCents: number;
  harvestItems: number;
  grossBaseValueCents: number;
  netBaseValueCents: number;
  totalStorageUnits: number;
  operatedFieldKitHarvestItems?: number;
  operatedFieldKitStorageUnits?: number;
}

/** Pure base-price planning math; it never reads volatile quotes or mutates farm state. */
export function farmCropEconomics(def: FarmCropDef, options: FarmCropEconomicsOptions): FarmCropEconomics {
  const sectionCount = Math.max(0, Math.floor(options.sectionCount));
  const harvestItems = def.harvestYield * sectionCount;
  const seedCostCents = def.seedPriceCents * sectionCount;
  const grossBaseValueCents = def.basePriceCents * harvestItems;
  const operatedFieldKitHarvestItems = options.includeOperatedFieldKitYield
    ? (def.harvestYield + COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits) * sectionCount
    : undefined;

  return {
    sectionCount,
    seedCostCents,
    harvestItems,
    grossBaseValueCents,
    netBaseValueCents: grossBaseValueCents - seedCostCents,
    totalStorageUnits: harvestItems * def.storageUnitsPerItem,
    ...(operatedFieldKitHarvestItems === undefined ? {} : {
      operatedFieldKitHarvestItems,
      operatedFieldKitStorageUnits: operatedFieldKitHarvestItems * def.storageUnitsPerItem,
    }),
  };
}
