/**
 * Runtime-only tractor travel.  This deliberately models presentation motion,
 * not collision physics or a new saved vehicle system.
 */
export interface TractorPoint { x: number; y: number }

export interface TractorMotion {
  headingX: number;
  headingY: number;
  speed: number;
  steer: number;
  wheelPhase: number;
}

export interface TractorMotionStep {
  position: TractorPoint;
  motion: TractorMotion;
  arrived: boolean;
}

export const TRACTOR_MAX_SPEED = 3.6 / 1_000;
const TRACTOR_ACCELERATION = 0.014 / 1_000;
const TRACTOR_BRAKING = 0.020 / 1_000;
const TURN_RATE_PER_MS = 0.010;

export function createTractorMotion(): TractorMotion {
  return { headingX: 1, headingY: 0, speed: 0, steer: 0, wheelPhase: 0 };
}

export function resetTractorMotion(motion: TractorMotion): TractorMotion {
  return { ...motion, speed: 0, steer: 0 };
}

/** Advances exactly toward a click/job target while heading turns smoothly for presentation. */
export function advanceTractorMotion(
  position: TractorPoint,
  target: TractorPoint,
  motion: TractorMotion,
  deltaMs: number,
): TractorMotionStep {
  const dt = Math.max(0, Math.min(100, deltaMs));
  const dx = target.x - position.x; const dy = target.y - position.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.00001) return { position: { ...target }, motion: resetTractorMotion(motion), arrived: true };

  const desiredX = dx / distance; const desiredY = dy / distance;
  const currentAngle = Math.atan2(motion.headingY, motion.headingX);
  const desiredAngle = Math.atan2(desiredY, desiredX);
  const angularDelta = shortestTurn(desiredAngle - currentAngle);
  const turn = clamp(angularDelta, -TURN_RATE_PER_MS * dt, TURN_RATE_PER_MS * dt);
  const headingX = Math.cos(currentAngle + turn); const headingY = Math.sin(currentAngle + turn);
  const steer = clamp(angularDelta / (Math.PI / 2), -1, 1);
  const brakingSpeed = Math.sqrt(2 * TRACTOR_BRAKING * distance);
  const targetSpeed = Math.min(TRACTOR_MAX_SPEED, brakingSpeed);
  const rate = targetSpeed < motion.speed ? TRACTOR_BRAKING : TRACTOR_ACCELERATION;
  const speed = approach(motion.speed, targetSpeed, rate * dt);
  const travel = Math.min(distance, speed * dt);
  const next = travel >= distance - 0.00001
    ? { ...target }
    : { x: position.x + desiredX * travel, y: position.y + desiredY * travel };
  const wheelPhase = (motion.wheelPhase + travel * 14) % (Math.PI * 2);
  const nextMotion = { headingX, headingY, speed, steer, wheelPhase };
  if (travel >= distance - 0.00001) return { position: { ...target }, motion: resetTractorMotion(nextMotion), arrived: true };
  return { position: next, motion: nextMotion, arrived: false };
}

function approach(value: number, target: number, amount: number): number {
  return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Normalizes an angular delta with a stable counter-clockwise exact-reversal tie-break. */
function shortestTurn(delta: number): number {
  const wrapped = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return Math.abs(Math.abs(wrapped) - Math.PI) < 0.000001 ? Math.PI : wrapped;
}
