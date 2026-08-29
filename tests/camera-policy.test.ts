import { describe, expect, it } from 'vitest';
import { cameraFitCenter, cameraFitZoom, clampCameraCenter, farmCameraPolicy, townCameraPolicy } from '../src/render/cameraPolicy';

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
        const left = (policy.bounds.minX - clamped.cx) * zoom + w / 2;
        const right = (policy.bounds.maxX - clamped.cx) * zoom + w / 2;
        const top = (policy.bounds.minY - clamped.cy) * zoom + h / 2;
        const bottom = (policy.bounds.maxY - clamped.cy) * zoom + h / 2;
        expect(Math.min(right, w) - Math.max(left, 0)).toBeGreaterThan(0);
        expect(Math.min(bottom, h) - Math.max(top, 0)).toBeGreaterThan(0);
        if (w >= 1280 && (policy.bounds.maxY - policy.bounds.minY) * zoom <= h - policy.padding * 2 + 1) {
          expect(left).toBeGreaterThanOrEqual(policy.padding - 1);
          expect(top).toBeGreaterThanOrEqual(policy.padding - 1);
          expect(right).toBeLessThanOrEqual(w - policy.padding + 1);
          expect(bottom).toBeLessThanOrEqual(h - policy.padding + 1);
        }
      }
    });
  }

  it('recenter/refit uses the policy midpoint for a changed viewport', () => {
    const policy = farmCameraPolicy();
    const zoom = cameraFitZoom(policy, 760, 640);
    const midpoint = cameraFitCenter(policy);
    const center = clampCameraCenter(midpoint.cx, midpoint.cy, zoom, 760, 640, policy);
    expect(center.cx).toBeCloseTo(midpoint.cx);
    expect(Math.abs(center.cy - midpoint.cy)).toBeLessThan(50);
  });

  it('fits the working homestead while retaining broader bounded property panning', () => {
    const policy = farmCameraPolicy();
    expect(policy.fitBounds).toBeDefined();
    expect(policy.bounds.maxX - policy.bounds.minX).toBeGreaterThan(policy.fitBounds!.maxX - policy.fitBounds!.minX);
    expect(cameraFitCenter(policy)).not.toEqual({
      cx: (policy.bounds.minX + policy.bounds.maxX) / 2,
      cy: (policy.bounds.minY + policy.bounds.maxY) / 2,
    });
  });

  it('computes a distinct compact refit for both active scenes', () => {
    for (const policy of [farmCameraPolicy(), townCameraPolicy()]) {
      const desktop = cameraFitZoom(policy, 2048, 1152);
      const compact = cameraFitZoom(policy, 760, 640);
      expect(compact).toBeLessThan(desktop);
      expect(compact).toBeGreaterThanOrEqual(policy.minZoom);
    }
  });

  it('uses viewport-specific farm policy while preserving desktop defaults', () => {
    expect(farmCameraPolicy().minZoom).toBe(.46);
    expect(farmCameraPolicy(390, 844).minZoom).toBe(.18);
    expect(farmCameraPolicy(844, 390).padding).toBe(18);
  });
});
