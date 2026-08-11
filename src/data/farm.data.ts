import type { FarmCropDef, FarmMarketEventDef } from '../core/types';

export const FARM_CROPS: FarmCropDef[] = [
  {
    id: 'crop_corn', name: 'Corn', startingSeeds: 2, unlock: 'starter', role: 'Balanced staple', seedPriceCents: 1_400, growMs: 70_000, witherMs: 900_000,
    harvestYield: 8, storageUnitsPerItem: 1, basePriceCents: 310, color: '#f0c94c',
  },
  {
    id: 'crop_wheat', name: 'Wheat', startingSeeds: 2, unlock: 'starter', role: 'Fast staple', seedPriceCents: 1_000, growMs: 55_000, witherMs: 900_000,
    harvestYield: 7, storageUnitsPerItem: 1, basePriceCents: 240, color: '#d8b85b',
  },
  {
    id: 'crop_soybean', name: 'Soybeans', startingSeeds: 2, unlock: 'starter', role: 'Steady margin', seedPriceCents: 1_700, growMs: 85_000, witherMs: 900_000,
    harvestYield: 9, storageUnitsPerItem: 1, basePriceCents: 350, color: '#8db45b',
  },
  {
    id: 'crop_potato', name: 'Potatoes', startingSeeds: 2, unlock: 'starter', role: 'High-yield staple', seedPriceCents: 1_900, witherMs: 900_000, growMs: 75_000,
    harvestYield: 10, storageUnitsPerItem: 1, basePriceCents: 290, color: '#b98b58',
  },
  {
    id: 'crop_carrot', name: 'Carrots', startingSeeds: 0, unlock: 'county-order', role: 'Quick low-risk turnaround', seedPriceCents: 1_100, growMs: 40_000, witherMs: 900_000,
    harvestYield: 6, storageUnitsPerItem: 1, basePriceCents: 200, color: '#e99545',
  },
  {
    id: 'crop_tomato', name: 'Tomatoes', startingSeeds: 0, unlock: 'county-order', role: 'Vine crop · high barn throughput', seedPriceCents: 2_200, growMs: 100_000, witherMs: 900_000,
    harvestYield: 18, storageUnitsPerItem: 1, basePriceCents: 220, color: '#d95b4f',
  },
  {
    id: 'crop_cabbage', name: 'Cabbage', startingSeeds: 0, unlock: 'north-parcel', role: 'Slow premium · storage efficient', seedPriceCents: 2_400, growMs: 140_000, witherMs: 900_000,
    harvestYield: 8, storageUnitsPerItem: 0.5, basePriceCents: 520, color: '#78a95c',
  },
  {
    id: 'crop_pumpkin', name: 'Pumpkins', startingSeeds: 0, unlock: 'barn-loft', role: 'Slowest · highest gross, bulky', seedPriceCents: 2_600, growMs: 180_000, witherMs: 900_000,
    harvestYield: 8, storageUnitsPerItem: 2.5, basePriceCents: 650, color: '#d98238',
  },
];

export const FARM_MARKET_EVENTS: FarmMarketEventDef[] = [
  { id: 'strong-corn-demand', name: 'Strong Corn Demand', cropId: 'crop_corn', modifierBps: 2_200, durationDays: 2 },
  { id: 'wheat-surplus', name: 'Wheat Surplus', cropId: 'crop_wheat', modifierBps: -1_800, durationDays: 2 },
  { id: 'potato-shortage', name: 'Potato Shortage', cropId: 'crop_potato', modifierBps: 2_500, durationDays: 3 },
  { id: 'exceptional-soybean-harvest', name: 'Exceptional Soybean Harvest', cropId: 'crop_soybean', modifierBps: -1_500, durationDays: 2 },
  { id: 'carrot-market-day', name: 'Carrot Market Day', cropId: 'crop_carrot', modifierBps: 1_900, durationDays: 2 },
  { id: 'tomato-sauce-demand', name: 'Tomato Sauce Demand', cropId: 'crop_tomato', modifierBps: 2_400, durationDays: 2 },
  { id: 'cabbage-cold-storage', name: 'Cabbage Cold Storage', cropId: 'crop_cabbage', modifierBps: 2_100, durationDays: 3 },
  { id: 'pumpkin-festival', name: 'Pumpkin Festival', cropId: 'crop_pumpkin', modifierBps: 2_800, durationDays: 3 },
];
