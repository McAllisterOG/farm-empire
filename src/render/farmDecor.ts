/**
 * Deterministic, presentation-only dressing for the enlarged Farm Empire
 * mainland. Coordinates are logical farm anchors projected only at render time,
 * never saved state.
 */
import { NEIGHBOR_FIELD_TILES, STARTER_FIELD_TILES } from '../core/farmBusiness';
import { farmLandmarks, farmMainlandBounds, farmPlotFootprint, farmWorldPoint, type FarmBounds, type FarmPoint } from './farmLayout';

export type FarmDecorType = 'hay-bale' | 'crate-pallet' | 'water-trough' | 'hand-pump';

export interface FarmDecor {
  id: string;
  type: FarmDecorType;
  x: number;
  y: number;
}

export interface FarmFenceCue {
  /** Presentation-world placement: fence cues follow the mainland boundary. */
  id: string;
  x: number;
  y: number;
  direction: 'east-west' | 'north-south';
  gate?: boolean;
}

/** Small, deliberately finite prop cluster: decoration rather than a new system. */
export const FARM_DECOR_MANIFEST: readonly FarmDecor[] = [
  { id: 'hay-west', type: 'hay-bale', x: 10.15, y: 4.45 },
  { id: 'hay-east', type: 'hay-bale', x: 10.55, y: 4.45 },
  { id: 'hay-yard', type: 'hay-bale', x: 10.65, y: 4.8 },
  { id: 'crate-pallet', type: 'crate-pallet', x: 9.75, y: 4.95 },
  { id: 'water-trough', type: 'water-trough', x: 7.05, y: 11.45 },
  { id: 'hand-pump', type: 'hand-pump', x: 6.65, y: 10.75 },
] as const;

/** Open gaps deliberately leave the barnyard and parcel approaches passable-looking. */
export const FARM_FENCE_MANIFEST: readonly FarmFenceCue[] = [
  { id: 'northwest-line', x: 8.4, y: 4.0, direction: 'east-west' },
  { id: 'northwest-corner', x: 3.9, y: 8.2, direction: 'north-south' },
  { id: 'southwest-line', x: 8.7, y: 36.9, direction: 'east-west' },
  { id: 'southwest-corner', x: 3.9, y: 31.7, direction: 'north-south' },
  { id: 'northeast-line', x: 36.7, y: 4.0, direction: 'east-west' },
  { id: 'northeast-corner', x: 41.0, y: 8.5, direction: 'north-south' },
  { id: 'southeast-line', x: 36.7, y: 36.9, direction: 'east-west' },
  { id: 'southeast-corner', x: 41.0, y: 31.2, direction: 'north-south' },
  { id: 'parcel-gate', x: 22.0, y: 22.35, direction: 'east-west', gate: true },
  { id: 'yard-gate', x: 20.6, y: 16.4, direction: 'north-south', gate: true },
] as const;

/** Fixed windbreak anchors, kept outside the working fields. */
export function farmWindbreakAnchors(): readonly FarmPoint[] {
  const bounds = farmMainlandBounds();
  const points: FarmPoint[] = [];
  for (let x = bounds.minX + 1; x < bounds.maxX; x += 2) {
    points.push({ x, y: bounds.minY + 1 }, { x, y: bounds.maxY - 1 });
  }
  for (let y = bounds.minY + 3; y < bounds.maxY - 2; y += 3) {
    points.push({ x: bounds.minX + 1, y }, { x: bounds.maxX - 1, y });
  }
  return points;
}

export function farmDecorManifest(): readonly FarmDecor[] {
  return FARM_DECOR_MANIFEST;
}

export function farmDecorTypes(): readonly FarmDecorType[] {
  return ['hay-bale', 'crate-pallet', 'water-trough', 'hand-pump'];
}

export function farmDecorIsSafe(point: FarmPoint): boolean {
  const projected = farmWorldPoint(point);
  const bounds = farmMainlandBounds();
  if (projected.x < bounds.minX || projected.x > bounds.maxX || projected.y < bounds.minY || projected.y > bounds.maxY) return false;
  const fieldTiles = [...STARTER_FIELD_TILES, ...NEIGHBOR_FIELD_TILES];
  if (fieldTiles.some((tile) => pointInBounds(projected, farmPlotFootprint(tile)))) return false;
  const landmarks = farmLandmarks();
  const blocked = [farmWorldPoint({ x: 8, y: 5 }), farmWorldPoint({ x: 9, y: 11 }), farmWorldPoint(landmarks.doghouse), farmWorldPoint(landmarks.scoutHome)];
  if (blocked.some((anchor) => Math.hypot(projected.x - anchor.x, projected.y - anchor.y) < 2.25)) return false;
  // The middle of the deliberately broad gravel route stays clear.
  const lane = [{ x: 6.91, y: 5.09 }, { x: 8.36, y: 5.09 }, { x: 9.45, y: 6.18 }, { x: 10.55, y: 7.27 }, { x: 11.64, y: 8.36 }];
  return !lane.slice(1).some((end, index) => distanceToSegment(point, lane[index], end) < .35);
}

function pointInBounds(point: FarmPoint, bounds: FarmBounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function distanceToSegment(point: FarmPoint, start: FarmPoint, end: FarmPoint): number {
  const dx = end.x - start.x; const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  const ratio = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}
