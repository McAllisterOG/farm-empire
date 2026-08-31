import type { FarmFacing } from '../render/farmSprites';

export type TownServiceId = 'seed-supplier' | 'commodity-market' | 'farm-services' | 'county-kitchen';
export type TownNpcStyle = 'supply-clerk' | 'grain-buyer' | 'service-manager' | 'kitchen-host';
export type TownEdgeHomeStyle = 'porch-cottage' | 'garden-bungalow' | 'brick-duplex' | 'farmhouse-cottage';
export type TownEdgeDecorKind = 'laundry-line' | 'mailbox' | 'vegetable-patch' | 'bicycle' | 'birdbath';

export interface TownPoint { x: number; y: number }

export interface TownBuildingDef {
  id: 'miller-feed-seed' | 'county-grain-exchange' | 'farm-services-cooperative' | 'county-pantry-kitchen';
  name: string;
  sign: string;
  service: TownServiceId;
  x: number;
  y: number;
  w: number;
  h: number;
  door: TownPoint;
}

export interface TownNpcDef extends TownPoint {
  id: 'nora-bell' | 'eli-morgan' | 'mae-carter' | 'rosa-alvarez';
  name: string;
  role: string;
  style: TownNpcStyle;
  facing: FarmFacing;
  service: TownServiceId;
}

export const TOWN_SERVICE_IDS: readonly TownServiceId[] = [
  'seed-supplier', 'commodity-market', 'farm-services',
  'county-kitchen',
] as const;

/** Exactly four visible buildings, each backed by a real Farm Empire service. */
export const TOWN_BUILDINGS: readonly TownBuildingDef[] = [
  {
    id: 'miller-feed-seed', name: 'Miller Feed & Seed', sign: 'FEED & SEED', service: 'seed-supplier',
    x: 3, y: 3, w: 4, h: 2.8, door: { x: 5, y: 6.3 },
  },
  { id: 'county-pantry-kitchen', name: 'County Pantry & Kitchen', sign: 'PANTRY & KITCHEN', service: 'county-kitchen', x: 22, y: 7, w: 4.8, h: 3.3, door: { x: 24.4, y: 10.85 } },
  {
    id: 'county-grain-exchange', name: 'County Grain Exchange', sign: 'GRAIN EXCHANGE', service: 'commodity-market',
    x: 9, y: 2.5, w: 5, h: 3.5, door: { x: 11.5, y: 6.8 },
  },
  {
    id: 'farm-services-cooperative', name: 'Farm Services Cooperative', sign: 'FARM SERVICES', service: 'farm-services',
    x: 16, y: 3.2, w: 5, h: 3.5, door: { x: 18.5, y: 7.55 },
  },
] as const;

/** Exactly one functional townsperson for each visible service building. */
export const TOWN_NPCS: readonly TownNpcDef[] = [
  {
    id: 'nora-bell', name: 'Nora Bell', role: 'Supply clerk', style: 'supply-clerk',
    x: 6, y: 7.1, facing: 'south', service: 'seed-supplier',
  },
  {
    id: 'eli-morgan', name: 'Eli Morgan', role: 'Grain buyer', style: 'grain-buyer',
    x: 12.7, y: 7.7, facing: 'south', service: 'commodity-market',
  },
  {
    id: 'mae-carter', name: 'Mae Carter', role: 'Farm services manager', style: 'service-manager',
    x: 17.5, y: 9.2, facing: 'west', service: 'farm-services',
  },
  { id: 'rosa-alvarez', name: 'Rosa Alvarez', role: 'County kitchen host', style: 'kitchen-host', x: 24.8, y: 11.8, facing: 'west', service: 'county-kitchen' },
] as const;

export const TOWN_DECOR = [
  { id: 'lamp-west', kind: 'lamp', x: 7.2, y: 10.1 },
  { id: 'lamp-east', kind: 'lamp', x: 20.8, y: 11.1 },
  { id: 'bench-square', kind: 'bench', x: 11.2, y: 11.8 },
  { id: 'seed-sacks', kind: 'sacks', x: 7.6, y: 8.7 },
  { id: 'grain-pallet', kind: 'pallet', x: 10.1, y: 7.0 },
  { id: 'service-tires', kind: 'tires', x: 20.5, y: 8.8 },
  { id: 'planter-market', kind: 'pallet', x: 15.2, y: 14.8 },
] as const;

export type TownDecorDef = typeof TOWN_DECOR[number];

/**
 * Fixed edge scenery deliberately paints before the town's interactive depth
 * queue. These are homes and exterior cues only, never buildings or targets.
 */
export interface TownEdgeHomeDef extends TownPoint {
  id: 'west-porch-cottage' | 'south-garden-bungalow' | 'north-brick-duplex' | 'east-farmhouse-cottage';
  style: TownEdgeHomeStyle;
}

export interface TownEdgeDecorDef extends TownPoint {
  id: 'porch-mailbox' | 'garden-laundry' | 'duplex-bicycle' | 'farmhouse-vegetables' | 'farmhouse-birdbath';
  kind: TownEdgeDecorKind;
}

export const TOWN_EDGE_HOMES: readonly TownEdgeHomeDef[] = [
  { id: 'west-porch-cottage', style: 'porch-cottage', x: 4, y: 16.3 },
  { id: 'south-garden-bungalow', style: 'garden-bungalow', x: 14.9, y: 18.05 },
  { id: 'north-brick-duplex', style: 'brick-duplex', x: 27.4, y: 6.1 },
  { id: 'east-farmhouse-cottage', style: 'farmhouse-cottage', x: 27.1, y: 15.7 },
] as const;

/** Small private-yard cues with no service or walk-surface meaning. */
export const TOWN_EDGE_DECOR: readonly TownEdgeDecorDef[] = [
  { id: 'porch-mailbox', kind: 'mailbox', x: 3.15, y: 15.55 },
  { id: 'garden-laundry', kind: 'laundry-line', x: 13.45, y: 17.85 },
  { id: 'duplex-bicycle', kind: 'bicycle', x: 28.45, y: 6.75 },
  { id: 'farmhouse-vegetables', kind: 'vegetable-patch', x: 28.4, y: 15.05 },
  { id: 'farmhouse-birdbath', kind: 'birdbath', x: 28.3, y: 16.7 },
] as const;

export function townBuildingById(id: TownBuildingDef['id']): TownBuildingDef {
  const building = TOWN_BUILDINGS.find((candidate) => candidate.id === id);
  if (!building) throw new Error(`unknown town building: ${id}`);
  return building;
}

export function townNpcById(id: TownNpcDef['id']): TownNpcDef {
  const npc = TOWN_NPCS.find((candidate) => candidate.id === id);
  if (!npc) throw new Error(`unknown town NPC: ${id}`);
  return npc;
}
