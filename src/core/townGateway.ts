import type { GameState } from './types';

export interface TownTravelRuntime {
  operatingTractor: boolean;
  tractorMoving: boolean;
  tractorJobActive: boolean;
}

/** Logical farm coordinates. Town scene coordinates are deliberately separate. */
export const FARM_TOWN_GATE = Object.freeze({ x: 13.4, y: 7.0 });
export const FARM_TOWN_RETURN = Object.freeze({ x: 13.05, y: 7.55 });

export function townTravelBlockReason(runtime: TownTravelRuntime): string | null {
  if (runtime.tractorJobActive) return 'Finish or cancel the active field job before heading to town.';
  if (runtime.tractorMoving) return 'Park the tractor before heading to town.';
  if (runtime.operatingTractor) return 'Exit the tractor before heading to town.';
  return null;
}

/** Town is transient; saves made there always reload at this safe farm anchor. */
export function placePlayerAtTownReturn(state: GameState): { x: number; y: number } {
  state.player.px = FARM_TOWN_RETURN.x;
  state.player.py = FARM_TOWN_RETURN.y;
  return { ...FARM_TOWN_RETURN };
}
