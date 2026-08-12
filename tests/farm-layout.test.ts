import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { NEIGHBOR_FIELD_TILES, STARTER_FIELD_TILES } from '../src/core/farmBusiness';
import { pickupAtCargoPad, PICKUP_CARGO_PAD, PICKUP_CARGO_PAD_TOLERANCE } from '../src/core/farmPickupData';
import { FARM_TOWN_GATE } from '../src/core/townGateway';
import { farmParcelSectionCount } from '../src/core/farmParcels';
import { deserialize } from '../src/save/save';
import {
  FARM_PLOT_SPAN, farmDriveLane, farmhouseInteractionRadius, farmhousePresentationTier, farmLogicalPoint, farmMainlandBounds, farmPlotAtWorldPoint, farmPlotFootprint, farmScreenHeadingAngle, farmUprightPose, farmWorldPoint, farmLandmarks,
} from '../src/render/farmLayout';
import { farmGroundVariant, farmTerrainBounds, intersectsFarmTerrain } from '../src/render/farmTerrain';
import { NOW } from './helpers';

describe('Farm Empire presentation layout', () => {
  it('derives the visual farmhouse tier and matching hit radius from parcel ownership', () => {
    expect(farmhousePresentationTier(false)).toBe('starter');
    expect(farmhousePresentationTier(true)).toBe('expanded');
    expect(farmhouseInteractionRadius('starter')).toBe(1.3);
    expect(farmhouseInteractionRadius('expanded')).toBeGreaterThan(farmhouseInteractionRadius('starter'));
  });

  it('keeps the pickup cargo pad deterministic with a strict boundary', () => {
    const pad = farmLandmarks().cargoPad;
    expect(pickupAtCargoPad(pad)).toBe(true);
    expect(pickupAtCargoPad({ x: pad.x + .79, y: pad.y })).toBe(true);
    expect(pickupAtCargoPad({ x: pad.x + .81, y: pad.y })).toBe(false);
  });

  it('keeps the pad and nearest rounded drive target outside fields and gate conflict', () => {
    const pad = PICKUP_CARGO_PAD;
    const fields = [...STARTER_FIELD_TILES, ...NEIGHBOR_FIELD_TILES].map((point) => ({ ...point, uid: -1, crop: null }));
    expect(farmPlotAtWorldPoint(fields, farmWorldPoint(pad))).toBeUndefined();
    expect(pickupAtCargoPad({ x: Math.round(pad.x), y: Math.round(pad.y) }, PICKUP_CARGO_PAD_TOLERANCE)).toBe(true);
    expect(Math.hypot(pad.x - FARM_TOWN_GATE.x, pad.y - FARM_TOWN_GATE.y)).toBeGreaterThan(.9);
    expect(Math.hypot(pad.x - 8, pad.y - 5)).toBeGreaterThan(.8);
    const worldFields = fields.map((point) => farmPlotFootprint(point));
    const lane = farmDriveLane();
    for (let i = 0; i < lane.length - 1; i += 1) for (let step = 0; step <= 20; step += 1) {
      const ratio = step / 20;
      const point = { x: lane[i].x + (lane[i + 1].x - lane[i].x) * ratio, y: lane[i].y + (lane[i + 1].y - lane[i].y) * ratio };
      expect(worldFields.some((field) => point.x >= field.minX && point.x <= field.maxX && point.y >= field.minY && point.y <= field.maxY)).toBe(false);
    }
  });
  it('round trips logical and fractional actor coordinates through its single projection', () => {
    for (const point of [{ x: 5, y: 7 }, { x: 8.5, y: 10.25 }, { x: 12.75, y: 6.125 }]) {
      expect(farmLogicalPoint(farmWorldPoint(point))).toEqual(point);
    }
    expect(FARM_PLOT_SPAN).toBeGreaterThanOrEqual(2.5);
  });

  it('maps all four logical tractor directions through the isometric screen basis', () => {
    expect(farmScreenHeadingAngle({ x: 1, y: 0 })).toBeCloseTo(Math.atan2(.5, 1));
    expect(farmScreenHeadingAngle({ x: 0, y: 1 })).toBeCloseTo(Math.atan2(.5, -1));
    expect(farmScreenHeadingAngle({ x: -1, y: 0 })).toBeCloseTo(Math.atan2(-.5, -1));
    expect(farmScreenHeadingAngle({ x: 0, y: -1 })).toBeCloseTo(Math.atan2(-.5, 1));
  });

  it('keeps tractor side-view poses upright for cardinals, diagonals, and near-vertical travel', () => {
    const limit = Math.PI / 6;
    expect(farmUprightPose({ x: 1, y: 0 })).toEqual({ mirrored: false, slope: expect.any(Number) });
    expect(farmUprightPose({ x: 0, y: 1 }).mirrored).toBe(true);
    expect(farmUprightPose({ x: -1, y: 0 }).mirrored).toBe(true);
    expect(farmUprightPose({ x: 0, y: -1 }).mirrored).toBe(false);
    for (const heading of [{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: 1.00001 }, { x: 1.00001, y: 1 }]) {
      expect(Math.abs(farmUprightPose(heading).slope)).toBeLessThanOrEqual(limit);
    }
    expect(farmUprightPose({ x: 1, y: 1 }).slope).toBeGreaterThan(0);
    expect(farmUprightPose({ x: -1, y: -1 }).slope).toBeLessThan(0);
  });

  it('maps all four large-section footprint corners back to one logical plot and rejects its gaps', () => {
    const state = createFarmGame('Layout', 99, NOW);
    const plot = state.plots[0]; const bounds = farmPlotFootprint(plot);
    for (const point of [
      { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
    ]) expect(farmPlotAtWorldPoint(state.plots, point)?.uid).toBe(plot.uid);
    expect(farmPlotAtWorldPoint(state.plots, { x: bounds.maxX + 0.01, y: (bounds.minY + bounds.maxY) / 2 })).toBeUndefined();
    expect(farmPlotAtWorldPoint(state.plots, { x: bounds.minX - 0.01, y: (bounds.minY + bounds.maxY) / 2 })).toBeUndefined();
  });

  it('keeps the 36 starter sections distinct with yard and neighbor separation', () => {
    const state = createFarmGame('Layout', 99, NOW);
    const starter = state.plots.map(farmPlotFootprint);
    expect(state.plots).toHaveLength(farmParcelSectionCount('starter'));
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
  it('preserves original coordinates, crops, placements, actors and business state while expanding owned acreage', () => {
    const raw = createFarmGame('Old Save', 42, NOW) as unknown as Record<string, unknown>;
    const state = raw as unknown as ReturnType<typeof createFarmGame>;
    state.plots[0].crop = { defId: 'crop_corn', plantedAt: NOW - 1000, wateredBonusMs: 20, lastWateredAt: NOW - 500 };
    state.player.px = 8.375; state.player.py = 10.625;
    state.farm!.equipment.tractor.x = 9.125; state.farm!.equipment.tractor.y = 11.75;
    state.farm!.storage.crop_corn = 19; state.farm!.market.quotes.crop_corn.currentCents = 321; state.farm!.parcels.northOwned = true;
    const literalV4 = JSON.stringify({ ...raw, version: 4 });
    const loaded = deserialize(literalV4, NOW + 20_000);
    const originalPlots = state.plots.map((plot) => ({ uid: plot.uid, x: plot.x, y: plot.y, crop: plot.crop?.defId }));
    expect(loaded.plots.slice(0, originalPlots.length).map((plot) => ({ uid: plot.uid, x: plot.x, y: plot.y, crop: plot.crop?.defId }))).toEqual(originalPlots);
    expect(loaded.plots).toHaveLength(farmParcelSectionCount('starter') + farmParcelSectionCount('north'));
    expect(loaded.placements).toEqual(state.placements);
    expect(loaded.player.px).toBe(8.375); expect(loaded.player.py).toBe(10.625);
    expect(loaded.farm!.equipment.tractor.x).toBe(9.125); expect(loaded.farm!.equipment.tractor.y).toBe(11.75);
    expect(loaded.farm!.storage.crop_corn).toBe(19); expect(loaded.farm!.market.quotes.crop_corn.currentCents).toBe(321); expect(loaded.farm!.parcels.northOwned).toBe(true);
  });
});
