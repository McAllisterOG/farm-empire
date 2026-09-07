import { describe, it, expect } from "vitest";
import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import { Camera } from "../src/render/camera";
import { isoX, isoY } from "../src/render/iso";
import {
  projectThreePoint,
  syncThreeCamera,
} from "../src/render/threeProjection";
import { farmWorldPoint } from "../src/render/farmLayout";
import {
  cameraFitCenter,
  cameraFitZoom,
  threeTownCameraPolicy,
} from "../src/render/cameraPolicy";

describe("3D camera and authoritative ground mapping", () => {
  it("keeps the complete Town roof-and-ground bounds inside all five viewport fits", () => {
    for (const [w, h] of [
      [1280, 800],
      [390, 844],
      [844, 390],
      [768, 1024],
      [1024, 768],
    ]) {
      const policy = threeTownCameraPolicy(w, h),
        center = cameraFitCenter(policy),
        zoom = cameraFitZoom(policy, w, h);
      expect(
        (policy.bounds.minX - center.cx) * zoom + w / 2,
      ).toBeGreaterThanOrEqual(policy.padding - 1);
      expect(
        (policy.bounds.maxX - center.cx) * zoom + w / 2,
      ).toBeLessThanOrEqual(w - policy.padding + 1);
      expect(
        (policy.bounds.minY - center.cy) * zoom + h / 2,
      ).toBeGreaterThanOrEqual(policy.padding - 1);
      expect(
        (policy.bounds.maxY - center.cy) * zoom + h / 2,
      ).toBeLessThanOrEqual(h - policy.padding + 1);
    }
  });
  it("projects and ray-unprojects the same field centers across viewports, zoom and pan", () => {
    const source = new Camera(),
      target = new OrthographicCamera(),
      ray = new Raycaster(),
      plane = new Plane(new Vector3(0, 1, 0), 0),
      ground = new Vector3();
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
      [844, 390],
      [768, 1024],
      [1024, 768],
    ])
      for (const zoom of [0.18, 0.46, 1, 2.2]) {
        source.resize(width, height);
        source.zoom = zoom;
        source.centerOnTile(17, 23);
        source.pan(38, -71);
        syncThreeCamera(target, source);
        for (const logical of [
          { x: 0, y: 0 },
          { x: 4, y: 8 },
          { x: 8, y: 13 },
          { x: 19, y: 4 },
        ]) {
          const p = farmWorldPoint(logical),
            screen = projectThreePoint(target, width, height, p.x, p.y);
          expect(screen.x).toBeCloseTo(source.sx(isoX(p.x, p.y)), 8);
          expect(screen.y).toBeCloseTo(source.sy(isoY(p.x, p.y)), 8);
          ray.setFromCamera(
            new Vector2(
              (screen.x / width) * 2 - 1,
              1 - (screen.y / height) * 2,
            ),
            target,
          );
          ray.ray.intersectPlane(plane, ground);
          expect(ground.x).toBeCloseTo(p.x, 8);
          expect(ground.z).toBeCloseTo(p.y, 8);
          const input = source.tilePointAt(screen.x, screen.y);
          expect(input.x).toBeCloseTo(p.x, 8);
          expect(input.y).toBeCloseTo(p.y, 8);
        }
      }
  });
  it("raises actual geometry vertically while retaining its ground anchor", () => {
    const source = new Camera(),
      target = new OrthographicCamera();
    syncThreeCamera(target, source);
    const ground = projectThreePoint(target, 800, 600, 5, 9),
      roof = projectThreePoint(target, 800, 600, 5, 9, 4);
    expect(roof.x).toBeCloseTo(ground.x, 9);
    expect(roof.y).toBeLessThan(ground.y - 100);
  });
});
