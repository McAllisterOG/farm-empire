import type { FarmPlot } from '../core/types';
import { farmPlotFootprint } from './farmLayout';
import type { FarmCropVisual } from './farmCropVisuals';

/** A crop sprite's ground anchor in presentation-world tile coordinates. */
export interface FarmCropPlantAnchor {
  x: number;
  y: number;
  row: number;
  column: number;
  index: number;
  /** Isometric ground depth. Higher anchors belong in front of lower ones. */
  depth: number;
}

interface CachedFarmCropAnchors {
  rows: number;
  columns: number;
  anchors: FarmCropPlantAnchor[];
}

/**
 * A bounded cache for the geometry that stays fixed while a field keeps the
 * same crop density. It deliberately keys by logical plot coordinate so a
 * crop swap with a different row/column layout replaces only that entry.
 */
export class FarmCropAnchorCache {
  private readonly entries = new Map<string, CachedFarmCropAnchors>();

  constructor(private readonly maxEntries = 192) {}

  get size(): number { return this.entries.size; }

  anchorsFor(
    plot: Pick<FarmPlot, 'x' | 'y'>,
    visual: Pick<FarmCropVisual, 'rows' | 'columns'>,
  ): readonly FarmCropPlantAnchor[] {
    const key = `${plot.x}:${plot.y}`;
    const cached = this.entries.get(key);
    if (cached && cached.rows === visual.rows && cached.columns === visual.columns) {
      // Refresh Map insertion order so bounded eviction retains actively drawn plots.
      this.entries.delete(key); this.entries.set(key, cached);
      return cached.anchors;
    }
    if (!cached && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    const next = { rows: visual.rows, columns: visual.columns, anchors: farmCropPlantAnchors(plot, visual) };
    this.entries.set(key, next);
    return next.anchors;
  }
}

/**
 * Returns the bounded, deterministic plant anchors for one field section.
 * Sprite art remains cached separately; this only supplies the per-plant depth
 * needed to interleave crops with nearby world entities.
 */
export function farmCropPlantAnchors(
  plot: Pick<FarmPlot, 'x' | 'y'>,
  visual: Pick<FarmCropVisual, 'rows' | 'columns'>,
): FarmCropPlantAnchor[] {
  const footprint = farmPlotFootprint(plot);
  const width = footprint.maxX - footprint.minX;
  const height = footprint.maxY - footprint.minY;
  const anchors: FarmCropPlantAnchor[] = [];
  for (let row = 0; row < visual.rows; row++) for (let column = 0; column < visual.columns; column++) {
    const x = footprint.minX + (column + .5 + (row % 2 ? .08 : 0)) * width / visual.columns;
    const y = footprint.minY + (row + .5) * height / visual.rows;
    anchors.push({ x, y, row, column, index: row * visual.columns + column, depth: x + y });
  }
  return anchors;
}

/** Explicit insertion ordering makes equal-depth canvas layers deterministic. */
export interface SequencedDepthItem {
  depth: number;
  order?: number;
}

export function compareSequencedDepth(a: SequencedDepthItem, b: SequencedDepthItem): number {
  return a.depth - b.depth || (a.order ?? 0) - (b.order ?? 0);
}
