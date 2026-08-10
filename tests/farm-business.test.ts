import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { allFarmCrops, farmCropDef, farmMarketEventDef } from '../src/core/registry';
import { cropDef } from '../src/core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, advanceFarmClock, buyFarmSeeds, farmOf, harvestFarmCrop,
  marketMovement, placePlayerAtTractorDismount, plantFarmCrop, planParcelWork,
  purchaseNeighborParcel, sellStoredCrop, serpentineFieldTiles, storageUsed,
  updateFarmMarketToDay,
} from '../src/core/farmBusiness';
import { deserialize, serialize } from '../src/save/save';
import { NOW } from './helpers';

function makeFarm(seed = 4242) {
  return createFarmGame('Test Farm', seed, NOW);
}

function plantAndMature(state: ReturnType<typeof makeFarm>, cropId = 'crop_corn', plotIndex = 0): void {
  const farm = farmOf(state);
  farm.seeds[cropId] = Math.max(1, farm.seeds[cropId] ?? 0);
  const plot = state.plots[plotIndex];
  expect(plantFarmCrop(state, plot.uid, cropId, NOW).ok).toBe(true);
  plot.crop!.plantedAt = NOW - cropDef(cropId).growMs - 1;
}

describe('Farm Empire crop definitions', () => {
  it('defines exactly the four V1 crops with valid business values', () => {
    const crops = allFarmCrops();
    expect(crops.map((crop) => crop.id)).toEqual([
      'crop_corn', 'crop_wheat', 'crop_soybean', 'crop_potato',
    ]);
    for (const crop of crops) {
      expect(crop.seedPriceCents).toBeGreaterThan(0);
      expect(crop.growMs).toBeGreaterThan(0);
      expect(crop.harvestYield).toBeGreaterThan(0);
      expect(crop.storageUnitsPerItem).toBeGreaterThan(0);
      expect(crop.basePriceCents).toBeGreaterThan(0);
      expect(cropDef(crop.id)).toBeTruthy();
    }
  });
});

describe('farm inputs, planting, harvest, and storage', () => {
  it('buys seeds with exact integer-cent cash calculation', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    const beforeCash = farm.cashCents;
    const beforeSeeds = farm.seeds.crop_wheat;
    expect(buyFarmSeeds(state, 'crop_wheat', 5).ok).toBe(true);
    expect(farm.cashCents).toBe(beforeCash - farmCropDef('crop_wheat').seedPriceCents * 5);
    expect(farm.seeds.crop_wheat).toBe(beforeSeeds + 5);
  });

  it('requires an owned empty field and an available seed', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.seeds.crop_corn = 0;
    expect(plantFarmCrop(state, state.plots[0].uid, 'crop_corn', NOW).ok).toBe(false);
    farm.seeds.crop_corn = 1;
    expect(plantFarmCrop(state, state.plots[0].uid, 'crop_corn', NOW).ok).toBe(true);
    expect(plantFarmCrop(state, state.plots[0].uid, 'crop_corn', NOW).ok).toBe(false);
  });

  it('harvests the data yield plus the operational old-tractor bonus into storage', () => {
    const state = makeFarm();
    plantAndMature(state, 'crop_soybean');
    const result = harvestFarmCrop(state, state.plots[0].uid, NOW);
    expect(result.ok).toBe(true);
    expect(farmOf(state).storage.crop_soybean).toBe(
      farmCropDef('crop_soybean').harvestYield + farmOf(state).equipment.tractor.harvestBonusUnits,
    );
    expect(state.plots[0].crop).toBeNull();
  });

  it('rejects a harvest when capacity is insufficient and leaves the mature crop intact', () => {
    const state = makeFarm();
    plantAndMature(state, 'crop_potato');
    farmOf(state).storageCapacity = farmCropDef('crop_potato').harvestYield;
    const planted = state.plots[0].crop;
    const result = harvestFarmCrop(state, state.plots[0].uid, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Barn full');
    expect(state.plots[0].crop).toBe(planted);
    expect(storageUsed(state)).toBe(0);
  });
});

describe('tractor parcel work planning and transactional steps', () => {
  it('orders field coordinates in deterministic serpentine rows', () => {
    const shuffled = [
      { x: 7, y: 9 }, { x: 5, y: 7 }, { x: 6, y: 8 },
      { x: 7, y: 7 }, { x: 5, y: 9 }, { x: 5, y: 8 },
      { x: 6, y: 9 }, { x: 6, y: 7 }, { x: 7, y: 8 },
    ];
    expect(serpentineFieldTiles(shuffled).map((tile) => `${tile.x},${tile.y}`)).toEqual([
      '5,7', '6,7', '7,7',
      '7,8', '6,8', '5,8',
      '5,9', '6,9', '7,9',
    ]);
  });

  it('plans only empty and ready plots in route order and rejects a locked parcel', () => {
    const state = makeFarm();
    plantAndMature(state, 'crop_corn', 1);
    farmOf(state).seeds.crop_wheat = 1;
    expect(plantFarmCrop(state, state.plots[4].uid, 'crop_wheat', NOW).ok).toBe(true);
    state.plots.reverse();

    const plan = planParcelWork(state, 'starter', NOW);
    const coordinates = (uids: number[]) => uids.map((uid) => {
      const plot = state.plots.find((candidate) => candidate.uid === uid)!;
      return `${plot.x},${plot.y}`;
    });
    expect(coordinates(plan.orderedPlotUids)).toEqual([
      '5,7', '6,7', '7,7', '7,8', '6,8', '5,8', '5,9', '6,9', '7,9',
    ]);
    expect(plan.harvestPlotUids).toEqual([state.plots.find((plot) => plot.x === 6 && plot.y === 7)!.uid]);
    expect(plan.plantPlotUids).toHaveLength(7);
    expect(planParcelWork(state, 'north', NOW).orderedPlotUids).toEqual([]);
  });

  it('keeps a seed-limited parcel planting job safe when each planned step is attempted', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.seeds.crop_soybean = 3;
    const plan = planParcelWork(state, 'starter', NOW);
    const results = plan.plantPlotUids.map((uid) => plantFarmCrop(state, uid, 'crop_soybean', NOW));

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok)).toHaveLength(6);
    expect(farm.seeds.crop_soybean).toBe(0);
    expect(state.plots.filter((plot) => plot.crop?.defId === 'crop_soybean')).toHaveLength(3);
  });

  it('partially harvests to exact barn capacity without clearing failed crops', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    for (let index = 0; index < 3; index++) plantAndMature(state, 'crop_corn', index);
    const perTileYield = farmCropDef('crop_corn').harvestYield + farm.equipment.tractor.harvestBonusUnits;
    farm.storageCapacity = perTileYield * 2;
    const plan = planParcelWork(state, 'starter', NOW);
    const results = plan.harvestPlotUids.map((uid) => harvestFarmCrop(state, uid, NOW));

    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(farm.storage.crop_corn).toBe(perTileYield * 2);
    expect(state.plots.filter((plot) => plot.crop?.defId === 'crop_corn')).toHaveLength(1);
  });
});

describe('commodity selling', () => {
  it('sells stored crops at the current quote and credits exact cash', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.storage.crop_corn = 12;
    farm.market.quotes.crop_corn.currentCents = 333;
    const before = farm.cashCents;
    expect(sellStoredCrop(state, 'crop_corn', 7).ok).toBe(true);
    expect(farm.storage.crop_corn).toBe(5);
    expect(farm.cashCents).toBe(before + 7 * 333);
  });

  it('prevents overselling and invalid quantities without changing state', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.storage.crop_wheat = 2;
    const cash = farm.cashCents;
    expect(sellStoredCrop(state, 'crop_wheat', 3).ok).toBe(false);
    expect(sellStoredCrop(state, 'crop_wheat', 0).ok).toBe(false);
    expect(farm.storage.crop_wheat).toBe(2);
    expect(farm.cashCents).toBe(cash);
  });
});

describe('deterministic commodity market', () => {
  it('produces identical quotes and events from the same seed and day', () => {
    const a = makeFarm(99);
    const b = makeFarm(99);
    updateFarmMarketToDay(a, 30);
    updateFarmMarketToDay(b, 30);
    expect(farmOf(a).market).toEqual(farmOf(b).market);
  });

  it('keeps every commodity within its bounded base-price range', () => {
    const state = makeFarm(123);
    updateFarmMarketToDay(state, 240);
    for (const def of allFarmCrops()) {
      const quote = farmOf(state).market.quotes[def.id];
      expect(quote.currentCents).toBeGreaterThanOrEqual(Math.round(def.basePriceCents * 0.65));
      expect(quote.currentCents).toBeLessThanOrEqual(Math.round(def.basePriceCents * 1.55));
    }
  });

  it('applies a crop event, tracks movement, and expires its duration', () => {
    const state = makeFarm(77);
    const farm = farmOf(state);
    farm.market.activeEvents = [{
      ...farmMarketEventDef('strong-corn-demand'), id: 'test-demand', remainingDays: 2,
    }];
    updateFarmMarketToDay(state, 2);
    expect(farm.market.quotes.crop_corn.currentCents).toBeGreaterThan(farmCropDef('crop_corn').basePriceCents);
    expect(marketMovement(farm.market.quotes.crop_corn.currentCents, farm.market.quotes.crop_corn.previousCents).direction).toBe('up');
    updateFarmMarketToDay(state, 3);
    expect(farm.market.activeEvents.some((event) => event.id === 'test-demand')).toBe(false);
  });

  it('updates once when the accelerated saved clock crosses a day boundary', () => {
    const state = makeFarm();
    advanceFarmClock(state, NOW + 180_000);
    expect(farmOf(state).clock.day).toBe(2);
    expect(farmOf(state).market.lastUpdatedDay).toBe(2);
  });
});

describe('land and save compatibility', () => {
  it('validates the parcel price, unlocks nine tiles once, and prevents repeat purchase', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.cashCents = FIRST_PARCEL_PRICE_CENTS - 1;
    expect(purchaseNeighborParcel(state).ok).toBe(false);
    farm.cashCents = FIRST_PARCEL_PRICE_CENTS;
    const beforePlots = state.plots.length;
    expect(purchaseNeighborParcel(state).ok).toBe(true);
    expect(farm.cashCents).toBe(0);
    expect(state.plots.length).toBe(beforePlots + 9);
    expect(purchaseNeighborParcel(state).ok).toBe(false);
    expect(state.plots.length).toBe(beforePlots + 9);
  });

  it('serializes and reloads Farm Empire cash, crops, storage, market, events, time, tractor, and land', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    plantAndMature(state, 'crop_corn');
    expect(harvestFarmCrop(state, state.plots[0].uid, NOW).ok).toBe(true);
    farm.cashCents = FIRST_PARCEL_PRICE_CENTS;
    expect(purchaseNeighborParcel(state).ok).toBe(true);
    updateFarmMarketToDay(state, 12);
    farm.market.activeEvents = [{ ...farmMarketEventDef('potato-shortage'), remainingDays: 2 }];
    farm.clock.day = 12;
    farm.equipment.tractor.x = 11;
    farm.equipment.tractor.y = 8;
    const loaded = deserialize(serialize(state, NOW + 5_000), NOW + 6_000);
    expect(loaded.farm).toEqual(state.farm);
    expect(loaded.plots).toEqual(state.plots);
    expect(loaded.farm!.equipment.tractor.name).toBe('Old Red Tractor');
    expect(loaded.farm!.equipment.tractor.x).toBe(11);
    expect(loaded.farm!.equipment.tractor.y).toBe(8);
  });

  it('stages mounted saves at the deterministic dismount offset without moving the tractor', () => {
    const state = makeFarm();
    const tractor = farmOf(state).equipment.tractor;
    tractor.x = 6.4;
    tractor.y = 9.6;
    const position = placePlayerAtTractorDismount(state);
    const loaded = deserialize(serialize(state, NOW + 1_000), NOW + 2_000);

    expect(position).toEqual({ x: 7.15, y: 9.85 });
    expect(loaded.player.px).toBe(7.15);
    expect(loaded.player.py).toBe(9.85);
    expect(loaded.farm!.equipment.tractor.x).toBe(6.4);
    expect(loaded.farm!.equipment.tractor.y).toBe(9.6);
  });

  it('fills safe defaults for an incomplete current-version farm save', () => {
    const state = makeFarm();
    const raw = JSON.parse(serialize(state, NOW)) as Record<string, unknown>;
    raw.farm = { cashCents: 123_456 };
    const loaded = deserialize(JSON.stringify(raw), NOW);
    expect(loaded.farm!.cashCents).toBe(123_456);
    expect(loaded.farm!.seeds.crop_corn).toBeGreaterThanOrEqual(0);
    expect(loaded.farm!.storageCapacity).toBeGreaterThan(0);
    expect(loaded.farm!.market.quotes.crop_potato.currentCents).toBeGreaterThan(0);
  });
});
