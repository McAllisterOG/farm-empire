import { describe, expect, it } from 'vitest';
import { farmOf } from '../src/core/farmBusiness';
import {
  farmParcelAtTile, farmParcelDef, farmParcelSectionCount, farmParcelTiles,
} from '../src/core/farmParcels';
import { PICKUP_CARGO_PAD } from '../src/core/farmPickupData';
import { createFarmGame } from '../src/core/state';
import {
  FARM_TOWN_GATE, FARM_TOWN_RETURN, LEGACY_FARM_TOWN_GATE, LEGACY_FARM_TOWN_RETURN,
  FARM_TOWN_ROAD_WAYPOINTS,
} from '../src/core/townGateway';
import type { FarmPlot } from '../src/core/types';
import { farmPlotFootprint, farmWorldPoint } from '../src/render/farmLayout';
import { deserialize } from '../src/save/save';
import { NOW } from './helpers';

function oldParcelPlots(): FarmPlot[] {
  return Array.from({ length: 18 }, (_, index) => ({
    uid: index + 1,
    x: index < 9 ? 5 + index % 3 : 10 + (index - 9) % 3,
    y: 7 + Math.floor((index % 9) / 3),
    crop: index === 0 ? { defId: 'crop_corn', plantedAt: NOW - 1_000, wateredBonusMs: 0, lastWateredAt: 0 } : null,
  }));
}

describe('Acreage & Field Geometry V2', () => {
  it('defines a four-times starter grid and a 2.67-times neighboring acreage', () => {
    const starter = farmParcelDef('starter'); const north = farmParcelDef('north');
    expect([starter.columns, starter.rows, farmParcelSectionCount('starter')]).toEqual([6, 6, 36]);
    expect([north.columns, north.rows, farmParcelSectionCount('north')]).toEqual([8, 12, 96]);
    expect(farmParcelSectionCount('north') / farmParcelSectionCount('starter')).toBeCloseTo(8 / 3);
    expect(new Set([...farmParcelTiles('starter'), ...farmParcelTiles('north')].map((tile) => `${tile.x}:${tile.y}`)).size).toBe(132);
  });

  it('migrates a literal v8 nine-section farm without losing crop identity or legacy anchors', () => {
    const state = createFarmGame('Legacy Acreage', 17, NOW);
    state.version = 8;
    state.plots = oldParcelPlots().slice(0, 9);
    state.player.px = LEGACY_FARM_TOWN_RETURN.x; state.player.py = LEGACY_FARM_TOWN_RETURN.y;
    farmOf(state).pickup.x = LEGACY_FARM_TOWN_GATE.x; farmOf(state).pickup.y = LEGACY_FARM_TOWN_GATE.y;
    farmOf(state).pickup.cargo.crops.crop_corn = 4;
    const loaded = deserialize(JSON.stringify(state), NOW + 5_000);
    expect(loaded.version).toBe(11);
    expect(loaded.plots).toHaveLength(36);
    expect(loaded.plots.find((plot) => plot.uid === 1)?.crop?.defId).toBe('crop_corn');
    expect(new Set(loaded.plots.map((plot) => plot.uid)).size).toBe(loaded.plots.length);
    expect({ x: loaded.player.px, y: loaded.player.py }).toEqual(FARM_TOWN_RETURN);
    expect({ x: farmOf(loaded).pickup.x, y: farmOf(loaded).pickup.y }).toEqual(PICKUP_CARGO_PAD);
    expect(farmOf(loaded).pickup.cargo.crops.crop_corn).toBe(4);
  });

  it('expands a legacy owned neighbor to all 132 sections idempotently', () => {
    const state = createFarmGame('Owned Legacy Acreage', 18, NOW);
    state.version = 8; state.plots = oldParcelPlots(); farmOf(state).parcels.northOwned = true;
    const first = deserialize(JSON.stringify(state), NOW + 5_000);
    expect(first.plots).toHaveLength(132);
    const second = deserialize(JSON.stringify(first), NOW + 10_000);
    expect(second.plots).toHaveLength(132);
    expect(second.plots.find((plot) => plot.uid === 1)?.crop?.defId).toBe('crop_corn');
  });

  it('preserves ordinary v9 actor and pickup positions, including owned field soil', () => {
    const state = createFarmGame('Position Persistence', 19, NOW);
    state.player.px = LEGACY_FARM_TOWN_RETURN.x; state.player.py = LEGACY_FARM_TOWN_RETURN.y;
    farmOf(state).pickup.x = 4; farmOf(state).pickup.y = 8;
    const loaded = deserialize(JSON.stringify(state), NOW + 1_000);
    expect({ x: loaded.player.px, y: loaded.player.py }).toEqual(LEGACY_FARM_TOWN_RETURN);
    expect({ x: farmOf(loaded).pickup.x, y: farmOf(loaded).pickup.y }).toEqual({ x: 4, y: 8 });
  });

  it('allocates finite unique section UIDs when a legacy counter is corrupt', () => {
    const state = createFarmGame('Corrupt Counter', 20, NOW);
    state.version = 8; state.plots = oldParcelPlots().slice(0, 9);
    (state as unknown as { uidCounter: unknown }).uidCounter = Number.NaN;
    const loaded = deserialize(JSON.stringify(state), NOW + 1_000);
    expect(loaded.plots).toHaveLength(36);
    expect(loaded.plots.every((plot) => Number.isInteger(plot.uid) && plot.uid > 0)).toBe(true);
    expect(new Set(loaded.plots.map((plot) => plot.uid)).size).toBe(36);
  });

  it('keeps the cargo road and gateway outside both field footprints', () => {
    const plots = [...farmParcelTiles('starter'), ...farmParcelTiles('north')];
    const footprints = plots.map(farmPlotFootprint);
    const road = [PICKUP_CARGO_PAD, ...FARM_TOWN_ROAD_WAYPOINTS];
    for (let index = 0; index < road.length - 1; index += 1) for (let step = 0; step <= 40; step += 1) {
      const ratio = step / 40;
      const logical = {
        x: road[index].x + (road[index + 1].x - road[index].x) * ratio,
        y: road[index].y + (road[index + 1].y - road[index].y) * ratio,
      };
      const point = farmWorldPoint(logical);
      expect(footprints.some((field) => point.x >= field.minX && point.x <= field.maxX && point.y >= field.minY && point.y <= field.maxY)).toBe(false);
    }
    expect(farmParcelAtTile(Math.round(FARM_TOWN_GATE.x), Math.round(FARM_TOWN_GATE.y))).toBeNull();
    expect(farmParcelAtTile(Math.round(FARM_TOWN_RETURN.x), Math.round(FARM_TOWN_RETURN.y))).toBeNull();
  });
});
