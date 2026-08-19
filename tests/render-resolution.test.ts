import { describe, expect, it } from 'vitest';
import { boundedRenderScale, FARM_RENDER_INTERVAL_MS, MAX_RENDER_PIXELS, shouldRenderFarmFrame } from '../src/render/renderResolution';

describe('desktop Canvas resolution budget', () => {
  it('keeps ordinary displays crisp while bounding 4K and high-DPI backing stores', () => {
    expect(boundedRenderScale(1_280, 720, 1)).toBe(1);
    expect(boundedRenderScale(800, 600, 2)).toBe(2);
    expect(boundedRenderScale(3_840, 2_160, 1)).toBeCloseTo(0.5, 6);

    for (const [width, height, dpr] of [[3_840, 2_160, 1], [2_560, 1_440, 2], [1_920, 1_080, 2]]) {
      const scale = boundedRenderScale(width, height, dpr);
      expect(width * height * scale * scale).toBeLessThanOrEqual(MAX_RENDER_PIXELS + 1);
    }
  });

  it('fails safely for invalid viewport inputs', () => {
    expect(boundedRenderScale(0, Number.NaN, 0)).toBe(1);
  });

  it('paces expensive farm presentation at a stable 30 fps', () => {
    expect(FARM_RENDER_INTERVAL_MS).toBeCloseTo(33.3333, 3);
    expect(shouldRenderFarmFrame(0, 10)).toBe(true);
    expect(shouldRenderFarmFrame(100, 120)).toBe(false);
    expect(shouldRenderFarmFrame(100, 134)).toBe(true);
    expect(shouldRenderFarmFrame(100, Number.NaN)).toBe(false);
  });
});
