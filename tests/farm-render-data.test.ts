import { describe, expect, it } from 'vitest';
import { FARM_CROPS } from '../src/data/farm.data';
import { shouldTriggerFarmHarvestFeedback } from '../src/game/farmHarvestFeedback';
import { FARM_CROP_VISUALS, farmCropSpriteVariant, farmCropVisualFor, isFarmCropRipeStage } from '../src/render/farmCropVisuals';
import { farmGroundVariant } from '../src/render/farmTerrain';
import { compareSequencedDepth, FarmCropAnchorCache, farmCropPlantAnchors } from '../src/render/farmDepth';

describe('farm runtime presentation data', () => {
  it('maps every catalog crop to an exact immutable farm-only visual key and silhouette', () => {
    const visuals = Object.values(FARM_CROP_VISUALS);
    const catalogIds = FARM_CROPS.map((crop) => crop.id).sort();
    expect(Object.keys(FARM_CROP_VISUALS).sort()).toEqual(catalogIds);
    expect(visuals).toHaveLength(FARM_CROPS.length);
    expect(new Set(visuals.map((visual) => visual.silhouette)).size).toBe(FARM_CROPS.length);
    for (const crop of FARM_CROPS) {
      expect(farmCropVisualFor(crop.id)).toBe(FARM_CROP_VISUALS[crop.id]);
      expect(farmCropVisualFor(crop.id).silhouette).toBeTruthy();
    }
    expect(farmCropVisualFor('unknown').silhouette).toBe('corn');
    const corn = farmCropVisualFor('crop_corn');
    expect(corn.baseHeight).toBeGreaterThanOrEqual(44);
    expect(corn.columns * corn.rows).toBeLessThanOrEqual(12);
    expect(visuals.every((visual) => visual.columns * visual.rows <= 20)).toBe(true);
    expect(corn.baseHeight).toBeGreaterThan(farmCropVisualFor('crop_soybean').baseHeight);
    expect(Object.isFrozen(FARM_CROP_VISUALS)).toBe(true);
    expect(Object.values(FARM_CROP_VISUALS).every(Object.isFrozen)).toBe(true);
  });

  it('triggers completion feedback only for successful player basket harvests', () => {
    expect(shouldTriggerFarmHarvestFeedback(true, true, 'crop_corn')).toBe(true);
    expect(shouldTriggerFarmHarvestFeedback(false, true, 'crop_corn')).toBe(false);
    expect(shouldTriggerFarmHarvestFeedback(true, false, 'crop_corn')).toBe(false);
    expect(shouldTriggerFarmHarvestFeedback(true, true, undefined)).toBe(false);
  });

  it('shows harvest produce only at the ready stage', () => {
    expect(isFarmCropRipeStage('seedling')).toBe(false);
    expect(isFarmCropRipeStage('needs-water')).toBe(false);
    expect(isFarmCropRipeStage('growing')).toBe(false);
    expect(isFarmCropRipeStage('withered')).toBe(false);
    expect(isFarmCropRipeStage('ready')).toBe(true);
  });

  it('selects stable, richer farm-ground variants', () => {
    const first = Array.from({ length: 24 }, (_, index) => farmGroundVariant(91, index, index * 3));
    expect(first).toEqual(Array.from({ length: 24 }, (_, index) => farmGroundVariant(91, index, index * 3)));
    expect(new Set(first).size).toBeGreaterThan(4);
    expect(first.every((variant) => variant >= 0 && variant < 16)).toBe(true);
  });

  it('bounds crop sprite cache variants across every plot index', () => {
    const variants = Array.from({ length: 132 }, (_, index) => farmCropSpriteVariant(index));
    expect(new Set(variants)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    expect(farmCropSpriteVariant(-1)).toBe(5);
    expect(farmCropSpriteVariant(Number.NaN)).toBe(0);
  });

  it('gives each crop plant a deterministic ground depth so tile-edge actors interleave truthfully', () => {
    const anchors = farmCropPlantAnchors({ x: 0, y: 0 }, FARM_CROP_VISUALS.crop_corn);
    expect(anchors).toHaveLength(12);
    expect(anchors.map((anchor) => anchor.index)).toEqual(Array.from({ length: 12 }, (_, index) => index));

    const behind = anchors[0]!;
    const inFront = anchors.at(-1)!;
    expect(behind.depth).toBeLessThan(0);
    expect(inFront.depth).toBeGreaterThan(0);
    expect([
      { id: 'front-crop', depth: inFront.depth, order: 2 },
      { id: 'actor-at-section-centre', depth: 0, order: 1 },
      { id: 'back-crop', depth: behind.depth, order: 0 },
    ].sort(compareSequencedDepth).map((item) => item.id)).toEqual([
      'back-crop', 'actor-at-section-centre', 'front-crop',
    ]);
    expect([
      { id: 'ready-or-withered-marker', depth: inFront.depth + .001, order: 1 },
      { id: 'front-crop', depth: inFront.depth, order: 0 },
    ].sort(compareSequencedDepth).map((item) => item.id)).toEqual([
      'front-crop', 'ready-or-withered-marker',
    ]);
  });

  it('keeps equal-depth render layers in their explicit insertion order', () => {
    const items = [
      { id: 'later', depth: 18.4, order: 7 },
      { id: 'first', depth: 18.4, order: 3 },
      { id: 'middle', depth: 18.4, order: 5 },
    ];
    expect(items.sort(compareSequencedDepth).map((item) => item.id)).toEqual(['first', 'middle', 'later']);
  });

  it('reuses bounded crop-anchor entries and replaces them when crop density changes', () => {
    const cache = new FarmCropAnchorCache(2);
    const plot = { x: 4, y: 7 };
    const corn = cache.anchorsFor(plot, FARM_CROP_VISUALS.crop_corn);
    expect(cache.anchorsFor(plot, FARM_CROP_VISUALS.crop_corn)).toBe(corn);

    const wheat = cache.anchorsFor(plot, FARM_CROP_VISUALS.crop_wheat);
    expect(wheat).not.toBe(corn);
    expect(wheat).toHaveLength(20);
    expect(cache.anchorsFor({ x: 5, y: 7 }, FARM_CROP_VISUALS.crop_corn)).toHaveLength(12);
    expect(cache.anchorsFor({ x: 6, y: 7 }, FARM_CROP_VISUALS.crop_corn)).toHaveLength(12);
    expect(cache.size).toBe(2);
    expect(cache.anchorsFor(plot, FARM_CROP_VISUALS.crop_wheat)).not.toBe(wheat);
  });
});
