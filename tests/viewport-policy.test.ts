import { describe, expect, it } from 'vitest';
import {
  farmCameraViewportPolicy,
  isPhonePortraitViewport,
  isShortLandscapeViewport,
  resolveViewportSize,
} from '../src/core/viewportPolicy';
import { cameraFitZoom, farmCameraPolicy } from '../src/render/cameraPolicy';

describe('phone viewport and farm-camera policy', () => {
  it('prefers the visual viewport over a stale iOS layout viewport', () => {
    expect(resolveViewportSize({
      visualWidth: 844,
      visualHeight: 390,
      innerWidth: 390,
      innerHeight: 844,
      clientWidth: 390,
      clientHeight: 844,
    })).toEqual({ width: 844, height: 390 });
    expect(resolveViewportSize({ innerWidth: 393, innerHeight: 852 })).toEqual({ width: 393, height: 852 });
  });

  it('distinguishes phone portrait and short phone landscape from tablet layouts', () => {
    expect(isPhonePortraitViewport(390, 844)).toBe(true);
    expect(isShortLandscapeViewport(844, 390)).toBe(true);
    expect(isPhonePortraitViewport(834, 1194)).toBe(false);
    expect(isShortLandscapeViewport(1194, 834)).toBe(false);
  });

  it('allows a useful whole-farm overview on phones without changing the tablet floor', () => {
    expect(farmCameraViewportPolicy(390, 844)).toEqual({ padding: 18, minZoom: .18 });
    expect(farmCameraViewportPolicy(844, 390)).toEqual({ padding: 18, minZoom: .18 });
    expect(farmCameraViewportPolicy(834, 1194)).toEqual({ padding: 70, minZoom: .46 });

    const portrait = farmCameraPolicy(390, 844);
    const landscape = farmCameraPolicy(844, 390);
    expect(cameraFitZoom(portrait, 390, 844)).toBeGreaterThanOrEqual(.18);
    expect(cameraFitZoom(portrait, 390, 844)).toBeLessThan(.46);
    expect(cameraFitZoom(landscape, 844, 390)).toBeGreaterThanOrEqual(.18);
  });

  it('returns to exactly the same framing after portrait-landscape-portrait rotation', () => {
    const portraitBefore = cameraFitZoom(farmCameraPolicy(390, 844), 390, 844);
    const landscape = cameraFitZoom(farmCameraPolicy(844, 390), 844, 390);
    const portraitAfter = cameraFitZoom(farmCameraPolicy(390, 844), 390, 844);
    expect(Number.isFinite(landscape)).toBe(true);
    expect(portraitAfter).toBe(portraitBefore);
  });
});
