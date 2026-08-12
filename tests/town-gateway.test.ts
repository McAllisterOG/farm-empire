import { describe, expect, it, vi } from 'vitest';
import { NEIGHBOR_FIELD_TILES, STARTER_FIELD_TILES } from '../src/core/farmBusiness';
import {
  FARM_TOWN_GATE, FARM_TOWN_RETURN, placePlayerAtTownReturn, townTravelBlockReason,
} from '../src/core/townGateway';
import { createFarmGame } from '../src/core/state';
import { TOWN_BUILDINGS, TOWN_NPCS, TOWN_SERVICE_IDS } from '../src/data/town.data';
import { serialize } from '../src/save/save';
import {
  farmLandmarks, farmMainlandBounds, farmPlotAtWorldPoint, farmWorldPoint, pointInFarmBounds,
} from '../src/render/farmLayout';
import {
  TOWN_BOUNDS, TOWN_EXIT, TOWN_INTERACTION_PRIORITY, TOWN_SPAWN, TOWN_WALK_POLYGON,
  cancelTownMovement, pointInTownBounds, pointInTownWalkSurface, townBuildingsOverlap,
  townInteractionAt, townSegmentCrossesBuilding,
} from '../src/render/townLayout';
import { farmNightAlpha } from '../src/render/lighting';
import { Renderer } from '../src/render/renderer';
import { equipmentPanelAllowsOperation } from '../src/ui/panels/farmPanels';
import { NOW } from './helpers';

describe('Town Gateway layout and real services', () => {
  it('contains exactly three non-overlapping buildings and three distinct service NPCs', () => {
    expect(TOWN_BUILDINGS).toHaveLength(3);
    expect(TOWN_NPCS).toHaveLength(3);
    expect(new Set(TOWN_BUILDINGS.map((building) => building.id)).size).toBe(3);
    expect(new Set(TOWN_NPCS.map((npc) => npc.id)).size).toBe(3);
    expect(new Set(TOWN_BUILDINGS.map((building) => building.service))).toEqual(new Set(TOWN_SERVICE_IDS));
    expect(new Set(TOWN_NPCS.map((npc) => npc.service))).toEqual(new Set(TOWN_SERVICE_IDS));
    for (let left = 0; left < TOWN_BUILDINGS.length; left++) for (let right = left + 1; right < TOWN_BUILDINGS.length; right++) {
      expect(townBuildingsOverlap(TOWN_BUILDINGS[left], TOWN_BUILDINGS[right])).toBe(false);
    }
  });

  it('keeps every approach, NPC, spawn, and exit in bounds on one walkable surface', () => {
    expect(TOWN_BOUNDS).toEqual({ minX: 2, minY: 2, maxX: 24, maxY: 18 });
    for (const point of [
      ...TOWN_BUILDINGS.map((building) => building.door),
      ...TOWN_NPCS,
      TOWN_SPAWN,
      TOWN_EXIT,
    ]) {
      expect(pointInTownBounds(point)).toBe(true);
      expect(pointInTownWalkSurface(point), `${point.x},${point.y}`).toBe(true);
    }
    const turns = TOWN_WALK_POLYGON.map((point, index) => {
      const next = TOWN_WALK_POLYGON[(index + 1) % TOWN_WALK_POLYGON.length];
      const after = TOWN_WALK_POLYGON[(index + 2) % TOWN_WALK_POLYGON.length];
      return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
    });
    expect(turns.every((turn) => turn > 0) || turns.every((turn) => turn < 0)).toBe(true);
    const publicPoints = [
      ...TOWN_WALK_POLYGON,
      ...TOWN_NPCS,
      ...TOWN_BUILDINGS.map((building) => building.door),
      TOWN_SPAWN,
      TOWN_EXIT,
    ];
    for (const start of publicPoints) for (const end of publicPoints) for (const building of TOWN_BUILDINGS) {
      const description = `${building.id}: ${start.x},${start.y} -> ${end.x},${end.y}`;
      expect(townSegmentCrossesBuilding(start, end, building), description).toBe(false);
    }
    const control = TOWN_BUILDINGS[0];
    const centerX = control.x + control.w / 2;
    expect(townSegmentCrossesBuilding(
      { x: centerX, y: control.y - 1 },
      { x: centerX, y: control.y + control.h + 1 },
      control,
    )).toBe(true);
  });

  it('uses the required deterministic NPC, building, exit, then ground priority', () => {
    expect(TOWN_INTERACTION_PRIORITY).toEqual(['npc', 'building', 'exit', 'ground']);
    for (const npc of TOWN_NPCS) expect(townInteractionAt(npc)).toMatchObject({ kind: 'npc', service: npc.service });
    for (const building of TOWN_BUILDINGS) {
      expect(townInteractionAt({ x: building.x + .2, y: building.y + .2 })).toMatchObject({ kind: 'building', service: building.service });
      expect(townInteractionAt(building.door)).toMatchObject({ kind: 'building', service: building.service });
    }
    expect(townInteractionAt(TOWN_EXIT)).toEqual({ kind: 'exit' });
    expect(townInteractionAt({ x: 11, y: 12 })).toMatchObject({ kind: 'ground' });
    expect(townInteractionAt({ x: 2.1, y: 17.8 })).toEqual({ kind: 'none' });
  });

  it('ties town day and night to the same saved farm-clock curve', () => {
    expect(farmNightAlpha(10 * 60)).toBe(0);
    expect(farmNightAlpha(22 * 60)).toBe(.42);
    expect(farmNightAlpha(18 * 60)).toBeGreaterThan(0);
  });
});

describe('Town Gateway travel and save boundary', () => {
  it('keeps the farm gateway and reload anchor clear of fields and landmarks', () => {
    const fieldTiles = [...STARTER_FIELD_TILES, ...NEIGHBOR_FIELD_TILES].map((point) => ({ ...point, uid: -1, crop: null }));
    for (const logical of [FARM_TOWN_GATE, FARM_TOWN_RETURN]) {
      const world = farmWorldPoint(logical);
      expect(pointInFarmBounds(world, farmMainlandBounds())).toBe(true);
      expect(farmPlotAtWorldPoint(fieldTiles, world)).toBeUndefined();
      expect(Math.hypot(logical.x - 8, logical.y - 5)).toBeGreaterThan(2);
      expect(Math.hypot(logical.x - 9, logical.y - 11)).toBeGreaterThan(2);
      expect(Math.hypot(logical.x - farmLandmarks().doghouse.x, logical.y - farmLandmarks().doghouse.y)).toBeGreaterThan(2);
    }
  });

  it('blocks mounted, moving, and job-active travel but accepts a parked on-foot player', () => {
    expect(townTravelBlockReason({ operatingTractor: false, tractorMoving: false, tractorJobActive: false })).toBeNull();
    expect(townTravelBlockReason({ operatingTractor: true, tractorMoving: false, tractorJobActive: false })).toContain('Exit');
    expect(townTravelBlockReason({ operatingTractor: true, tractorMoving: true, tractorJobActive: false })).toContain('Park');
    expect(townTravelBlockReason({ operatingTractor: true, tractorMoving: true, tractorJobActive: true })).toContain('field job');
  });

  it('places town saves at one deterministic farm anchor without adding town state', () => {
    const state = createFarmGame('Save Check', 12, NOW);
    expect(placePlayerAtTownReturn(state)).toEqual(FARM_TOWN_RETURN);
    expect(placePlayerAtTownReturn(state)).toEqual(FARM_TOWN_RETURN);
    const saved = JSON.parse(serialize(state, NOW + 1000)) as Record<string, unknown>;
    const player = saved.player as Record<string, unknown>;
    expect(player.px).toBe(FARM_TOWN_RETURN.x);
    expect(player.py).toBe(FARM_TOWN_RETURN.y);
    expect(saved).not.toHaveProperty('town');
    expect(saved.farm).not.toHaveProperty('town');
    expect(saved.version).toBe(9);
  });

  it('makes the town Equipment Desk incapable of operating the tractor', () => {
    expect(equipmentPanelAllowsOperation({ context: 'town', onClose: () => {} })).toBe(false);
    expect(equipmentPanelAllowsOperation({
      context: 'farm', operating: false, jobActive: false, onToggleOperating: () => {}, onClose: () => {},
    })).toBe(true);
  });

  it('discards a delayed town callback when movement is cancelled', () => {
    const delayedService = vi.fn();
    const cancelled = cancelTownMovement({ x: 8, y: 9, cb: delayedService });
    expect(cancelled).toEqual({ cancelled: true, target: null, walking: false });
    expect(delayedService).not.toHaveBeenCalled();
    expect(cancelTownMovement(null)).toEqual({ cancelled: false, target: null, walking: false });
  });

  it('resizes backing pixels and viewport without changing farm or town camera framing', () => {
    const viewport = { width: 900, height: 600 };
    vi.stubGlobal('window', { devicePixelRatio: 2, innerWidth: 900, innerHeight: 600 });
    const canvas = {
      get clientWidth() { return viewport.width; },
      get clientHeight() { return viewport.height; },
      width: 0,
      height: 0,
      getContext: () => ({}),
    } as unknown as HTMLCanvasElement;
    try {
      const renderer = new Renderer(canvas);
      renderer.centerOnFarm();
      renderer.camera.zoom = .76;
      const farmFraming = { cx: renderer.camera.cx, cy: renderer.camera.cy, zoom: renderer.camera.zoom };
      viewport.width = 1100; viewport.height = 680;
      renderer.resize();
      expect({ cx: renderer.camera.cx, cy: renderer.camera.cy, zoom: renderer.camera.zoom }).toEqual(farmFraming);

      renderer.centerOnTown();
      renderer.camera.zoom = .88;
      const townFraming = { cx: renderer.camera.cx, cy: renderer.camera.cy, zoom: renderer.camera.zoom };
      viewport.width = 1280; viewport.height = 720;
      renderer.resize();
      expect({ width: canvas.width, height: canvas.height }).toEqual({ width: 2560, height: 1440 });
      expect({ viewW: renderer.camera.viewW, viewH: renderer.camera.viewH }).toEqual({ viewW: 1280, viewH: 720 });
      expect({ cx: renderer.camera.cx, cy: renderer.camera.cy, zoom: renderer.camera.zoom }).toEqual(townFraming);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
