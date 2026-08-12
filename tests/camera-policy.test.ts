import { describe, expect, it } from 'vitest';
import { cameraFitZoom, clampCameraCenter, farmCameraPolicy, townCameraPolicy } from '../src/render/cameraPolicy';

describe('scene camera policies', () => {
  for (const [name, policy] of [['farm', farmCameraPolicy()], ['town', townCameraPolicy()]] as const) {
    it(`${name} fits and clamps common desktop and compact sizes`, () => {
      for (const [w, h] of [[2048, 1152], [1280, 720], [760, 640]] as const) {
        const zoom = cameraFitZoom(policy, w, h);
        expect(zoom).toBeGreaterThanOrEqual(policy.minZoom);
        expect(zoom).toBeLessThanOrEqual(policy.maxZoom);
        const clamped = clampCameraCenter(-99999, 99999, zoom, w, h, policy);
        expect(Number.isFinite(clamped.cx)).toBe(true);
        expect(Number.isFinite(clamped.cy)).toBe(true);
      }
    });
  }
});
