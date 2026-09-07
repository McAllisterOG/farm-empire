import { OrthographicCamera, Vector3 } from "three";
import type { Camera } from "./camera";
import { tileXf, tileYf } from "./iso";

// A 30-degree elevation reproduces the established 64x32 ground diamonds.
// Height is genuinely orthogonal to that ground, with normal depth testing.
export const WORLD_PIXEL_SCALE = 32 * Math.SQRT2;
export function syncThreeCamera(
  target: OrthographicCamera,
  source: Camera,
): void {
  const scale = WORLD_PIXEL_SCALE * source.zoom;
  target.left = -source.viewW / (2 * scale);
  target.right = -target.left;
  target.top = source.viewH / (2 * scale);
  target.bottom = -target.top;
  target.near = 0.1;
  target.far = 500;
  const x = tileXf(source.cx, source.cy);
  const z = tileYf(source.cx, source.cy);
  target.position.set(
    x + 100 * Math.sqrt(3 / 8),
    50,
    z + 100 * Math.sqrt(3 / 8),
  );
  target.lookAt(x, 0, z);
  target.updateProjectionMatrix();
  target.updateMatrixWorld();
}

export function projectThreePoint(
  camera: OrthographicCamera,
  width: number,
  height: number,
  x: number,
  z: number,
  elevation = 0,
): { x: number; y: number } {
  const v = new Vector3(x, elevation, z).project(camera);
  return { x: ((v.x + 1) * width) / 2, y: ((1 - v.y) * height) / 2 };
}
