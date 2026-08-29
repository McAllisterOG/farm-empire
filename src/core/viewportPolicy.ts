export interface ViewportCandidates {
  visualWidth?: number | null;
  visualHeight?: number | null;
  innerWidth?: number | null;
  innerHeight?: number | null;
  clientWidth?: number | null;
  clientHeight?: number | null;
}

export interface ViewportSize {
  width: number;
  height: number;
}

function firstPositive(...values: Array<number | null | undefined>): number {
  const match = values.find((value) => Number.isFinite(value) && Number(value) > 0);
  return Math.max(1, Math.round(Number(match ?? 1)));
}

/**
 * iOS can briefly leave CSS layout dimensions stale while rotating a standalone
 * web app. Prefer the visual viewport, then fall back through the layout values.
 */
export function resolveViewportSize(candidates: ViewportCandidates): ViewportSize {
  return {
    width: firstPositive(candidates.visualWidth, candidates.innerWidth, candidates.clientWidth),
    height: firstPositive(candidates.visualHeight, candidates.innerHeight, candidates.clientHeight),
  };
}

export function isShortLandscapeViewport(width: number, height: number): boolean {
  return width > height && height <= 500;
}

export function isPhonePortraitViewport(width: number, height: number): boolean {
  return height >= width && width <= 560;
}

export interface FarmCameraViewportPolicy {
  padding: number;
  minZoom: number;
}

/** Desktop framing stays unchanged; phones may reach a true homestead overview. */
export function farmCameraViewportPolicy(width: number, height: number): FarmCameraViewportPolicy {
  if (isPhonePortraitViewport(width, height) || isShortLandscapeViewport(width, height)) {
    return { padding: 18, minZoom: .18 };
  }
  return { padding: 70, minZoom: .46 };
}
