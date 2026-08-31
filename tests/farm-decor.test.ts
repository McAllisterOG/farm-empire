import { describe, expect, it } from 'vitest';
import { FARM_DECOR_MANIFEST, FARM_FENCE_MANIFEST, FARM_FIREFLY_ANCHORS, FARM_HOMESTEAD_DECOR_MANIFEST, FARM_WORLD_CUE_MANIFEST, farmDecorIsSafe, farmDecorManifest, farmDecorTypes, farmHomesteadDecorIsSafe, farmHomesteadDecorManifest, farmHomesteadDecorTypes, farmWindbreakAnchors, farmWorldCueIsSafe, farmWorldCueManifest, farmWorldCueTypes } from '../src/render/farmDecor';
import { farmDriveLane, farmLandmarks, farmMainlandBounds, farmWorldPoint, pointInFarmBounds } from '../src/render/farmLayout';
import { FARM_TOWN_GATE } from '../src/core/townGateway';
import { farmNightAlpha } from '../src/render/renderer';

describe('Farm atmosphere decor manifest', () => {
  it('is stable, finite, ordered, and uses the bounded prop vocabulary', () => {
    expect(farmDecorManifest()).toBe(FARM_DECOR_MANIFEST);
    expect(FARM_DECOR_MANIFEST.map((item) => item.id)).toEqual(['hay-west', 'hay-east', 'hay-yard', 'crate-pallet', 'water-trough', 'hand-pump']);
    expect(FARM_DECOR_MANIFEST).toHaveLength(6);
    expect(new Set(FARM_DECOR_MANIFEST.map((item) => item.type))).toEqual(new Set(farmDecorTypes()));
    expect(FARM_FENCE_MANIFEST).toHaveLength(10);
    expect(FARM_FIREFLY_ANCHORS).toHaveLength(6);
  });

  it('keeps finite deterministic working-land cues outside fields, anchors, and the active lane', () => {
    expect(farmWorldCueManifest()).toBe(FARM_WORLD_CUE_MANIFEST);
    expect(FARM_WORLD_CUE_MANIFEST).toHaveLength(14);
    expect(new Set(FARM_WORLD_CUE_MANIFEST.map((cue) => cue.type))).toEqual(new Set(farmWorldCueTypes()));
    expect(new Set(FARM_WORLD_CUE_MANIFEST.map((cue) => cue.id)).size).toBe(FARM_WORLD_CUE_MANIFEST.length);
    for (const cue of FARM_WORLD_CUE_MANIFEST) {
      expect(pointInFarmBounds(farmWorldPoint(cue), farmMainlandBounds())).toBe(true);
      expect(farmWorldCueIsSafe(cue), cue.id).toBe(true);
    }
  });

  it('keeps the visual road spine continuous from cargo receiving through the County gateway', () => {
    const lane = farmDriveLane();
    expect(lane.at(0)).toEqual(farmWorldPoint(farmLandmarks().cargoPad));
    expect(lane.at(-1)).toEqual(farmWorldPoint(FARM_TOWN_GATE));
    expect(lane).toHaveLength(6);
    expect(lane.every((point) => pointInFarmBounds(point))).toBe(true);
  });

  it('keeps props within the mainland and away from field, landmark, and lane constraints', () => {
    for (const prop of FARM_DECOR_MANIFEST) {
      expect(pointInFarmBounds(farmWorldPoint(prop), farmMainlandBounds())).toBe(true);
      expect(farmDecorIsSafe(prop), prop.id).toBe(true);
    }
    for (const tree of farmWindbreakAnchors()) expect(pointInFarmBounds(tree)).toBe(true);
    for (const firefly of FARM_FIREFLY_ANCHORS) expect(farmDecorIsSafe(firefly), `${firefly.x},${firefly.y}`).toBe(true);
  });

  it('keeps finite homestead dressing deterministic and clear of farm anchors', () => {
    expect(farmHomesteadDecorManifest()).toBe(FARM_HOMESTEAD_DECOR_MANIFEST);
    expect(FARM_HOMESTEAD_DECOR_MANIFEST).toHaveLength(6);
    expect(new Set(FARM_HOMESTEAD_DECOR_MANIFEST.map((decor) => decor.id)).size).toBe(FARM_HOMESTEAD_DECOR_MANIFEST.length);
    expect(new Set(FARM_HOMESTEAD_DECOR_MANIFEST.map((decor) => decor.type))).toEqual(new Set(farmHomesteadDecorTypes()));
    for (const decor of FARM_HOMESTEAD_DECOR_MANIFEST) {
      expect(pointInFarmBounds(farmWorldPoint(decor), farmMainlandBounds())).toBe(true);
      expect(farmHomesteadDecorIsSafe(decor), decor.id).toBe(true);
    }
  });
});

describe('Farm-clock lighting', () => {
  it('uses saved clock minutes for clear day, bounded twilight, and deep night', () => {
    expect(farmNightAlpha(10 * 60)).toBe(0);
    expect(farmNightAlpha(22 * 60)).toBe(.42);
    expect(farmNightAlpha(18 * 60)).toBeGreaterThan(0);
    expect(farmNightAlpha(18 * 60)).toBeLessThan(.42);
    expect(farmNightAlpha(6 * 60)).toBeGreaterThan(0);
    expect(farmNightAlpha(6 * 60)).toBeLessThan(.42);
  });
});
