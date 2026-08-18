/** Keep the procedural Canvas responsive on large desktop displays. */
export const MAX_RENDER_PIXELS = 1_920 * 1_080;

export function boundedRenderScale(width: number, height: number, devicePixelRatio: number): number {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const requested = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(2, devicePixelRatio)
    : 1;
  const pixelCapScale = Math.sqrt(MAX_RENDER_PIXELS / (safeWidth * safeHeight));
  return Math.min(requested, pixelCapScale);
}
