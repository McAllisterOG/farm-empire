/** Deterministic, transient companion movement for the Farm Empire presentation. */
export type FarmCompanionMode = 'follow' | 'home';
export interface FarmCompanionPosition { x: number; y: number }
export interface FarmCompanionState extends FarmCompanionPosition { mode: FarmCompanionMode; moving: boolean }
export interface FarmCompanionFetchState { phase: 'outbound' | 'pickup' | 'returning'; target: FarmCompanionPosition; throwFrom: FarmCompanionPosition; phaseStartedAt: number }

export const FRISBEE_THROW_MS = 560;

/** Bounded presentation progress for the thrown frisbee, independent of frame rate. */
export function frisbeeThrowProgress(phase: FarmCompanionFetchState['phase'], phaseStartedAt: number, now: number): number {
  if (phase !== 'outbound' || !Number.isFinite(phaseStartedAt) || !Number.isFinite(now)) return 1;
  return Math.max(0, Math.min(1, (now - phaseStartedAt) / FRISBEE_THROW_MS));
}

/** Fetch is presentation-only and must yield to every active owner-work state. */
export function canAdvanceFarmCompanionFetch(runtime: {
  onFarm: boolean; operatingVehicle: boolean; tractorJob: boolean; farmhandJob: boolean;
  manualFieldAction: boolean; manualFieldJob: boolean; basketUnload: boolean;
}): boolean {
  return runtime.onFarm && !runtime.operatingVehicle && !runtime.tractorJob && !runtime.farmhandJob
    && !runtime.manualFieldAction && !runtime.manualFieldJob && !runtime.basketUnload;
}

const FOLLOW_NEAR = 1.05;
const FOLLOW_FAR = 1.55;
const SPEED_PER_MS = 2.6 / 1_000;
const MAX_DT_MS = 100;

function finite(value: number, fallback: number): number { return Number.isFinite(value) ? value : fallback; }

function moveToward(from: FarmCompanionPosition, target: FarmCompanionPosition, dtMs: number): FarmCompanionPosition {
  const dx = target.x - from.x; const dy = target.y - from.y; const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return { ...target };
  const step = Math.min(distance, SPEED_PER_MS * Math.max(0, Math.min(MAX_DT_MS, finite(dtMs, 0))));
  return { x: from.x + dx / distance * step, y: from.y + dy / distance * step };
}

/** Runtime-only fetch sequence. It deliberately has no pathfinding or save authority. */
export function advanceFarmCompanionFetch(
  state: FarmCompanionState,
  fetch: FarmCompanionFetchState,
  farmer: FarmCompanionPosition,
  home: FarmCompanionPosition,
  dtMs: number,
  now: number,
): { scout: FarmCompanionState; fetch: FarmCompanionFetchState | null } {
  const current = { x: finite(state.x, home.x), y: finite(state.y, home.y) };
  if (fetch.phase === 'pickup') {
    if (now - fetch.phaseStartedAt < 520) return { scout: { ...current, mode: 'follow', moving: false }, fetch };
    return { scout: { ...current, mode: 'follow', moving: false }, fetch: { ...fetch, phase: 'returning', phaseStartedAt: now } };
  }
  const target = fetch.phase === 'outbound' ? fetch.target : farmer;
  const next = moveToward(current, target, dtMs);
  const arrived = Math.hypot(target.x - next.x, target.y - next.y) < .03;
  if (!arrived) return { scout: { ...next, mode: 'follow', moving: true }, fetch };
  if (fetch.phase === 'outbound') return { scout: { ...target, mode: 'follow', moving: false }, fetch: { ...fetch, phase: 'pickup', phaseStartedAt: now } };
  return { scout: { ...target, mode: 'follow', moving: false }, fetch: null };
}

export function updateFarmCompanion(
  state: FarmCompanionState,
  farmer: FarmCompanionPosition,
  home: FarmCompanionPosition,
  dtMs: number,
  tractorMode: boolean,
): FarmCompanionState {
  const current = { x: finite(state.x, home.x), y: finite(state.y, home.y) };
  const target = tractorMode ? home : farmer;
  const distance = Math.hypot(target.x - current.x, target.y - current.y);
  if (!tractorMode && distance >= FOLLOW_NEAR && distance <= FOLLOW_FAR) return { ...current, mode: 'follow', moving: false };
  if ((tractorMode && distance < 0.03) || (!tractorMode && distance < FOLLOW_NEAR)) return { ...current, mode: tractorMode ? 'home' : 'follow', moving: false };
  const next = moveToward(current, target, dtMs);
  return { ...next, mode: tractorMode ? 'home' : 'follow', moving: next.x !== current.x || next.y !== current.y };
}
