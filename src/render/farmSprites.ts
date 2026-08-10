/** Bounded presentation keys; never include coordinates or timestamps. */
export type FarmFacing = 'south' | 'north' | 'east' | 'west';
export type FarmSpriteFrame = 0 | 1 | 2 | 3;
export function farmFarmerSpriteKey(facing: FarmFacing, frame: FarmSpriteFrame): string {
  return `farm:farmer:${facing}:${frame}`;
}
export function farmScoutSpriteKey(frame: FarmSpriteFrame): string { return `farm:scout:${frame}`; }
