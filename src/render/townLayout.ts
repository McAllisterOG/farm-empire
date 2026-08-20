import {
  TOWN_BUILDINGS, TOWN_NPCS, type TownBuildingDef, type TownNpcDef, type TownPoint, type TownServiceId,
} from '../data/town.data';

export interface TownBounds { minX: number; minY: number; maxX: number; maxY: number }

export const TOWN_BOUNDS: Readonly<TownBounds> = Object.freeze({ minX: 2, minY: 2, maxX: 30, maxY: 20 });
export const TOWN_CAMERA = Object.freeze({ x: 15.5, y: 10.5, zoom: 0.88 });
export const TOWN_SPAWN = Object.freeze({ x: 15.3, y: 13.7 });
export const TOWN_EXIT = Object.freeze({ x: 16, y: 14.5 });
export const TOWN_PICKUP_PARKING = Object.freeze({ x: 8.5, y: 13.6 });
export const TOWN_INTERACTION_PRIORITY = ['npc', 'building', 'exit', 'ground'] as const;

/** A single convex public surface, separated from every declared building footprint. */
export const TOWN_WALK_POLYGON: readonly TownPoint[] = [
  { x: 4.4, y: 6.0 },
  { x: 27.9, y: 7.8 },
  { x: 26.5, y: 17.2 },
  { x: 6.5, y: 17.2 },
] as const;

export type TownInteraction =
  | { kind: 'npc'; npc: TownNpcDef; service: TownServiceId }
  | { kind: 'building'; building: TownBuildingDef; service: TownServiceId }
  | { kind: 'exit' }
  | { kind: 'ground'; point: TownPoint }
  | { kind: 'none' };

export interface TownMoveTarget extends TownPoint { cb: (() => void) | null }

export interface TownMovementCancellation {
  cancelled: boolean;
  target: null;
  walking: false;
}

export interface TownScreenPoint { x: number; y: number }

/**
 * Town characters are much taller than their logical ground anchors. Keep the
 * whole visible sprite clickable so selecting a face or torso cannot turn into
 * an unrelated ground-walk command.
 */
export function pointInTownNpcScreenHitbox(
  point: TownScreenPoint,
  feet: TownScreenPoint,
  zoom: number,
): boolean {
  const scale = Math.max(.5, zoom);
  return Math.abs(point.x - feet.x) <= 34 * scale
    && point.y >= feet.y - 108 * scale
    && point.y <= feet.y + 12 * scale;
}

/** The parked pickup receives the same visible-silhouette treatment in town. */
export function pointInTownPickupScreenHitbox(
  point: TownScreenPoint,
  anchor: TownScreenPoint,
  zoom: number,
): boolean {
  const scale = Math.max(.5, zoom);
  return Math.abs(point.x - anchor.x) <= 70 * scale
    && point.y >= anchor.y - 52 * scale
    && point.y <= anchor.y + 20 * scale;
}

export function pointInTownBounds(point: TownPoint): boolean {
  return point.x >= TOWN_BOUNDS.minX && point.x <= TOWN_BOUNDS.maxX
    && point.y >= TOWN_BOUNDS.minY && point.y <= TOWN_BOUNDS.maxY;
}

export function townPickupHit(point: TownPoint, pickupPresent: boolean): boolean {
  return pickupPresent && Math.hypot(point.x - TOWN_PICKUP_PARKING.x, point.y - TOWN_PICKUP_PARKING.y) <= 1.15;
}

/** Inclusive convex-polygon test; points on the paved edge remain walkable. */
export function pointInTownWalkSurface(point: TownPoint): boolean {
  let sign = 0;
  for (let index = 0; index < TOWN_WALK_POLYGON.length; index++) {
    const a = TOWN_WALK_POLYGON[index];
    const b = TOWN_WALK_POLYGON[(index + 1) % TOWN_WALK_POLYGON.length];
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
    if (Math.abs(cross) <= 0.000001) continue;
    const nextSign = Math.sign(cross);
    if (sign && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

export function pointInTownBuilding(point: TownPoint, building: TownBuildingDef): boolean {
  return point.x >= building.x && point.x <= building.x + building.w
    && point.y >= building.y && point.y <= building.y + building.h;
}

export function townBuildingsOverlap(a: TownBuildingDef, b: TownBuildingDef): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True only when the open segment enters a building footprint; touching its edge is safe. */
export function townSegmentCrossesBuilding(start: TownPoint, end: TownPoint, building: TownBuildingDef): boolean {
  const epsilon = 0.000001;
  const minX = building.x + epsilon; const maxX = building.x + building.w - epsilon;
  const minY = building.y + epsilon; const maxY = building.y + building.h - epsilon;
  const dx = end.x - start.x; const dy = end.y - start.y;
  let near = 0; let far = 1;
  for (const [origin, delta, min, max] of [[start.x, dx, minX, maxX], [start.y, dy, minY, maxY]] as const) {
    if (Math.abs(delta) <= epsilon) {
      if (origin <= min || origin >= max) return false;
      continue;
    }
    const first = (min - origin) / delta; const second = (max - origin) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return false;
  }
  return far >= 0 && near <= 1 && far >= near;
}

/** Replacing the old target with this result guarantees its delayed callback is discarded. */
export function cancelTownMovement(target: TownMoveTarget | null): TownMovementCancellation {
  return { cancelled: target !== null, target: null, walking: false };
}

/** Deterministic click priority: NPC, storefront, exit, then paved ground. */
export function townInteractionAt(point: TownPoint): TownInteraction {
  const npc = TOWN_NPCS.find((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) <= 0.75);
  if (npc) return { kind: 'npc', npc, service: npc.service };
  const building = TOWN_BUILDINGS.find((candidate) => (
    pointInTownBuilding(point, candidate)
    || Math.hypot(point.x - candidate.door.x, point.y - candidate.door.y) <= 0.7
  ));
  if (building) return { kind: 'building', building, service: building.service };
  if (Math.hypot(point.x - TOWN_EXIT.x, point.y - TOWN_EXIT.y) <= 0.9) return { kind: 'exit' };
  if (pointInTownWalkSurface(point)) return { kind: 'ground', point };
  return { kind: 'none' };
}
