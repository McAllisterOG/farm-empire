import { FARM_VEHICLE_MOVEMENT_BOUNDS } from './farmPickupData';

export interface FarmVehiclePoint { x: number; y: number }

export interface FarmDirectionRoutingContext {
  mode: 'farm' | 'town';
  operatingVehicle: boolean;
  tractorFieldJobActive: boolean;
  panelOpen: boolean;
  actionMenuOpen: boolean;
  activeOwnerWork: boolean;
}

export type FarmDirectionalInputRoute = 'vehicle' | 'camera' | 'blocked' | 'none';

const KEY_DELTAS: Readonly<Record<string, Readonly<FarmVehiclePoint>>> = Object.freeze({
  w: { x: -1, y: -1 }, arrowup: { x: -1, y: -1 },
  s: { x: 1, y: 1 }, arrowdown: { x: 1, y: 1 },
  a: { x: -1, y: 1 }, arrowleft: { x: -1, y: 1 },
  d: { x: 1, y: -1 }, arrowright: { x: 1, y: -1 },
});

/** Maps a case-insensitive screen-relative steering key to a short logical target. */
export function farmVehicleControlTarget(key: unknown, current: Readonly<FarmVehiclePoint>, step = 1): FarmVehiclePoint | null {
  if (typeof key !== 'string') return null;
  const delta = KEY_DELTAS[key.toLowerCase()];
  if (!delta || !Number.isFinite(current.x) || !Number.isFinite(current.y) || !Number.isFinite(step) || step <= 0) return null;
  const bounds = FARM_VEHICLE_MOVEMENT_BOUNDS;
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, current.x + delta.x * step)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, current.y + delta.y * step)),
  };
}

export function farmDirectionalInputRoute(key: unknown, context: Readonly<FarmDirectionRoutingContext>): FarmDirectionalInputRoute {
  if (!farmVehicleControlTarget(key, { x: 12, y: 12 })) return 'none';
  if (context.mode !== 'farm') return 'none';
  if (context.tractorFieldJobActive || context.panelOpen || context.actionMenuOpen || context.activeOwnerWork) return 'blocked';
  return context.operatingVehicle ? 'vehicle' : 'camera';
}

/** Keeps directional input in the established camera path unless farm driving is safely available. */
export function shouldRouteDirectionToFarmVehicle(context: Readonly<FarmDirectionRoutingContext>): boolean {
  return farmDirectionalInputRoute('w', context) === 'vehicle';
}

/** Only a standard secondary-button release receives move-only routing. */
export function isMoveOnlyPointerButton(button: number): boolean {
  return button === 2;
}

/** A secondary release only completes when it was armed apart from a primary drag. */
export function shouldCompleteMoveOnlyGesture(secondaryGestureArmed: boolean, primaryDragging: boolean): boolean {
  return secondaryGestureArmed && !primaryDragging;
}

/** Move-only farm gestures may target only open ground, never an interaction silhouette. */
export function isMoveOnlyFarmGround(interactionKind: unknown): boolean {
  return interactionKind === null || interactionKind === undefined;
}
