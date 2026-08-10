/**
 * Farm Empire's visual coordinate system.  Simulation coordinates deliberately
 * remain small and save-compatible; this module is the sole bridge to the
 * larger physical property shown by the Canvas.
 */
import type { FarmPlot } from '../core/types';

/** Logical plot centre-to-centre distance in presentation-world tiles. */
export const FARM_PLOT_SPAN = 2.75;
export const FARM_PLOT_GAP = 0.14;

export interface FarmPoint { x: number; y: number }
export interface FarmBounds { minX: number; minY: number; maxX: number; maxY: number }

export function farmWorldPoint(point: FarmPoint): FarmPoint {
  return { x: point.x * FARM_PLOT_SPAN, y: point.y * FARM_PLOT_SPAN };
}

export function farmLogicalPoint(point: FarmPoint): FarmPoint {
  return { x: point.x / FARM_PLOT_SPAN, y: point.y / FARM_PLOT_SPAN };
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
  return { minX: 2, minY: 2, maxX: 43, maxY: 39 };
}

export function pointInFarmBounds(point: FarmPoint, bounds = farmMainlandBounds()): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

