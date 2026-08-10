/** Deterministic, transient companion movement for the Farm Empire presentation. */
export type FarmCompanionMode = 'follow' | 'home';
export interface FarmCompanionPosition { x: number; y: number }
export interface FarmCompanionState extends FarmCompanionPosition { mode: FarmCompanionMode; moving: boolean }

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
