import type { FarmFacing } from './farmSprites';

export type CountyLifeActorKind = 'stand-customer' | 'town-shopper' | 'town-neighbor';

export interface CountyLifeActor {
  id: string;
  kind: CountyLifeActorKind;
  x: number;
  y: number;
  facing: FarmFacing;
  walking: boolean;
}

interface RoutePoint { x: number; y: number }

interface RoutePose extends RoutePoint {
  facing: FarmFacing;
  walking: boolean;
}

interface RouteOptions {
  speed: number;
  startPauseSeconds: number;
  endPauseSeconds: number;
  phaseSeconds: number;
}

/**
 * Roadside customers use the shoulder beside the County Road. This deliberately
 * stays east of both acreage envelopes and clear of the vehicle gate anchor.
 */
export const FARM_STAND_CUSTOMER_ROUTE: readonly RoutePoint[] = Object.freeze([
  { x: 19.95, y: 9.55 },
  { x: 19.95, y: 10.55 },
  { x: 19.7, y: 11.45 },
  { x: 19.55, y: 12.05 },
]);

/** Authored public-plaza routes. Every point and segment is on the convex walk surface. */
export const TOWN_SHOPPER_ROUTE: readonly RoutePoint[] = Object.freeze([
  { x: 7.3, y: 8.2 },
  { x: 8.6, y: 9.1 },
  { x: 10.3, y: 9.5 },
  { x: 11.6, y: 9.2 },
]);

export const TOWN_NEIGHBOR_ROUTE: readonly RoutePoint[] = Object.freeze([
  { x: 7.8, y: 12.8 },
  { x: 9.3, y: 12.2 },
  { x: 10.8, y: 12.5 },
  { x: 12.8, y: 13.1 },
]);

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function phaseFor(seed: number, day: number, salt: number, spanSeconds: number): number {
  const mixed = Math.imul(seed | 0, 1_103_515_245)
    ^ Math.imul(day | 0, 12_345)
    ^ Math.imul(salt, 2_654_435_761);
  return (mixed >>> 0) / 0x1_0000_0000 * spanSeconds;
}

function facingForDelta(dx: number, dy: number): FarmFacing {
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? 'east' : 'west')
    : (dy >= 0 ? 'south' : 'north');
}

function routeLengths(route: readonly RoutePoint[]): { segments: number[]; total: number } {
  const segments = route.slice(1).map((point, index) => Math.hypot(
    point.x - route[index].x,
    point.y - route[index].y,
  ));
  return { segments, total: segments.reduce((sum, length) => sum + length, 0) };
}

function sampleRouteDistance(route: readonly RoutePoint[], segments: readonly number[], distance: number): RoutePose {
  let remaining = Math.max(0, distance);
  for (let index = 0; index < segments.length; index++) {
    const start = route[index]; const end = route[index + 1]; const length = segments[index];
    if (remaining <= length || index === segments.length - 1) {
      const t = length <= .000001 ? 1 : Math.min(1, remaining / length);
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        facing: facingForDelta(end.x - start.x, end.y - start.y),
        walking: true,
      };
    }
    remaining -= length;
  }
  const last = route[route.length - 1]; const before = route[route.length - 2];
  return { ...last, facing: facingForDelta(last.x - before.x, last.y - before.y), walking: false };
}

/** Smooth, deterministic there-and-back motion with a natural pause at each destination. */
export function sampleCountyLifeRoute(route: readonly RoutePoint[], now: number, options: RouteOptions): RoutePose {
  if (route.length < 2) throw new Error('County Life routes require at least two points.');
  const { segments, total } = routeLengths(route);
  const travelSeconds = total / Math.max(.01, options.speed);
  const cycleSeconds = options.startPauseSeconds + travelSeconds + options.endPauseSeconds + travelSeconds;
  let elapsed = positiveModulo(now / 1_000 + options.phaseSeconds, cycleSeconds);
  if (elapsed < options.startPauseSeconds) {
    const start = route[0]; const next = route[1];
    return { ...start, facing: facingForDelta(next.x - start.x, next.y - start.y), walking: false };
  }
  elapsed -= options.startPauseSeconds;
  if (elapsed < travelSeconds) return sampleRouteDistance(route, segments, elapsed * options.speed);
  elapsed -= travelSeconds;
  if (elapsed < options.endPauseSeconds) {
    const end = route[route.length - 1]; const before = route[route.length - 2];
    return { ...end, facing: facingForDelta(end.x - before.x, end.y - before.y), walking: false };
  }
  elapsed -= options.endPauseSeconds;
  const reverse = [...route].reverse();
  const reverseLengths = [...segments].reverse();
  return sampleRouteDistance(reverse, reverseLengths, Math.min(travelSeconds, elapsed) * options.speed);
}

function inDaylight(clockMinute: number, startHour: number, endHour: number): boolean {
  return clockMinute >= startHour * 60 && clockMinute < endHour * 60;
}

export function roadsideCustomerActors(
  seed: number,
  day: number,
  clockMinute: number,
  now: number,
  standOpen: boolean,
): CountyLifeActor[] {
  if (!standOpen || !inDaylight(clockMinute, 8, 20)) return [];
  const phaseSeconds = phaseFor(seed, day, 17, 24);
  return [{
    id: 'roadside-customer',
    kind: 'stand-customer',
    ...sampleCountyLifeRoute(FARM_STAND_CUSTOMER_ROUTE, now, {
      speed: .58,
      startPauseSeconds: 5,
      endPauseSeconds: 13,
      phaseSeconds,
    }),
  }];
}

export function townCountyLifeActors(seed: number, day: number, clockMinute: number, now: number): CountyLifeActor[] {
  if (!inDaylight(clockMinute, 7, 22)) return [];
  return [
    {
      id: 'town-shopper',
      kind: 'town-shopper',
      ...sampleCountyLifeRoute(TOWN_SHOPPER_ROUTE, now, {
        speed: .72,
        startPauseSeconds: 3,
        endPauseSeconds: 7,
        phaseSeconds: phaseFor(seed, day, 29, 31),
      }),
    },
    {
      id: 'town-neighbor',
      kind: 'town-neighbor',
      ...sampleCountyLifeRoute(TOWN_NEIGHBOR_ROUTE, now, {
        speed: .52,
        startPauseSeconds: 6,
        endPauseSeconds: 8,
        phaseSeconds: phaseFor(seed, day, 43, 37),
      }),
    },
  ];
}
