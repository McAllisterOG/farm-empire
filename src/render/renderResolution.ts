/** Keep the procedural Canvas responsive on large desktop displays. */
export const MAX_RENDER_PIXELS = 1_920 * 1_080;
export const FARM_RENDER_INTERVAL_MS = 1_000 / 30;

export function boundedRenderScale(width: number, height: number, devicePixelRatio: number): number {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(2, devicePixelRatio)
    : 1;
  const pixelCapScale = Math.sqrt(MAX_RENDER_PIXELS / (safeWidth * safeHeight));
  return Math.min(requested, pixelCapScale);
}

/** Farm art is intentionally capped at a smooth, stable 30 fps. */
export function shouldRenderFarmFrame(lastRenderedAt: number, now: number): boolean {
  if (!Number.isFinite(now)) return false;
  if (!Number.isFinite(lastRenderedAt) || lastRenderedAt <= 0) return true;
  return now - lastRenderedAt >= FARM_RENDER_INTERVAL_MS;
}
