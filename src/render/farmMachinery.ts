export type HarvestWagonTier = 'basic' | 'county';

export interface HarvestWagonRenderState {
  tier: HarvestWagonTier;
  used: number;
  attached: boolean;
}

export interface TractorAttachmentHitShape {
  distance: number;
  halfLength: number;
  halfWidth: number;
}

/**
 * During planting, place the wagon just beyond the working toolbar.  This is
 * painter-only spacing: logical attachment and hit geometry remain unchanged.
 */
export function tractorWagonRenderOffset(workKind?: 'plant' | 'harvest'): number {
  return workKind === 'plant' ? -40 : 0;
}

/** Render-only capacities mirror the authoritative farm-business units. */
const WAGON_CAPACITY: Record<HarvestWagonTier, number> = { basic: 240, county: 480 };

/**
 * The painted wagon stays compact, but its grain profile is proportional to
 * the real cargo.  This deliberately has no bearing on cargo transactions.
 */
export function harvestWagonLoadPresentation(tier: HarvestWagonTier, used: number): { capacity: number; fill: number; cargoCount: number } {
  const capacity = WAGON_CAPACITY[tier];
  const fill = Math.max(0, Math.min(1, used / capacity));
  return { capacity, fill, cargoCount: fill === 0 ? 0 : Math.max(1, Math.ceil(fill * (tier === 'county' ? 5 : 4))) };
}

/** Matches the narrow visual trailer silhouette rather than a broad vehicle circle. */
export function tractorAttachmentHitShape(tier: HarvestWagonTier = 'basic'): TractorAttachmentHitShape {
  return tier === 'county'
    ? { distance: 1.48, halfLength: .84, halfWidth: .5 }
    : { distance: 1.45, halfLength: .72, halfWidth: .48 };
}
