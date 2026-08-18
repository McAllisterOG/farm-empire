import { hashSeed } from '../core/rng';
import { farmMainlandBounds, type FarmBounds } from './farmLayout';

/** Small, deterministic variation for a flat rural grass mainland. */
export function farmGroundVariant(seed: number, x: number, y: number): number {
  return hashSeed(`${seed}:farm-ground-v2:${x}:${y}`) % 16;
}

export function farmTerrainBounds(): FarmBounds {
  return farmMainlandBounds();
}

export function intersectsFarmTerrain(bounds: FarmBounds, view: FarmBounds): boolean {
  return !(view.maxX < bounds.minX || view.minX > bounds.maxX || view.maxY < bounds.minY || view.minY > bounds.maxY);
}
