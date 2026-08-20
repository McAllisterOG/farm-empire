import { isoX, isoY } from './iso';
import { farmHomeFocusBounds, farmMainlandBounds } from './farmLayout';

export interface WorldRect { minX: number; minY: number; maxX: number; maxY: number }
export interface CameraPolicy { bounds: WorldRect; fitBounds?: WorldRect; padding: number; minZoom: number; maxZoom: number }

export function tileBoundsToWorld(minX: number, minY: number, maxX: number, maxY: number): WorldRect {
  const points = [{ x: isoX(minX, minY), y: isoY(minX, minY) }, { x: isoX(maxX, minY), y: isoY(maxX, minY) }, { x: isoX(minX, maxY), y: isoY(minX, maxY) }, { x: isoX(maxX, maxY), y: isoY(maxX, maxY) }];
  return { minX: Math.min(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxX: Math.max(...points.map((p) => p.x)), maxY: Math.max(...points.map((p) => p.y)) };
}

export function cameraFitZoom(policy: CameraPolicy, viewW: number, viewH: number): number {
  const fit = policy.fitBounds ?? policy.bounds;
  const width = Math.max(1, fit.maxX - fit.minX);
  const height = Math.max(1, fit.maxY - fit.minY);
  return Math.max(policy.minZoom, Math.min(policy.maxZoom, Math.min((viewW - policy.padding * 2) / width, (viewH - policy.padding * 2) / height)));
}

export function clampCameraCenter(cx: number, cy: number, zoom: number, viewW: number, viewH: number, policy: CameraPolicy): { cx: number; cy: number } {
  const halfW = viewW / (2 * zoom); const halfH = viewH / (2 * zoom);
  const minCx = policy.bounds.minX + halfW - policy.padding / zoom;
  const maxCx = policy.bounds.maxX - halfW + policy.padding / zoom;
  const minCy = policy.bounds.minY + halfH - policy.padding / zoom;
  const maxCy = policy.bounds.maxY - halfH + policy.padding / zoom;
  return { cx: minCx > maxCx ? (policy.bounds.minX + policy.bounds.maxX) / 2 : Math.max(minCx, Math.min(maxCx, cx)), cy: minCy > maxCy ? (policy.bounds.minY + policy.bounds.maxY) / 2 : Math.max(minCy, Math.min(maxCy, cy)) };
}

export function clampCameraZoom(zoom: number, policy: CameraPolicy): number {
  return Math.max(policy.minZoom, Math.min(policy.maxZoom, Number.isFinite(zoom) ? zoom : policy.minZoom));
}

export function cameraFitCenter(policy: CameraPolicy): { cx: number; cy: number } {
  const fit = policy.fitBounds ?? policy.bounds;
  return { cx: (fit.minX + fit.maxX) / 2, cy: (fit.minY + fit.maxY) / 2 };
}

export function farmCameraPolicy(): CameraPolicy {
  const property = farmMainlandBounds();
  const home = farmHomeFocusBounds();
  return {
    bounds: tileBoundsToWorld(property.minX, property.minY, property.maxX, property.maxY),
    fitBounds: tileBoundsToWorld(home.minX, home.minY, home.maxX, home.maxY),
    padding: 70,
    minZoom: .46,
    maxZoom: 1.15,
  };
}
export function townCameraPolicy(): CameraPolicy { return { bounds: tileBoundsToWorld(2, 2, 30, 20), padding: 60, minZoom: .72, maxZoom: 1.2 }; }
