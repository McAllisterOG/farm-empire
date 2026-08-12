import { FARMER_KNOWLEDGE_LEVELS, type FarmerKnowledgeLevelDef } from '../data/farmKnowledge.data';
import type { GameState } from './types';

export type FarmGuideStepId = 'plant' | 'harvest' | 'load' | 'town' | 'trade' | 'expand';

export interface FarmGuideStep {
  id: FarmGuideStepId;
  label: string;
  hint: string;
  done: boolean;
}

export interface FarmerKnowledgeSummary {
  points: number;
  level: FarmerKnowledgeLevelDef;
  nextLevel: FarmerKnowledgeLevelDef | null;
  pointsIntoLevel: number;
  pointsForLevel: number;
}

function safeStat(state: GameState, key: string): number {
  const value = state.stats?.[key];
  return Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
}

export function recordFarmStat(state: GameState, key: string, amount = 1): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.stats[key] = safeStat(state, key) + Math.floor(amount);
}

function cropUnitsInRecord(record: Record<string, number> | undefined): number {
  if (!record) return 0;
  return Object.values(record).reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0), 0);
}

export function farmGuideSteps(state: GameState): readonly FarmGuideStep[] {
  const farm = state.farm;
  if (!farm) return [];
  const plantedNow = state.plots.some((plot) => !!plot.crop);
  const storedNow = cropUnitsInRecord(farm.storage);
  const hauledNow = cropUnitsInRecord(farm.pickup.cargo.crops);
  const planted = safeStat(state, 'plantings') > 0 || plantedNow || storedNow > 0 || hauledNow > 0;
  const harvested = safeStat(state, 'harvests') > 0 || storedNow > 0 || hauledNow > 0 || farm.townContact.status === 'completed';
  const loaded = safeStat(state, 'farmCargoLoads') > 0 || hauledNow > 0 || farm.townContact.status === 'completed';
  const visited = safeStat(state, 'farmTownVisits') > 0 || farm.townContact.status !== 'unmet';
  const traded = safeStat(state, 'itemsSold') > 0 || farm.townContact.status === 'completed';
  return [
    { id: 'plant', label: 'Plant a field section', hint: 'Pick a crop below, then click open soil.', done: planted },
    { id: 'harvest', label: 'Harvest into the barn', hint: 'A ready marker appears above mature crops.', done: harvested },
    { id: 'load', label: 'Load the pickup', hint: 'Park beside the barn, then click the truck or barn.', done: loaded },
    { id: 'town', label: 'Reach County services', hint: 'Click the road gate; drive for cargo service.', done: visited },
    { id: 'trade', label: 'Complete a sale or delivery', hint: 'Eli handles crops at the Grain Exchange.', done: traded },
    { id: 'expand', label: 'Buy neighboring acreage', hint: 'Click the locked field or use the farmhouse records.', done: farm.parcels.northOwned },
  ];
}

export function nextFarmGuideStep(state: GameState): FarmGuideStep | null {
  return farmGuideSteps(state).find((step) => !step.done) ?? null;
}

export function farmKnowledgePoints(state: GameState): number {
  if (!state.farm) return 0;
  const farm = state.farm;
  let points = 0;
  points += Math.min(30, safeStat(state, 'plantings'));
  points += Math.min(50, safeStat(state, 'harvests') * 2);
  points += Math.min(20, safeStat(state, 'farmCargoLoads') * 2);
  points += Math.min(20, safeStat(state, 'farmTownVisits') * 2);
  points += Math.min(30, safeStat(state, 'itemsSold'));
  points += Math.min(30, safeStat(state, 'farmTractorSections'));
  if (farm.townContact.status === 'active') points += 8;
  if (farm.townContact.status === 'completed') points += 20;
  if (farm.parcels.northOwned) points += 25;
  if (farm.equipment.countyRowCropFieldKitOwned) points += 15;
  if (farm.equipment.barnLoftExpansionOwned) points += 15;
  return points;
}

export function farmerKnowledgeSummary(state: GameState): FarmerKnowledgeSummary {
  const points = farmKnowledgePoints(state);
  let level = FARMER_KNOWLEDGE_LEVELS[0];
  for (const candidate of FARMER_KNOWLEDGE_LEVELS) if (points >= candidate.minPoints) level = candidate;
  const nextLevel = FARMER_KNOWLEDGE_LEVELS.find((candidate) => candidate.minPoints > points) ?? null;
  const nextThreshold = nextLevel?.minPoints ?? level.minPoints;
  return {
    points,
    level,
    nextLevel,
    pointsIntoLevel: Math.max(0, points - level.minPoints),
    pointsForLevel: nextLevel ? Math.max(1, nextThreshold - level.minPoints) : 1,
  };
}

