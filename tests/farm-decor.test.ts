import { describe, expect, it } from 'vitest';
import { FARM_DECOR_MANIFEST, FARM_FENCE_MANIFEST, farmDecorIsSafe, farmDecorManifest, farmDecorTypes, farmWindbreakAnchors } from '../src/render/farmDecor';
import { farmMainlandBounds, farmWorldPoint, pointInFarmBounds } from '../src/render/farmLayout';

describe('Farm atmosphere decor manifest', () => {
  it('is stable, finite, ordered, and uses the bounded prop vocabulary', () => {
    expect(farmDecorManifest()).toBe(FARM_DECOR_MANIFEST);
    expect(FARM_DECOR_MANIFEST.map((item) => item.id)).toEqual(['hay-west', 'hay-east', 'hay-yard', 'crate-pallet', 'water-trough', 'hand-pump']);
    expect(FARM_DECOR_MANIFEST).toHaveLength(6);
    expect(new Set(FARM_DECOR_MANIFEST.map((item) => item.type))).toEqual(new Set(farmDecorTypes()));
    expect(FARM_FENCE_MANIFEST).toHaveLength(10);
  });

  it('keeps props within the mainland and away from field, landmark, and lane constraints', () => {
    for (const prop of FARM_DECOR_MANIFEST) {
      expect(pointInFarmBounds(farmWorldPoint(prop), farmMainlandBounds())).toBe(true);
      expect(farmDecorIsSafe(prop), prop.id).toBe(true);
    }
    for (const tree of farmWindbreakAnchors()) expect(pointInFarmBounds(tree)).toBe(true);
  });
});
