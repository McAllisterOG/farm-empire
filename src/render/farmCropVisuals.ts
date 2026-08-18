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
}

const visual = (value: FarmCropVisual): FarmCropVisual => Object.freeze(value);

export const FARM_CROP_VISUALS: Readonly<Record<string, FarmCropVisual>> = Object.freeze({
  crop_corn: visual({ silhouette: 'corn', stem: '#52743a', leaf: '#76a34a', produce: '#e4bd43', matureScale: 1.18 }),
  crop_wheat: visual({ silhouette: 'wheat', stem: '#8b7638', leaf: '#b9a44b', produce: '#e7ca69', matureScale: 1.04 }),
  crop_soybean: visual({ silhouette: 'soybean', stem: '#557a42', leaf: '#78a353', produce: '#b9c56a', matureScale: 1.04 }),
  crop_potato: visual({ silhouette: 'potato', stem: '#587746', leaf: '#719854', produce: '#b68a5a', matureScale: .96 }),
  crop_carrot: visual({ silhouette: 'carrot', stem: '#4f7b45', leaf: '#6eaa58', produce: '#e27e35', matureScale: 1.03 }),
  crop_tomato: visual({ silhouette: 'tomato', stem: '#4d763f', leaf: '#63924a', produce: '#d94f3f', matureScale: 1.05 }),
  crop_cabbage: visual({ silhouette: 'cabbage', stem: '#567a45', leaf: '#79a85c', produce: '#a1bb68', matureScale: 1.12 }),
  crop_pumpkin: visual({ silhouette: 'pumpkin', stem: '#597540', leaf: '#6d9846', produce: '#df8135', matureScale: 1.13 }),
});

const FALLBACK_VISUAL: FarmCropVisual = FARM_CROP_VISUALS.crop_corn;

export function farmCropVisualFor(cropId: string): FarmCropVisual {
  return FARM_CROP_VISUALS[cropId] ?? FALLBACK_VISUAL;
}

/** Produce is a truthful harvest-readiness cue, never a size heuristic. */
export function isFarmCropRipeStage(stage: string): boolean {
  return stage === 'ready';
}
