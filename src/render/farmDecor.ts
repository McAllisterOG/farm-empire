/**
 * Deterministic, presentation-only dressing for the enlarged Farm Empire
 * mainland. Coordinates are logical farm anchors projected only at render time,
 * never saved state.
 */
import { NEIGHBOR_FIELD_TILES, STARTER_FIELD_TILES } from '../core/farmBusiness';
import { FARM_PLOT_SPAN, farmDriveLane, farmLandmarks, farmMainlandBounds, farmPlotFootprint, farmWorldPoint, type FarmBounds, type FarmPoint } from './farmLayout';

export type FarmDecorType = 'hay-bale' | 'crate-pallet' | 'water-trough' | 'hand-pump';
export type FarmWorldCueType = 'grass-tuft' | 'stone-cluster' | 'field-marker' | 'utility-pole';

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

/**
 * Finite working-land cues that make the large farm read as maintained acreage
 * at overview scale. They are logical presentation anchors, never terrain,
 * collision, or interaction geometry.
 */
export interface FarmWorldCue {
  id: string;
  type: FarmWorldCueType;
  x: number;
  y: number;
}

/** Small, deliberately finite prop cluster: decoration rather than a new system. */
export const FARM_DECOR_MANIFEST: readonly FarmDecor[] = [
  { id: 'hay-west', type: 'hay-bale', x: 8.75, y: 3.45 },
  { id: 'hay-east', type: 'hay-bale', x: 9.15, y: 3.45 },
  { id: 'hay-yard', type: 'hay-bale', x: 9.25, y: 3.8 },
  { id: 'crate-pallet', type: 'crate-pallet', x: 8.65, y: 4.15 },
  { id: 'water-trough', type: 'water-trough', x: 9.2, y: 8.25 },
  { id: 'hand-pump', type: 'hand-pump', x: 9.2, y: 7.05 },
] as const;

/** Open gaps deliberately leave the barnyard and parcel approaches passable-looking. */
export const FARM_FENCE_MANIFEST: readonly FarmFenceCue[] = [
  { id: 'northwest-line', x: 7.0, y: 2.0, direction: 'east-west' },
  { id: 'northwest-corner', x: 2.0, y: 7.5, direction: 'north-south' },
  { id: 'southwest-line', x: 10.0, y: 44.0, direction: 'east-west' },
  { id: 'southwest-corner', x: 2.0, y: 38.0, direction: 'north-south' },
  { id: 'northeast-line', x: 50.0, y: 2.0, direction: 'east-west' },
  { id: 'northeast-corner', x: 56.0, y: 8.0, direction: 'north-south' },
  { id: 'southeast-line', x: 50.0, y: 44.0, direction: 'east-west' },
  { id: 'southeast-corner', x: 56.0, y: 38.0, direction: 'north-south' },
  { id: 'parcel-gate', x: 24.1, y: 42.6, direction: 'east-west', gate: true },
  { id: 'yard-gate', x: 24.1, y: 17.3, direction: 'north-south', gate: true },
] as const;

/**
 * Keep commercial headlands, road approaches, and open perimeter ground
 * purposeful without placing anything over an operable field or route.
 */
export const FARM_WORLD_CUE_MANIFEST: readonly FarmWorldCue[] = [
  { id: 'north-headland-tuft-a', type: 'grass-tuft', x: 10.05, y: 1.65 },
  { id: 'north-headland-marker-a', type: 'field-marker', x: 12.65, y: 1.7 },
  { id: 'north-headland-tuft-b', type: 'grass-tuft', x: 15.3, y: 1.72 },
  { id: 'commercial-east-stones-a', type: 'stone-cluster', x: 18.15, y: 3.15 },
  { id: 'commercial-east-marker-a', type: 'field-marker', x: 18.2, y: 6.3 },
  { id: 'commercial-east-tuft-a', type: 'grass-tuft', x: 19.35, y: 11.45 },
  { id: 'commercial-south-marker-a', type: 'field-marker', x: 10.1, y: 16.6 },
  { id: 'commercial-south-tuft-a', type: 'grass-tuft', x: 13.1, y: 16.6 },
  { id: 'commercial-south-stones-a', type: 'stone-cluster', x: 16.05, y: 16.6 },
  { id: 'yard-approach-marker-a', type: 'field-marker', x: 6.8, y: 16.15 },
  { id: 'yard-approach-tuft-a', type: 'grass-tuft', x: 6.35, y: 16.5 },
  { id: 'roadside-utility-a', type: 'utility-pole', x: 18.75, y: 13.05 },
  { id: 'gateway-utility-a', type: 'utility-pole', x: 19.55, y: 10.6 },
  { id: 'gateway-stones-a', type: 'stone-cluster', x: 20.15, y: 8.35 },
] as const;

/** Fixed logical anchors fade in only with the farm's saved night clock. */
export const FARM_FIREFLY_ANCHORS: readonly FarmPoint[] = [
  { x: 1.15, y: 5.25 }, { x: 1.5, y: 5.7 }, { x: 8.15, y: 2.15 },
  { x: 8.6, y: 2.45 }, { x: 18.35, y: 6.15 }, { x: 18.75, y: 6.6 },
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

export function farmWorldCueTypes(): readonly FarmWorldCueType[] {
  return ['grass-tuft', 'stone-cluster', 'field-marker', 'utility-pole'];
}

export function farmWorldCueManifest(): readonly FarmWorldCue[] {
  return FARM_WORLD_CUE_MANIFEST;
}

export function farmDecorIsSafe(point: FarmPoint): boolean {
  const projected = farmWorldPoint(point);
  const bounds = farmMainlandBounds();
  if (projected.x < bounds.minX || projected.x > bounds.maxX || projected.y < bounds.minY || projected.y > bounds.maxY) return false;
  const fieldTiles = [...STARTER_FIELD_TILES, ...NEIGHBOR_FIELD_TILES];
  if (fieldTiles.some((tile) => pointInBounds(projected, farmPlotFootprint(tile)))) return false;
  const landmarks = farmLandmarks();
  const blocked = [farmWorldPoint({ x: 8, y: 5 }), farmWorldPoint({ x: 9, y: 11 }), farmWorldPoint({ x: 19.3, y: 9 }), farmWorldPoint(landmarks.farmhouse), farmWorldPoint(landmarks.doghouse), farmWorldPoint(landmarks.scoutHome), farmWorldPoint(landmarks.cargoPad), farmWorldPoint(landmarks.tractorParking)];
  if (blocked.some((anchor) => Math.hypot(projected.x - anchor.x, projected.y - anchor.y) < 2.25)) return false;
  // The middle of the deliberately broad gravel route stays clear.
  const lane = farmDriveLane();
  return !lane.slice(1).some((end, index) => distanceToSegment(projected, lane[index], end) < FARM_PLOT_SPAN * .35);
}

/** World cues use the same strict presentation-only exclusion policy as props. */
export function farmWorldCueIsSafe(cue: Pick<FarmWorldCue, 'x' | 'y'>): boolean {
  return farmDecorIsSafe(cue);
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
