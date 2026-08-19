import { describe, expect, it } from 'vitest';
import { FARM_CROPS } from '../src/data/farm.data';
import { shouldTriggerFarmHarvestFeedback } from '../src/game/farmHarvestFeedback';
import { FARM_CROP_VISUALS, farmCropVisualFor, isFarmCropRipeStage } from '../src/render/farmCropVisuals';
import { farmGroundVariant } from '../src/render/farmTerrain';

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
});
