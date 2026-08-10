import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { NEIGHBOR_FIELD_TILES } from '../src/core/farmBusiness';
import { deserialize } from '../src/save/save';
import {
  FARM_PLOT_SPAN, farmLogicalPoint, farmMainlandBounds, farmPlotAtWorldPoint, farmPlotFootprint, farmWorldPoint,
} from '../src/render/farmLayout';
import { farmGroundVariant, farmTerrainBounds, intersectsFarmTerrain } from '../src/render/farmTerrain';
import { NOW } from './helpers';

describe('Farm Empire presentation layout', () => {
  it('round trips logical and fractional actor coordinates through its single projection', () => {
    for (const point of [{ x: 5, y: 7 }, { x: 8.5, y: 10.25 }, { x: 12.75, y: 6.125 }]) {
      expect(farmLogicalPoint(farmWorldPoint(point))).toEqual(point);
    }
    expect(FARM_PLOT_SPAN).toBeGreaterThanOrEqual(2.5);
  });

  it('maps every edge of a large plot footprint back to its one logical plot', () => {
    const state = createFarmGame('Layout', 99, NOW);
    const plot = state.plots[0]; const bounds = farmPlotFootprint(plot);
    for (const point of [
      { x: bounds.minX, y: (bounds.minY + bounds.maxY) / 2 }, { x: bounds.maxX, y: (bounds.minY + bounds.maxY) / 2 },
      { x: (bounds.minX + bounds.maxX) / 2, y: bounds.minY }, { x: (bounds.minX + bounds.maxX) / 2, y: bounds.maxY },
    ]) expect(farmPlotAtWorldPoint(state.plots, point)?.uid).toBe(plot.uid);
  });

  it('keeps the nine starter sections distinct with yard and neighbor separation', () => {
    const state = createFarmGame('Layout', 99, NOW);
    const starter = state.plots.map(farmPlotFootprint);
    expect(farmPlotAtWorldPoint(state.plots, farmWorldPoint({ x: 8.5, y: 7 }))).toBeUndefined();
    expect(starter[0].maxX).toBeLessThan(starter[1].minX);
    expect(farmPlotAtWorldPoint(NEIGHBOR_FIELD_TILES.map((point) => ({ ...point, uid: -1, crop: null })), farmWorldPoint({ x: 10, y: 7 }))).toBeTruthy();
  });

  it('has deterministic rectangular mainland variation and culling bounds', () => {
    expect(farmGroundVariant(44, 12, 8)).toBe(farmGroundVariant(44, 12, 8));
    expect(farmGroundVariant(45, 12, 8)).not.toBe(farmGroundVariant(44, 12, 8));
    const bounds = farmTerrainBounds();
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
    expect(intersectsFarmTerrain(bounds, farmMainlandBounds())).toBe(true);
    expect(intersectsFarmTerrain(bounds, { minX: 100, minY: 100, maxX: 110, maxY: 110 })).toBe(false);
  });
});

describe('literal v4 Farm Empire save compatibility', () => {
  it('deserializes original coordinates, crops, placements, player, tractor, storage, market and land without layout migration', () => {
    const raw = createFarmGame('Old Save', 42, NOW) as unknown as Record<string, unknown>;
    const state = raw as unknown as ReturnType<typeof createFarmGame>;
    state.plots[0].crop = { defId: 'crop_corn', plantedAt: NOW - 1000, wateredBonusMs: 20, lastWateredAt: NOW - 500 };
    state.player.px = 8.375; state.player.py = 10.625;
    state.farm!.equipment.tractor.x = 9.125; state.farm!.equipment.tractor.y = 11.75;
    state.farm!.storage.crop_corn = 19; state.farm!.market.quotes.crop_corn.currentCents = 321; state.farm!.parcels.northOwned = true;
    const literalV4 = JSON.stringify({ ...raw, version: 4 });
    const loaded = deserialize(literalV4, NOW + 20_000);
    expect(loaded.plots.map((plot) => ({ uid: plot.uid, x: plot.x, y: plot.y, crop: plot.crop?.defId }))).toEqual(state.plots.map((plot) => ({ uid: plot.uid, x: plot.x, y: plot.y, crop: plot.crop?.defId })));
    expect(loaded.placements).toEqual(state.placements);
    expect(loaded.player.px).toBe(8.375); expect(loaded.player.py).toBe(10.625);
    expect(loaded.farm!.equipment.tractor.x).toBe(9.125); expect(loaded.farm!.equipment.tractor.y).toBe(11.75);
    expect(loaded.farm!.storage.crop_corn).toBe(19); expect(loaded.farm!.market.quotes.crop_corn.currentCents).toBe(321); expect(loaded.farm!.parcels.northOwned).toBe(true);
  });
});
