/**
 * Farm-only crop presentation.  This is deliberately runtime data rather than
 * save data: crop identity remains authoritative in the Farm crop catalog.
 */
export type FarmCropSilhouette = 'corn' | 'wheat' | 'soybean' | 'potato' | 'carrot' | 'tomato' | 'cabbage' | 'pumpkin';

export interface FarmCropVisual {
  readonly silhouette: FarmCropSilhouette;
  readonly stem: string;
  readonly leaf: string;
  readonly produce: string;
  readonly matureScale: number;
  readonly baseHeight: number;
  readonly columns: number;
  readonly rows: number;
}

const visual = (value: FarmCropVisual): FarmCropVisual => Object.freeze(value);

export const FARM_CROP_VISUALS: Readonly<Record<string, FarmCropVisual>> = Object.freeze({
  crop_corn: visual({ silhouette: 'corn', stem: '#476b32', leaf: '#6f9f3f', produce: '#efc84d', matureScale: 1.12, baseHeight: 48, columns: 4, rows: 3 }),
  crop_wheat: visual({ silhouette: 'wheat', stem: '#8b7638', leaf: '#b9a44b', produce: '#edcf6c', matureScale: 1.04, baseHeight: 34, columns: 5, rows: 4 }),
  crop_soybean: visual({ silhouette: 'soybean', stem: '#4c713b', leaf: '#78a353', produce: '#c7cf72', matureScale: 1.04, baseHeight: 32, columns: 4, rows: 3 }),
  crop_potato: visual({ silhouette: 'potato', stem: '#587746', leaf: '#719854', produce: '#b68a5a', matureScale: .96, baseHeight: 29, columns: 4, rows: 3 }),
  crop_carrot: visual({ silhouette: 'carrot', stem: '#4f7b45', leaf: '#6eaa58', produce: '#eb8035', matureScale: 1.03, baseHeight: 31, columns: 5, rows: 4 }),
  crop_tomato: visual({ silhouette: 'tomato', stem: '#4d763f', leaf: '#63924a', produce: '#dc5141', matureScale: 1.05, baseHeight: 38, columns: 4, rows: 3 }),
  crop_cabbage: visual({ silhouette: 'cabbage', stem: '#567a45', leaf: '#79a85c', produce: '#aecb78', matureScale: 1.12, baseHeight: 27, columns: 4, rows: 3 }),
  crop_pumpkin: visual({ silhouette: 'pumpkin', stem: '#597540', leaf: '#6d9846', produce: '#e48638', matureScale: 1.13, baseHeight: 25, columns: 4, rows: 3 }),
});

const FALLBACK_VISUAL: FarmCropVisual = FARM_CROP_VISUALS.crop_corn;

export function farmCropVisualFor(cropId: string): FarmCropVisual {
  return FARM_CROP_VISUALS[cropId] ?? FALLBACK_VISUAL;
}

/** Produce is a truthful harvest-readiness cue, never a size heuristic. */
export function isFarmCropRipeStage(stage: string): boolean {
  return stage === 'ready';
}
