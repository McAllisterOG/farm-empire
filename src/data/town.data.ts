import type { FarmFacing } from '../render/farmSprites';

export type TownServiceId = 'seed-supplier' | 'commodity-market' | 'farm-services';
export type TownNpcStyle = 'supply-clerk' | 'grain-buyer' | 'service-manager';

export interface TownPoint { x: number; y: number }

export interface TownBuildingDef {
  id: 'miller-feed-seed' | 'county-grain-exchange' | 'farm-services-cooperative';
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
  id: 'nora-bell' | 'eli-morgan' | 'mae-carter';
  name: string;
  role: string;
  style: TownNpcStyle;
  facing: FarmFacing;
  service: TownServiceId;
}

export const TOWN_SERVICE_IDS: readonly TownServiceId[] = [
  'seed-supplier', 'commodity-market', 'farm-services',
] as const;

/** Exactly three visible buildings, each backed by a real Farm Empire service. */
export const TOWN_BUILDINGS: readonly TownBuildingDef[] = [
  {
    id: 'miller-feed-seed', name: 'Miller Feed & Seed', sign: 'FEED & SEED', service: 'seed-supplier',
    x: 3, y: 3, w: 4, h: 2.8, door: { x: 5, y: 6.3 },
  },
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
] as const;

export const TOWN_DECOR = [
  { id: 'lamp-west', kind: 'lamp', x: 7.2, y: 10.1 },
  { id: 'lamp-east', kind: 'lamp', x: 16.8, y: 11.1 },
  { id: 'bench-square', kind: 'bench', x: 11.2, y: 11.8 },
  { id: 'seed-sacks', kind: 'sacks', x: 4.1, y: 6.7 },
  { id: 'grain-pallet', kind: 'pallet', x: 10.1, y: 7.0 },
  { id: 'service-tires', kind: 'tires', x: 19.7, y: 8.8 },
] as const;

export type TownDecorDef = typeof TOWN_DECOR[number];

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
