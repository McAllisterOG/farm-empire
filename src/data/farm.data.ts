import type { FarmCropDef, FarmMarketEventDef } from '../core/types';

export const FARM_CROPS: FarmCropDef[] = [
  {
    id: 'crop_corn', name: 'Corn', seedPriceCents: 1_400, growMs: 70_000,
    harvestYield: 8, storageUnitsPerItem: 1, basePriceCents: 310, color: '#f0c94c',
  },
  {
    id: 'crop_wheat', name: 'Wheat', seedPriceCents: 1_000, growMs: 55_000,
    harvestYield: 7, storageUnitsPerItem: 1, basePriceCents: 240, color: '#d8b85b',
  },
  {
    id: 'crop_soybean', name: 'Soybeans', seedPriceCents: 1_700, growMs: 85_000,
    harvestYield: 9, storageUnitsPerItem: 1, basePriceCents: 350, color: '#8db45b',
  },
  {
    id: 'crop_potato', name: 'Potatoes', seedPriceCents: 1_900, growMs: 75_000,
    harvestYield: 10, storageUnitsPerItem: 1, basePriceCents: 290, color: '#b98b58',
  },
];

export const FARM_MARKET_EVENTS: FarmMarketEventDef[] = [
  { id: 'strong-corn-demand', name: 'Strong Corn Demand', cropId: 'crop_corn', modifierBps: 2_200, durationDays: 2 },
  { id: 'wheat-surplus', name: 'Wheat Surplus', cropId: 'crop_wheat', modifierBps: -1_800, durationDays: 2 },
  { id: 'potato-shortage', name: 'Potato Shortage', cropId: 'crop_potato', modifierBps: 2_500, durationDays: 3 },
  { id: 'exceptional-soybean-harvest', name: 'Exceptional Soybean Harvest', cropId: 'crop_soybean', modifierBps: -1_500, durationDays: 2 },
];
