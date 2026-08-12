/**
 * Farm Empire's visual coordinate system.  Simulation coordinates deliberately
 * remain small and save-compatible; this module is the sole bridge to the
 * larger physical property shown by the Canvas.
 */
import type { FarmPlot } from '../core/types';
import { PICKUP_CARGO_PAD } from '../core/farmPickupData';
import { FARM_TOWN_ROAD_WAYPOINTS } from '../core/townGateway';

/** Logical plot centre-to-centre distance in presentation-world tiles. */
export const FARM_PLOT_SPAN = 2.75;
export const FARM_PLOT_GAP = 0.14;

export interface FarmPoint { x: number; y: number }
export interface FarmBounds { minX: number; minY: number; maxX: number; maxY: number }

export interface FarmLandmarks {
  farmhouse: FarmPoint;
  doghouse: FarmPoint;
  scoutHome: FarmPoint;
  cargoPad: FarmPoint;
}

/** Farm-only landmarks are presentation anchors, never saved world state. */
export function farmLandmarks(): FarmLandmarks {
  const farmhouse = { x: 5.45, y: 4.35 };
  const doghouse = { x: 9.2, y: 13.55 };
  const scoutHome = { x: 9.15, y: 13.1 };
  const cargoPad = PICKUP_CARGO_PAD;
  return {
    farmhouse,
    doghouse,
    scoutHome,
    cargoPad,
  };
}

export function farmWorldPoint(point: FarmPoint): FarmPoint {
  return { x: point.x * FARM_PLOT_SPAN, y: point.y * FARM_PLOT_SPAN };
}

/** Presentation-world projection of the authoritative logical farm road. */
export function farmDriveLane(): readonly FarmPoint[] {
  return [farmWorldPoint(farmLandmarks().cargoPad), ...FARM_TOWN_ROAD_WAYPOINTS.map(farmWorldPoint)];
}

export function farmLogicalPoint(point: FarmPoint): FarmPoint {
  return { x: point.x / FARM_PLOT_SPAN, y: point.y / FARM_PLOT_SPAN };
}

/** Screen-space heading for a logical farm direction under the isometric basis. */
export function farmScreenHeadingAngle(heading: FarmPoint): number {
  const screenX = heading.x - heading.y;
  const screenY = (heading.x + heading.y) / 2;
  return Math.atan2(screenY, screenX);
}

export interface FarmUprightPose { mirrored: boolean; slope: number }

/**
 * An upright side-view vehicle pose for a projected farm heading.  The front
 * remains on the correct left/right side while diagonal travel cannot tip the
 * cab into a vertical paper cutout.
 */
export function farmUprightPose(heading: FarmPoint, maxSlope = Math.PI / 6): FarmUprightPose {
  const angle = farmScreenHeadingAngle(heading);
  const screenX = heading.x - heading.y;
  const mirrored = screenX < -0.000001;
  const folded = mirrored ? angle - Math.sign(angle || 1) * Math.PI : angle;
  return { mirrored, slope: Math.max(-maxSlope, Math.min(maxSlope, folded)) };
}

/** The continuous soil footprint of one logical field section. */
export function farmPlotFootprint(plot: Pick<FarmPlot, 'x' | 'y'>): FarmBounds {
  const half = (FARM_PLOT_SPAN - FARM_PLOT_GAP) / 2;
  const centre = farmWorldPoint(plot);
  return { minX: centre.x - half, minY: centre.y - half, maxX: centre.x + half, maxY: centre.y + half };
}

/** Returns the exact logical plot hit, including its large presentation footprint. */
export function farmPlotAtWorldPoint<T extends Pick<FarmPlot, 'x' | 'y'>>(plots: readonly T[], point: FarmPoint): T | undefined {
  return plots.find((plot) => {
    const bounds = farmPlotFootprint(plot);
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  });
}

/** Deterministic rectangular mainland bounds in presentation-world tile units. */
export function farmMainlandBounds(): FarmBounds {
  return { minX: 0, minY: 0, maxX: 58, maxY: 46 };
}

/** Default camera focus: the working homestead, not the entire commercial tract. */
export function farmHomeFocusBounds(): FarmBounds {
  return { minX: 0, minY: 7, maxX: 30, maxY: 40 };
}

export function pointInFarmBounds(point: FarmPoint, bounds = farmMainlandBounds()): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}
