import type {
  ActionResult, ActiveFarmMarketEvent, FarmBusinessState, FarmFieldCondition, FarmPlot, GameState,
} from './types';
import { allFarmCrops, allFarmMarketEvents, farmCropDef, farmCropDefOrNull, farmMarketEventDef } from './registry';
import { hashSeed, mulberry32 } from './rng';
import { fail } from './types';
import { BARN_LOFT_EXPANSION, COUNTY_GRAIN_SILO, COUNTY_HARVEST_WAGON, COUNTY_ROW_CROP_FIELD_KIT, COUNTY_UTILITY_TRAILER, OLD_TRACTOR_RESTORATION } from '../data/farmEquipment.data';
import { COUNTY_FREIGHT_BULK_PREMIUM_BPS, COUNTY_FREIGHT_PREMIUM_BPS, COUNTY_FREIGHT_TEMPLATES, countyFreightBulkAllowedUnits } from '../data/countyFreight.data';
import { PICKUP_BASE_CARGO_CAPACITY, PICKUP_CARGO_CAPACITY, PICKUP_ID, PICKUP_NAME, PICKUP_START, PICKUP_TRAILER_CARGO_CAPACITY, emptyPickupCargo, sanitizePickupPosition } from './farmPickupData';
import { HAND_BASKET_CAPACITY, emptyHandBasket } from './farmHarvestBasketData';
import {
  STARTER_FIELD_TILES, ensureOwnedFarmParcelPlots, farmParcelAtTile,
  farmParcelSectionCount, farmParcelTiles, type FarmParcelId,
} from './farmParcels';
import { recordFarmStat } from './farmKnowledge';
import { formatFarmCargoWeight } from './farmCargoScale';

export { NEIGHBOR_FIELD_TILES, STARTER_FIELD_TILES } from './farmParcels';
export type { FarmParcelId } from './farmParcels';

export const STARTING_CASH_CENTS = 500_000;
export const STARTING_STORAGE_CAPACITY = 480;
export const FIRST_PARCEL_PRICE_CENTS = 425_000;
export const GAME_MINUTES_PER_REAL_SECOND = 8;
export const FARM_MARKET_MAX_MULTIPLIER = 1.55;
export const BASIC_HARVEST_WAGON_CAPACITY = 240;
export const COUNTY_HARVEST_WAGON_CAPACITY = 480;

/** V20's last shipped Farm Empire yields; only these legacy snapshots remain valid in v21. */
export const FARM_V1_HARVEST_YIELD_ITEMS = Object.freeze({
  crop_corn: 8, crop_wheat: 7, crop_soybean: 9, crop_potato: 10,
  crop_carrot: 6, crop_tomato: 18, crop_cabbage: 8, crop_pumpkin: 8,
} as const);

export interface CanonicalFarmHarvestBalance {
  harvestYieldItems: number;
  harvestBalanceVersion: 1 | 2;
}

/** Accept only a provenance-matched current V2 yield or explicit V1 migration snapshot. */
export function canonicalFarmHarvestBalance(crop: FarmPlot['crop']): CanonicalFarmHarvestBalance {
  if (!crop) return { harvestYieldItems: 0, harvestBalanceVersion: 2 };
  const def = farmCropDefOrNull(crop.defId);
  if (!def) return { harvestYieldItems: 0, harvestBalanceVersion: 2 };
  const pinned = crop.harvestYieldItems;
  const legacy = FARM_V1_HARVEST_YIELD_ITEMS[def.id as keyof typeof FARM_V1_HARVEST_YIELD_ITEMS];
  if (crop.harvestBalanceVersion === 1 && pinned === legacy) return { harvestYieldItems: legacy, harvestBalanceVersion: 1 };
  if (crop.harvestBalanceVersion === 2 && pinned === def.harvestYield) return { harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2 };
  return { harvestYieldItems: def.harvestYield, harvestBalanceVersion: 2 };
}

/** Safe read for every harvest and capacity authority. */
export function pinnedFarmHarvestYield(crop: FarmPlot['crop']): number {
  return canonicalFarmHarvestBalance(crop).harvestYieldItems;
}

function maxFreightPayoutCents(requiredUnits: number, basePriceCents: number, premiumBps: number): number {
  const maxQuote = Math.round(basePriceCents * FARM_MARKET_MAX_MULTIPLIER);
  return Math.max(1, Math.round(requiredUnits * maxQuote * (10_000 + premiumBps) / 10_000));
}

export type ParcelWorkKind = 'plant' | 'harvest';
export type FarmWorkContext = 'manual' | 'operatedTractor';

export interface FarmCropUnlockInfo {
  unlocked: boolean;
  requirement: string;
}

export function farmCropUnlockInfo(state: GameState, cropId: string): FarmCropUnlockInfo {
  const def = farmCropDefOrNull(cropId);
  if (!def) return { unlocked: false, requirement: 'Unknown crop.' };
  if (def.unlock === 'starter') return { unlocked: true, requirement: 'Available from the start.' };
  if (def.unlock === 'county-order') {
    return farmOf(state).townContact.status === 'completed'
      ? { unlocked: true, requirement: 'County Pantry order completed.' }
      : { unlocked: false, requirement: 'Complete the County Pantry corn order.' };
  }
  if (def.unlock === 'north-parcel') {
    return farmOf(state).parcels.northOwned
      ? { unlocked: true, requirement: 'Neighboring parcel owned.' }
      : { unlocked: false, requirement: 'Buy the neighboring parcel.' };
  }
  return farmOf(state).equipment.barnLoftExpansionOwned
    ? { unlocked: true, requirement: 'Barn Loft Expansion owned.' }
    : { unlocked: false, requirement: 'Purchase the Barn Loft Expansion.' };
}

export function isFarmCropUnlocked(state: GameState, cropId: string): boolean {
  return farmCropUnlockInfo(state, cropId).unlocked;
}

export interface ParcelWorkPlan {
  parcelId: FarmParcelId;
  orderedPlotUids: number[];
  plantPlotUids: number[];
  harvestPlotUids: number[];
}

export interface ParcelWorkPlanOptions {
  /** Begin a clicked or dragged job at the section the player actually chose. */
  anchorPlotUid?: number;
  /** Limit powered work to this transient selection without changing parcel ownership. */
  selectedPlotUids?: readonly number[];
}

export const TRACTOR_DISMOUNT_OFFSET = { x: 0.75, y: 0.25 } as const;

/** Stable row-by-row route with alternating direction, independent of plot array order. */
export function serpentineFieldTiles(tiles: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const rows = new Map<number, { x: number; y: number }[]>();
  for (const tile of tiles) {
    const row = rows.get(tile.y) ?? [];
    row.push({ x: tile.x, y: tile.y });
    rows.set(tile.y, row);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, row], rowIndex) => row.sort((a, b) => (
      rowIndex % 2 === 0 ? a.x - b.x : b.x - a.x
    )));
}

function clampInt(value: unknown, fallback: number, min = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.round(n)) : fallback;
}

function clampNumber(value: unknown, fallback: number, min = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function createFarmBusinessState(now: number): FarmBusinessState {
  const quotes: FarmBusinessState['market']['quotes'] = {};
  const seeds: Record<string, number> = {};
  const storage: Record<string, number> = {};
  for (const def of allFarmCrops()) {
    quotes[def.id] = { currentCents: def.basePriceCents, previousCents: def.basePriceCents };
    seeds[def.id] = def.startingSeeds;
    storage[def.id] = 0;
  }
  return {
    cashCents: STARTING_CASH_CENTS,
    seeds,
    storage,
    storageCapacity: STARTING_STORAGE_CAPACITY,
    fieldConditions: {},
    countyReliefClaimed: false,
    pickup: { id: PICKUP_ID, name: PICKUP_NAME, x: PICKUP_START.x, y: PICKUP_START.y, cargo: emptyPickupCargo() },
    handBasket: emptyHandBasket(),
    selectedCropId: 'crop_corn',
    townContact: { status: 'unmet' },
    countyKitchen: { status: 'unmet' },
    countyFreight: { active: null, lastCompletedDay: 0 },
    workforce: { farmhandHired: false, lastShiftPaidDay: 0, manager: { hired: false, enabled: false, parcelId: 'starter', cropId: 'crop_corn', lastReviewedDay: 0 } },
    roadsideStand: { owned: false, lastCompletedDay: 0 },
    clock: { day: 1, minute: 8 * 60, lastRealAt: now },
    market: { quotes, activeEvents: [], lastUpdatedDay: 1 },
    parcels: { starterOwned: true, northOwned: false },
    equipment: {
      countyRowCropFieldKitOwned: false,
      barnLoftExpansionOwned: false,
      countyUtilityTrailerOwned: false,
      countyGrainSiloOwned: false,
      harvestWagon: { owned: false, tier: 'basic', crops: {} },
      tractor: {
        id: 'old-tractor',
        name: 'Old Red Tractor',
        status: 'maintenance',
        x: 9,
        y: 11,
        workSpeedBonusBps: 2_000,
        harvestBonusUnits: 1,
      },
    },
  };
}

function normalizePickup(rawPickup: unknown, capacity: number): FarmBusinessState['pickup'] {
  const raw = objectRecord(rawPickup);
  const rawCargo = objectRecord(raw.cargo);
  const normalizeBag = (value: unknown): Record<string, number> => {
    const source = objectRecord(value);
    const bag: Record<string, number> = {};
    for (const def of allFarmCrops()) {
      const value = source[def.id];
      if (Number.isInteger(value) && Number(value) > 0) bag[def.id] = Number(value);
    }
    return bag;
  };
  const rawCrops = normalizeBag(rawCargo.crops);
  const rawSeeds = normalizeBag(rawCargo.seeds);
  const crops: Record<string, number> = {};
  const seeds: Record<string, number> = {};
  let used = 0;
  for (const def of allFarmCrops()) {
    const cropCount = rawCrops[def.id] ?? 0;
    const available = Math.floor(Math.max(0, capacity - used) / def.storageUnitsPerItem);
    const kept = Math.min(cropCount, available);
    if (kept > 0) crops[def.id] = kept;
    used += kept * def.storageUnitsPerItem;
  }
  for (const def of allFarmCrops()) {
    const available = Math.max(0, capacity - used);
    const kept = Math.min(rawSeeds[def.id] ?? 0, available);
    if (kept > 0) seeds[def.id] = kept;
    used += kept;
  }
  const position = sanitizePickupPosition(raw.x, raw.y);
  return {
    id: PICKUP_ID,
    name: PICKUP_NAME,
    x: position.x,
    y: position.y,
    cargo: { crops, seeds },
  };
}

/**
 * Reorder an already stable field route around the player's chosen section.
 * Each next section is the nearest remaining neighbor, with coordinate/UID
 * tie-breaks so repeated planning is deterministic and never depends on array
 * insertion order.
 */
export function fieldWorkRouteFromAnchor<T extends { uid: number; x: number; y: number }>(
  plots: readonly T[],
  anchorPlotUid: number,
): T[] {
  const remaining = [...plots].sort((a, b) => a.y - b.y || a.x - b.x || a.uid - b.uid);
  const startIndex = remaining.findIndex((plot) => plot.uid === anchorPlotUid);
  if (startIndex < 0) return remaining;
  const route: T[] = [remaining.splice(startIndex, 1)[0]];
  while (remaining.length > 0) {
    const current = route[route.length - 1];
    remaining.sort((a, b) => {
      const aDistance = (a.x - current.x) ** 2 + (a.y - current.y) ** 2;
      const bDistance = (b.x - current.x) ** 2 + (b.y - current.y) ** 2;
      return aDistance - bDistance || a.y - b.y || a.x - b.x || a.uid - b.uid;
    });
    route.push(remaining.shift()!);
  }
  return route;
}

function normalizeHandBasket(rawBasket: unknown): FarmBusinessState['handBasket'] {
  const raw = objectRecord(rawBasket);
  const source = objectRecord(raw.crops);
  const crops: Record<string, number> = {};
  let used = 0;
  for (const def of allFarmCrops()) {
    const count = Number.isInteger(source[def.id]) && Number(source[def.id]) > 0
      ? Number(source[def.id])
      : 0;
    const available = Math.floor(Math.max(0, HAND_BASKET_CAPACITY - used) / def.storageUnitsPerItem);
    const kept = Math.min(count, available);
    if (kept > 0) crops[def.id] = kept;
    used += kept * def.storageUnitsPerItem;
  }
  return {
    crops,
    destination: raw.destination === 'pickup' ? 'pickup' : 'barn',
  };
}

export function harvestWagonCapacity(state: GameState): number {
  return farmOf(state).equipment.harvestWagon.tier === 'county' ? COUNTY_HARVEST_WAGON_CAPACITY : BASIC_HARVEST_WAGON_CAPACITY;
}

export function harvestWagonUsed(state: GameState): number {
  return allFarmCrops().reduce((sum, def) => sum + (farmOf(state).equipment.harvestWagon.crops[def.id] ?? 0) * def.storageUnitsPerItem, 0);
}

/** Player-facing capacity is meaningful only after restoration supplies the wagon. */
export function harvestWagonReadout(state: GameState): string {
  const wagon = farmOf(state).equipment.harvestWagon;
  return wagon.owned
    ? `${formatFarmCargoWeight(harvestWagonUsed(state))} / ${formatFarmCargoWeight(harvestWagonCapacity(state))}`
    : 'Restoration required';
}

function normalizeHarvestWagon(rawWagon: unknown, operational: boolean, northOwned: boolean, kitOwned: boolean, freightCompleted: boolean): FarmBusinessState['equipment']['harvestWagon'] {
  const raw = objectRecord(rawWagon);
  const county = raw.owned === true && raw.tier === 'county' && operational && kitOwned && northOwned && freightCompleted;
  const owned = county || (raw.owned === true && operational);
  const capacity = county ? COUNTY_HARVEST_WAGON_CAPACITY : BASIC_HARVEST_WAGON_CAPACITY;
  const source = objectRecord(raw.crops);
  const crops: Record<string, number> = {};
  let used = 0;
  for (const def of allFarmCrops()) {
    const count = Number.isInteger(source[def.id]) && Number(source[def.id]) > 0 ? Number(source[def.id]) : 0;
    const kept = Math.min(count, Math.floor(Math.max(0, capacity - used) / def.storageUnitsPerItem));
    if (kept > 0 && owned) crops[def.id] = kept;
    used += kept * def.storageUnitsPerItem;
  }
  return { owned, tier: county ? 'county' : 'basic', crops };
}

/** Fill missing/corrupt Farm Empire fields without trusting stored nested shapes. */
export function normalizeFarmBusinessState(state: GameState, now: number): FarmBusinessState {
  const defaults = createFarmBusinessState(now);
  const raw = objectRecord(state.farm);
  const rawMarket = objectRecord(raw.market);
  const rawClock = objectRecord(raw.clock);
  const rawParcels = objectRecord(raw.parcels);
  const rawEquipment = objectRecord(raw.equipment);
  const rawTractor = objectRecord(rawEquipment.tractor);
  const rawKitOwned = rawEquipment.countyRowCropFieldKitOwned;
  const rawLoftOwned = rawEquipment.barnLoftExpansionOwned;
  const trailerOwned = rawEquipment.countyUtilityTrailerOwned === true;
  const siloOwned = rawEquipment.countyGrainSiloOwned === true;
  const townStatus = objectRecord(raw.townContact).status;
  const kitchenStatus = objectRecord(raw.countyKitchen).status;
  const rawCountyFreight = objectRecord(raw.countyFreight);
  const rawWorkforce = objectRecord(raw.workforce);
  const rawRoadsideStand = objectRecord(raw.roadsideStand);
  const rawSeeds = objectRecord(raw.seeds);
  const rawStorage = objectRecord(raw.storage);
  const rawFieldConditions = objectRecord(raw.fieldConditions);
  const rawQuotes = objectRecord(rawMarket.quotes);
  const validCropIds = new Set(allFarmCrops().map((c) => c.id));
  const selectedCropId = validCropIds.has(String(raw.selectedCropId))
    ? String(raw.selectedCropId)
    : defaults.selectedCropId;

  const seeds: Record<string, number> = {};
  const storage: Record<string, number> = {};
  const quotes: FarmBusinessState['market']['quotes'] = {};
  for (const def of allFarmCrops()) {
    seeds[def.id] = clampInt(rawSeeds[def.id], defaults.seeds[def.id]);
    storage[def.id] = clampInt(rawStorage[def.id], 0);
    const quote = objectRecord(rawQuotes[def.id]);
    quotes[def.id] = {
      currentCents: clampInt(quote?.currentCents, def.basePriceCents, 1),
      previousCents: clampInt(quote?.previousCents, def.basePriceCents, 1),
    };
  }

  const knownEvents = new Set(allFarmMarketEvents().map((e) => e.id));
  const activeEvents = (Array.isArray(rawMarket.activeEvents) ? rawMarket.activeEvents : [])
    .filter((event): event is ActiveFarmMarketEvent => (
      !!event && knownEvents.has(String(event.id)) && clampInt(event.remainingDays, 0) > 0
    ))
    .map((event) => ({
      ...farmMarketEventDef(String(event.id)),
      remainingDays: clampInt(event.remainingDays, 1, 1),
    }));

  const northOwned = rawParcels.northOwned === true;
  const tractorOperational = rawTractor.status === 'operational';
  const loftOwned = rawLoftOwned === true && northOwned;
  const grainSiloOwned = siloOwned && loftOwned;
  const clockDay = clampInt(rawClock.day, 1, 1);
  const farmhandHired = rawWorkforce.farmhandHired === true && townStatus === 'completed' && northOwned;
  const rawManager = objectRecord(rawWorkforce.manager);
  const managerHired = rawManager.hired === true && farmhandHired;
  const managerParcelId = rawManager.parcelId === 'north' && northOwned ? 'north' : 'starter';
  const managerCropId = validCropIds.has(String(rawManager.cropId)) && isFarmCropUnlocked(state, String(rawManager.cropId))
    ? String(rawManager.cropId) : 'crop_corn';
  const roadsideStandOwned = rawRoadsideStand.owned === true && townStatus === 'completed';
  const rawActiveFreight = objectRecord(rawCountyFreight.active);
  const freightCropId = String(rawActiveFreight.cropId ?? '');
  const freightIssuedDay = clampInt(rawActiveFreight.issuedDay, 0);
  const freightRequiredUnits = clampInt(rawActiveFreight.requiredUnits, 0);
  const freightPayoutCents = clampInt(rawActiveFreight.payoutCents, 0);
  const freightId = String(rawActiveFreight.id ?? '');
  const freightKind = rawActiveFreight.kind === 'standard' || rawActiveFreight.kind === 'bulk' ? rawActiveFreight.kind : null;
  const freightTemplate = COUNTY_FREIGHT_TEMPLATES.find((candidate) => candidate.cropId === freightCropId);
  const freightDef = farmCropDefOrNull(freightCropId);
  const rawLastCompletedDay = rawCountyFreight.lastCompletedDay;
  const lastCompletedDay = Number.isInteger(rawLastCompletedDay)
    && Number(rawLastCompletedDay) >= 1
    && Number(rawLastCompletedDay) <= clockDay
    ? Number(rawLastCompletedDay)
    : 0;
  const validFreightDay = freightIssuedDay >= 1 && freightIssuedDay <= clockDay;
  const validLegacyFreightPayout = !!freightDef && freightPayoutCents >= 1
    && freightPayoutCents <= maxFreightPayoutCents(freightRequiredUnits, freightDef.basePriceCents, COUNTY_FREIGHT_PREMIUM_BPS);
  const validV2FreightPayout = !!freightDef && freightPayoutCents >= 1
    && freightPayoutCents <= maxFreightPayoutCents(freightRequiredUnits, freightDef.basePriceCents, freightKind === 'bulk' ? COUNTY_FREIGHT_BULK_PREMIUM_BPS : COUNTY_FREIGHT_PREMIUM_BPS);
  const legacyFreight = freightKind === null
    && freightId === `county-freight-${freightIssuedDay}-${freightCropId}`
    && freightRequiredUnits === freightTemplate?.requiredUnits
    && !!freightDef && freightRequiredUnits * freightDef.storageUnitsPerItem <= PICKUP_CARGO_CAPACITY;
  const v2StandardFreight = freightKind === 'standard'
    && freightId === `county-freight-v2-${freightIssuedDay}-standard-${freightCropId}`
    && freightRequiredUnits === freightTemplate?.requiredUnits
    && !!freightDef && freightRequiredUnits * freightDef.storageUnitsPerItem <= PICKUP_CARGO_CAPACITY;
  const v2BulkFreight = freightKind === 'bulk'
    && freightId === `county-freight-v2-${freightIssuedDay}-bulk-${freightCropId}`
    && trailerOwned && !!freightDef
    && countyFreightBulkAllowedUnits(freightDef.storageUnitsPerItem).includes(freightRequiredUnits)
    && freightRequiredUnits * freightDef.storageUnitsPerItem > PICKUP_CARGO_CAPACITY
    && freightRequiredUnits * freightDef.storageUnitsPerItem <= PICKUP_TRAILER_CARGO_CAPACITY;
  const validActiveFreight = townStatus === 'completed' && !!freightTemplate && !!freightDef && validFreightDay
    && lastCompletedDay < clockDay && isFarmCropUnlocked(state, freightCropId)
    && ((legacyFreight && validLegacyFreightPayout) || (validV2FreightPayout && (v2StandardFreight || v2BulkFreight)));
  const normalizedFreightKind = legacyFreight ? 'standard' : freightKind;
  state.farm = {
    cashCents: clampInt(raw.cashCents, STARTING_CASH_CENTS),
    seeds,
    storage,
    storageCapacity: grainSiloOwned
      ? COUNTY_GRAIN_SILO.toCapacity
      : loftOwned ? BARN_LOFT_EXPANSION.toCapacity : STARTING_STORAGE_CAPACITY,
    fieldConditions: {},
    countyReliefClaimed: raw.countyReliefClaimed === true,
    pickup: normalizePickup(raw.pickup, trailerOwned ? PICKUP_TRAILER_CARGO_CAPACITY : PICKUP_BASE_CARGO_CAPACITY),
    handBasket: normalizeHandBasket(raw.handBasket),
    selectedCropId,
    townContact: { status: townStatus === 'offered' || townStatus === 'active' || townStatus === 'completed' ? townStatus : 'unmet' },
    countyKitchen: { status: townStatus === 'completed' && (kitchenStatus === 'offered' || kitchenStatus === 'active' || kitchenStatus === 'completed') ? kitchenStatus : 'unmet' },
    countyFreight: {
      active: validActiveFreight ? {
        id: freightId,
        kind: normalizedFreightKind!,
        issuedDay: freightIssuedDay,
        cropId: freightCropId,
        requiredUnits: freightRequiredUnits,
        payoutCents: freightPayoutCents,
      } : null,
      lastCompletedDay,
    },
    workforce: {
      farmhandHired,
      lastShiftPaidDay: farmhandHired && Number.isInteger(rawWorkforce.lastShiftPaidDay)
        && Number(rawWorkforce.lastShiftPaidDay) >= 1
        && Number(rawWorkforce.lastShiftPaidDay) <= clockDay
        ? Number(rawWorkforce.lastShiftPaidDay)
        : 0,
      manager: {
        hired: managerHired,
        enabled: managerHired && rawManager.enabled === true,
        parcelId: managerParcelId,
        cropId: managerCropId,
        lastReviewedDay: managerHired && Number.isInteger(rawManager.lastReviewedDay)
          && Number(rawManager.lastReviewedDay) >= 0 && Number(rawManager.lastReviewedDay) <= clockDay
          ? Number(rawManager.lastReviewedDay) : 0,
      },
    },
    roadsideStand: {
      owned: roadsideStandOwned,
      lastCompletedDay: roadsideStandOwned && Number.isInteger(rawRoadsideStand.lastCompletedDay)
        && Number(rawRoadsideStand.lastCompletedDay) >= 1
        && Number(rawRoadsideStand.lastCompletedDay) <= clockDay
        ? Number(rawRoadsideStand.lastCompletedDay)
        : 0,
    },
    clock: {
      day: clockDay,
      minute: clampInt(rawClock.minute, 8 * 60) % 1_440,
      lastRealAt: clampInt(rawClock.lastRealAt, now, 1),
    },
    market: {
      quotes,
      activeEvents,
      lastUpdatedDay: clampInt(rawMarket.lastUpdatedDay, 1, 1),
    },
    parcels: {
      starterOwned: rawParcels.starterOwned !== false,
      northOwned,
    },
    equipment: {
      countyRowCropFieldKitOwned: rawKitOwned === true,
      barnLoftExpansionOwned: loftOwned,
      countyUtilityTrailerOwned: trailerOwned,
      countyGrainSiloOwned: grainSiloOwned,
      harvestWagon: normalizeHarvestWagon(rawEquipment.harvestWagon, tractorOperational, northOwned, rawKitOwned === true, lastCompletedDay > 0),
      tractor: {
        id: String(rawTractor.id || defaults.equipment.tractor.id),
        name: String(rawTractor.name || defaults.equipment.tractor.name),
        status: tractorOperational ? 'operational' : 'maintenance',
        x: clampNumber(rawTractor.x, defaults.equipment.tractor.x),
        y: clampNumber(rawTractor.y, defaults.equipment.tractor.y),
        workSpeedBonusBps: clampInt(rawTractor.workSpeedBonusBps, 2_000),
        harvestBonusUnits: clampInt(rawTractor.harvestBonusUnits, 1),
      },
    },
  };
  if (!isFarmCropUnlocked(state, state.farm.selectedCropId)) state.farm.selectedCropId = 'crop_corn';
  ensureOwnedFarmParcelPlots(state, state.farm.parcels);
  for (const plot of state.plots) {
    if (plot.crop) Object.assign(plot.crop, canonicalFarmHarvestBalance(plot.crop));
    const rawCondition = objectRecord(rawFieldConditions[String(plot.uid)]);
    const soil = rawCondition.soil === 'rough' || rawCondition.soil === 'tilled' || rawCondition.soil === 'stubble'
      ? rawCondition.soil
      : plot.crop ? 'tilled' : 'rough';
    state.farm.fieldConditions[String(plot.uid)] = { soil: plot.crop ? 'tilled' : soil };
  }
  syncCashMirror(state);
  return state.farm;
}

export function farmOf(state: GameState): FarmBusinessState {
  if (!state.farm) throw new Error('Farm Empire state is missing');
  return state.farm;
}

export function syncCashMirror(state: GameState): void {
  if (state.farm) state.player.coins = Math.floor(state.farm.cashCents / 100);
}

export function ensureFarmFieldConditions(state: GameState): void {
  const farm = farmOf(state);
  const valid = new Set(state.plots.map((plot) => String(plot.uid)));
  for (const key of Object.keys(farm.fieldConditions)) if (!valid.has(key)) delete farm.fieldConditions[key];
  for (const plot of state.plots) {
    const key = String(plot.uid);
    const current = farm.fieldConditions[key];
    const soil = current?.soil === 'rough' || current?.soil === 'tilled' || current?.soil === 'stubble'
      ? current.soil
      : plot.crop ? 'tilled' : 'rough';
    farm.fieldConditions[key] = { soil: plot.crop ? 'tilled' : soil };
  }
}

export function farmFieldCondition(state: GameState, plotUid: number): FarmFieldCondition {
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  const condition = farmOf(state).fieldConditions[String(plotUid)];
  if (plot?.crop) return { soil: 'tilled' };
  if (condition?.soil === 'tilled' || condition?.soil === 'stubble') return condition;
  return { soil: 'rough' };
}

export function tillFarmField(state: GameState, plotUid: number): ActionResult {
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot || !isOwnedFieldTile(state, plot.x, plot.y)) return fail('This field is not owned.');
  if (plot.crop) return fail('Harvest or clear this crop before preparing the soil.');
  const condition = farmFieldCondition(state, plotUid);
  if (condition.soil === 'tilled') return fail('This field section is already prepared.');
  farmOf(state).fieldConditions[String(plotUid)] = { soil: 'tilled' };
  recordFarmStat(state, 'farmSectionsTilled');
  return {
    ok: true,
    events: [{
      type: 'toast',
      target: condition.soil === 'stubble'
        ? 'Harvest stubble reworked. Soil ready for planting.'
        : 'Rough soil prepared for planting.',
    }],
  };
}

export function waterFarmCrop(state: GameState, plotUid: number, now: number): ActionResult {
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot?.crop) return fail('There is no planted crop to water.');
  const stage = farmCropStage(plot.crop, now);
  if (stage === 'ready' || stage === 'withered') return fail('This crop no longer needs water.');
  if (plot.crop.awaitingWater !== true) return fail('This field section has already received its establishment watering.');
  plot.crop.awaitingWater = false;
  plot.crop.plantedAt = now;
  plot.crop.lastWateredAt = now;
  recordFarmStat(state, 'waterings');
  recordFarmStat(state, 'farmSectionsWatered');
  return { ok: true, events: [{ type: 'water', target: plot.crop.defId, amount: 1 }] };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function storageUsed(state: GameState): number {
  const farm = farmOf(state);
  return allFarmCrops().reduce((sum, def) => (
    sum + (farm.storage[def.id] ?? 0) * def.storageUnitsPerItem
  ), 0);
}

export function storageRemaining(state: GameState): number {
  return Math.max(0, farmOf(state).storageCapacity - storageUsed(state));
}

export function buyFarmSeeds(state: GameState, cropId: string, count: number): ActionResult {
  if (!Number.isInteger(count) || count <= 0) return fail('Choose a positive seed quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const unlock = farmCropUnlockInfo(state, cropId);
  if (!unlock.unlocked) return fail(`${def.name} locked: ${unlock.requirement}`);
  const cost = def.seedPriceCents * count;
  if (farm.cashCents < cost) return fail('Not enough cash for those seeds.');
  farm.cashCents -= cost;
  farm.seeds[cropId] = (farm.seeds[cropId] ?? 0) + count;
  recordFarmStat(state, 'farmCashSpentCents', cost);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `Bought ${count} ${def.name} seed${count === 1 ? '' : 's'}.` }] };
}

export function selectFarmCrop(state: GameState, cropId: string): ActionResult {
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const unlock = farmCropUnlockInfo(state, cropId);
  if (!unlock.unlocked) return fail(`${def.name} locked: ${unlock.requirement}`);
  farmOf(state).selectedCropId = cropId;
  return { ok: true, events: [{ type: 'toast', target: `${def.name} selected.` }] };
}

export function isOwnedFieldTile(state: GameState, x: number, y: number): boolean {
  const farm = farmOf(state);
  const parcelId = farmParcelAtTile(x, y);
  return parcelId === 'starter' ? farm.parcels.starterOwned : parcelId === 'north' ? farm.parcels.northOwned : false;
}

export function ownedFarmParcelAt(state: GameState, x: number, y: number): FarmParcelId | null {
  const farm = farmOf(state);
  const parcelId = farmParcelAtTile(x, y);
  if (parcelId === 'starter' && farm.parcels.starterOwned) return parcelId;
  if (parcelId === 'north' && farm.parcels.northOwned) return parcelId;
  return null;
}

/** Safe deterministic on-foot position used for both a normal exit and mounted saves. */
export function tractorDismountPosition(state: GameState): { x: number; y: number } {
  const tractor = farmOf(state).equipment.tractor;
  return {
    x: tractor.x + TRACTOR_DISMOUNT_OFFSET.x,
    y: tractor.y + TRACTOR_DISMOUNT_OFFSET.y,
  };
}

export function placePlayerAtTractorDismount(state: GameState): { x: number; y: number } {
  const position = tractorDismountPosition(state);
  state.player.px = position.x;
  state.player.py = position.y;
  return position;
}

/**
 * Build a read-only parcel work plan. The app applies each UID through the existing
 * transactional per-plot actions as the tractor reaches it.
 */
export function planParcelWork(
  state: GameState,
  parcelId: FarmParcelId,
  now: number,
  cropId?: string,
  options: ParcelWorkPlanOptions = {},
): ParcelWorkPlan {
  const farm = farmOf(state);
  const plannedCropId = cropId ?? farm.selectedCropId;
  const owned = parcelId === 'starter' ? farm.parcels.starterOwned : farm.parcels.northOwned;
  if (!owned || farm.equipment.tractor.status !== 'operational') {
    return { parcelId, orderedPlotUids: [], plantPlotUids: [], harvestPlotUids: [] };
  }

  const plotByCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot]));
  let orderedPlots = serpentineFieldTiles(farmParcelTiles(parcelId))
    .map((tile) => plotByCoordinate.get(`${tile.x}:${tile.y}`))
    .filter((plot): plot is FarmPlot => !!plot);
  if (options.selectedPlotUids !== undefined) {
    const selected = new Set(options.selectedPlotUids);
    orderedPlots = orderedPlots.filter((plot) => selected.has(plot.uid));
  }
  if (options.anchorPlotUid !== undefined) {
    orderedPlots = fieldWorkRouteFromAnchor(orderedPlots, options.anchorPlotUid);
  }
  const availableSeeds = Math.max(0, Math.floor(farm.seeds[plannedCropId] ?? 0));
  const plantPlotUids = !isFarmCropUnlocked(state, plannedCropId) ? [] : orderedPlots
    .filter((plot) => !plot.crop)
    .slice(0, availableSeeds)
    .map((plot) => plot.uid);
  let freeCapacity = farm.equipment.harvestWagon.owned
    ? harvestWagonCapacity(state) - harvestWagonUsed(state)
    : storageRemaining(state);
  const harvestPlotUids: number[] = [];
  for (const plot of orderedPlots) {
    if (!farmCropReady(plot, now) || !plot.crop) continue;
    const def = farmCropDefOrNull(plot.crop.defId);
    if (!def) continue;
    const bonus = farm.equipment.countyRowCropFieldKitOwned && farm.equipment.tractor.status === 'operational'
      ? COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits : 0;
    const needed = (pinnedFarmHarvestYield(plot.crop) + bonus) * def.storageUnitsPerItem;
    if (needed > freeCapacity) continue;
    harvestPlotUids.push(plot.uid);
    freeCapacity -= needed;
  }
  return {
    parcelId,
    orderedPlotUids: orderedPlots.map((plot) => plot.uid),
    plantPlotUids,
    harvestPlotUids,
  };
}

export function plantFarmCrop(state: GameState, plotUid: number, cropId: string, now: number, context: FarmWorkContext = 'manual'): ActionResult {
  const farm = farmOf(state);
  if (context === 'operatedTractor' && farm.equipment.tractor.status !== 'operational') return fail('Restore the old tractor before using powered field work.');
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot || !isOwnedFieldTile(state, plot.x, plot.y)) return fail('This field is not owned.');
  if (plot.crop) return fail('That field section is already planted.');
  const farmDef = farmCropDefOrNull(cropId);
  if (!farmDef) return fail('Unknown crop.');
  const unlock = farmCropUnlockInfo(state, cropId);
  if (!unlock.unlocked) return fail(`${farmDef.name} locked: ${unlock.requirement}`);
  if ((farm.seeds[cropId] ?? 0) < 1) return fail(`No ${farmDef.name} seeds available.`);
  const condition = farmFieldCondition(state, plotUid);
  if (context === 'manual' && condition.soil !== 'tilled') return fail('Prepare this field section before planting.');
  const speedBps = context === 'operatedTractor' && farm.equipment.countyRowCropFieldKitOwned && farm.equipment.tractor.status === 'operational'
      ? COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps : 0;
  const effectiveGrowMs = Math.round(farmDef.growMs * (10_000 - speedBps) / 10_000);
  const preworkedMs = Math.max(0, farmDef.growMs - effectiveGrowMs);
  farm.seeds[cropId] -= 1;
  farm.fieldConditions[String(plotUid)] = { soil: 'tilled' };
  plot.crop = {
    defId: cropId,
    plantedAt: now,
    wateredBonusMs: preworkedMs,
    lastWateredAt: context === 'operatedTractor' ? now : 0,
    awaitingWater: context === 'manual',
    harvestYieldItems: farmDef.harvestYield,
    harvestBalanceVersion: 2,
  };
  recordFarmStat(state, 'plantings');
  if (context === 'operatedTractor') recordFarmStat(state, 'farmTractorSections');
  return { ok: true, events: [{ type: 'plant', target: cropId, amount: 1, data: { established: context === 'operatedTractor' } }] };
}

export function harvestFarmCrop(state: GameState, plotUid: number, now: number, context: FarmWorkContext = 'manual'): ActionResult {
  const farm = farmOf(state);
  if (context === 'operatedTractor' && farm.equipment.tractor.status !== 'operational') return fail('Restore the old tractor before using powered field work.');
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot?.crop) return fail('There is no crop to harvest.');
  if (isFarmCropWithered(plot.crop, now)) return fail('This crop has withered. Clear it before planting again.');
  if (!farmCropReady(plot, now)) return fail('This crop is still growing.');
  const def = farmCropDefOrNull(plot.crop.defId);
  if (!def) return fail('Unknown crop.');
  const bonus = context === 'operatedTractor' && farm.equipment.countyRowCropFieldKitOwned && farm.equipment.tractor.status === 'operational'
      ? COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits : 0;
  const amount = pinnedFarmHarvestYield(plot.crop) + bonus;
  const needed = amount * def.storageUnitsPerItem;
  if (context === 'operatedTractor' && farm.equipment.harvestWagon.owned) {
    const wagon = farm.equipment.harvestWagon;
    const open = harvestWagonCapacity(state) - harvestWagonUsed(state);
    if (needed > open) return fail(`Harvest wagon full: ${needed * 10} lb required; ${Math.max(0, open) * 10} lb open. Drive to the barn receiving bay to unload.`);
    wagon.crops[def.id] = (wagon.crops[def.id] ?? 0) + amount;
    plot.crop = null;
    farm.fieldConditions[String(plotUid)] = { soil: 'stubble' };
    recordFarmStat(state, 'harvests'); recordFarmStat(state, 'farmHarvestUnits', amount); recordFarmStat(state, 'farmTractorSections');
    return { ok: true, events: [{ type: 'harvest', target: def.id, amount }] };
  }
  if (storageRemaining(state) < needed) {
    return fail(`Barn full: ${needed} handling lots (${needed * 10} lb) of open storage are required. Sell crops before harvesting.`);
  }
  farm.storage[def.id] = (farm.storage[def.id] ?? 0) + amount;
  plot.crop = null;
  farm.fieldConditions[String(plotUid)] = { soil: 'stubble' };
  recordFarmStat(state, 'harvests');
  recordFarmStat(state, 'farmHarvestUnits', amount);
  if (context === 'operatedTractor') recordFarmStat(state, 'farmTractorSections');
  return { ok: true, events: [{ type: 'harvest', target: def.id, amount }] };
}

export function restoreOldTractor(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.equipment.tractor.status === 'operational') return fail('The old tractor is already restored and operational.');
  if (farm.townContact.status !== 'completed') return fail('Complete the County Pantry order before the Equipment Desk can restore the tractor.');
  if (farm.cashCents < OLD_TRACTOR_RESTORATION.priceCents) return fail('Not enough cash for the Old Tractor Restoration.');
  farm.cashCents -= OLD_TRACTOR_RESTORATION.priceCents;
  farm.equipment.tractor.status = 'operational';
  farm.equipment.harvestWagon = { owned: true, tier: 'basic', crops: {} };
  recordFarmStat(state, 'farmCashSpentCents', OLD_TRACTOR_RESTORATION.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'The old tractor is restored with its cultivator, row planter, and basic harvest wagon.' }] };
}

export function purchaseCountyRowCropFieldKit(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed') return fail('Complete the County Pantry order before buying this field kit.');
  if (farm.equipment.tractor.status !== 'operational') return fail('Restore the old tractor before installing the County Row-Crop Implement Set.');
  if (farm.equipment.countyRowCropFieldKitOwned) return fail('The County Row-Crop Implement Set is already installed.');
  if (farm.cashCents < COUNTY_ROW_CROP_FIELD_KIT.priceCents) return fail('Not enough cash for the County Row-Crop Implement Set.');
  farm.cashCents -= COUNTY_ROW_CROP_FIELD_KIT.priceCents;
  farm.equipment.countyRowCropFieldKitOwned = true;
  recordFarmStat(state, 'farmCashSpentCents', COUNTY_ROW_CROP_FIELD_KIT.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'County Row-Crop Implement Set purchased and installed.' }] };
}

export function purchaseCountyHarvestWagon(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.equipment.harvestWagon.tier === 'county') return fail('The County Harvest Wagon is already owned.');
  if (farm.equipment.tractor.status !== 'operational' || !farm.equipment.countyRowCropFieldKitOwned || !farm.parcels.northOwned || farm.countyFreight.lastCompletedDay < 1) return fail('Restore the tractor, install the Implement Set, own the neighboring acreage, and complete one freight haul first.');
  if (farm.cashCents < COUNTY_HARVEST_WAGON.priceCents) return fail('Not enough cash for the County Harvest Wagon.');
  farm.cashCents -= COUNTY_HARVEST_WAGON.priceCents;
  farm.equipment.harvestWagon.owned = true; farm.equipment.harvestWagon.tier = 'county';
  recordFarmStat(state, 'farmCashSpentCents', COUNTY_HARVEST_WAGON.priceCents); syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'County Harvest Wagon purchased. Capacity is now 4,800 lb.' }] };
}

export function unloadHarvestWagonToBarn(state: GameState): ActionResult {
  const farm = farmOf(state); const wagon = farm.equipment.harvestWagon; const used = harvestWagonUsed(state);
  if (used <= 0) return fail('The harvest wagon is empty.');
  const open = storageRemaining(state);
  if (used > open) return fail(`Barn needs ${used * 10} lb open; only ${open * 10} lb is available. The wagon was not unloaded.`);
  for (const def of allFarmCrops()) { const count = wagon.crops[def.id] ?? 0; if (count) farm.storage[def.id] = (farm.storage[def.id] ?? 0) + count; }
  wagon.crops = {};
  return { ok: true, events: [{ type: 'toast', target: `Harvest wagon unloaded: ${used * 10} lb received by the barn.` }] };
}

export function purchaseCountyUtilityTrailer(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.countyFreight.lastCompletedDay < 1) return fail('Complete one County Freight Board haul before buying the utility trailer.');
  if (farm.equipment.countyUtilityTrailerOwned) return fail('The County Utility Trailer is already owned.');
  if (farm.cashCents < COUNTY_UTILITY_TRAILER.priceCents) return fail('Not enough cash for the County Utility Trailer.');
  farm.cashCents -= COUNTY_UTILITY_TRAILER.priceCents;
  farm.equipment.countyUtilityTrailerOwned = true;
  recordFarmStat(state, 'farmCashSpentCents', COUNTY_UTILITY_TRAILER.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'County Utility Trailer purchased. Pickup payload is now 1,440 lb.' }] };
}

function farmCropReady(plot: FarmPlot, now: number): boolean {
  if (!plot.crop) return false;
  return farmCropStage(plot.crop, now) === 'ready';
}

export type FarmCropStage = 'needs-water' | 'growing' | 'ready' | 'withered';

export function farmCropStage(crop: FarmPlot['crop'], now: number): FarmCropStage | 'empty' {
  if (!crop) return 'empty';
  if (crop.awaitingWater === true) return 'needs-water';
  const def = farmCropDef(crop.defId);
  const readyAt = crop.plantedAt + def.growMs - crop.wateredBonusMs;
  if (now < readyAt) return 'growing';
  return now >= readyAt + def.witherMs ? 'withered' : 'ready';
}

export function isFarmCropWithered(crop: FarmPlot['crop'], now: number): boolean {
  return farmCropStage(crop, now) === 'withered';
}

export function clearWitheredFarmCrop(state: GameState, plotUid: number, now: number): ActionResult {
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot?.crop) return fail('There is no crop to clear.');
  if (!isFarmCropWithered(plot.crop, now)) return fail('Only withered crops can be cleared.');
  plot.crop = null;
  farmOf(state).fieldConditions[String(plotUid)] = { soil: 'stubble' };
  return { ok: true, events: [{ type: 'toast', target: 'Withered crop cleared. Rework the remaining stubble before planting.' }] };
}

export function cheapestFarmSeed(): { cropId: string; priceCents: number; name: string } {
  const def = allFarmCrops()
    .filter((candidate) => candidate.unlock === 'starter')
    .sort((a, b) => a.seedPriceCents - b.seedPriceCents || a.id.localeCompare(b.id))[0];
  return { cropId: def.id, priceCents: def.seedPriceCents, name: def.name };
}

export function countyReliefEligible(state: GameState, now: number): boolean {
  const farm = farmOf(state);
  if (farm.countyReliefClaimed) return false;
  const cheapest = cheapestFarmSeed();
  if (farm.cashCents >= cheapest.priceCents) return false;
  if (allFarmCrops().some((def) => (farm.seeds[def.id] ?? 0) > 0)) return false;
  if (storageUsed(state) > 0) return false;
  if (Object.values(farm.handBasket.crops).some((count) => Number(count) > 0)) return false;
  if (Object.values(farm.pickup.cargo.crops).some((count) => Number(count) > 0)) return false;
  if (Object.values(farm.pickup.cargo.seeds).some((count) => Number(count) > 0)) return false;
  return !state.plots.some((plot) => plot.crop && !isFarmCropWithered(plot.crop, now));
}

export function issueCountyReliefSeed(state: GameState, now: number): ActionResult {
  if (!countyReliefEligible(state, now)) return fail('County relief is reserved for a true zero-asset farm.');
  const starter = cheapestFarmSeed();
  const farm = farmOf(state);
  farm.seeds[starter.cropId] = (farm.seeds[starter.cropId] ?? 0) + 1;
  farm.countyReliefClaimed = true;
  return { ok: true, events: [{ type: 'toast', target: `Mae issued 1 ${starter.name} seed as last-resort County relief.` }] };
}

export function purchaseBarnLoftExpansion(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!farm.parcels.northOwned) return fail('Buy the neighboring parcel before expanding the barn loft.');
  if (farm.equipment.barnLoftExpansionOwned) return fail('The Barn Loft Expansion is already owned.');
  if (farm.cashCents < BARN_LOFT_EXPANSION.priceCents) return fail('Not enough cash for the Barn Loft Expansion.');
  farm.cashCents -= BARN_LOFT_EXPANSION.priceCents;
  farm.equipment.barnLoftExpansionOwned = true;
  farm.storageCapacity = BARN_LOFT_EXPANSION.toCapacity;
  recordFarmStat(state, 'farmCashSpentCents', BARN_LOFT_EXPANSION.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `Barn Loft Expansion purchased. Storage capacity is now ${BARN_LOFT_EXPANSION.toCapacity}.` }] };
}

export function purchaseCountyGrainSilo(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (!farm.parcels.northOwned || !farm.equipment.barnLoftExpansionOwned) {
    return fail('Install the Barn Loft Expansion before building the County Grain Silo.');
  }
  if (farm.equipment.countyGrainSiloOwned) return fail('The County Grain Silo is already owned.');
  if (farm.cashCents < COUNTY_GRAIN_SILO.priceCents) return fail('Not enough cash for the County Grain Silo.');
  farm.cashCents -= COUNTY_GRAIN_SILO.priceCents;
  farm.equipment.countyGrainSiloOwned = true;
  farm.storageCapacity = COUNTY_GRAIN_SILO.toCapacity;
  recordFarmStat(state, 'farmCashSpentCents', COUNTY_GRAIN_SILO.priceCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `County Grain Silo purchased. Farm storage is now ${COUNTY_GRAIN_SILO.toCapacity}.` }] };
}

export function sellStoredCrop(state: GameState, cropId: string, count: number): ActionResult {
  if (!Number.isInteger(count) || count <= 0) return fail('Choose a positive sale quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = farm.storage[cropId] ?? 0;
  if (count > owned) return fail(`Only ${owned} ${def.name} item${owned === 1 ? '' : 's'} are stored.`);
  const quote = farm.market.quotes[cropId];
  const totalCents = quote.currentCents * count;
  farm.storage[cropId] = owned - count;
  farm.cashCents += totalCents;
  recordFarmStat(state, 'itemsSold', count);
  recordFarmStat(state, 'farmCashEarnedCents', totalCents);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'sell', target: cropId, amount: count, data: totalCents }] };
}

export function purchaseNeighborParcel(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.parcels.northOwned) return fail('The neighboring parcel is already owned.');
  if (farm.cashCents < FIRST_PARCEL_PRICE_CENTS) return fail('Not enough cash to purchase this parcel.');
  farm.cashCents -= FIRST_PARCEL_PRICE_CENTS;
  farm.parcels.northOwned = true;
  for (const tile of farmParcelTiles('north')) {
    if (state.plots.some((plot) => plot.x === tile.x && plot.y === tile.y)) continue;
    state.uidCounter += 1;
    state.plots.push({ uid: state.uidCounter, x: tile.x, y: tile.y, crop: null });
    farm.fieldConditions[String(state.uidCounter)] = { soil: 'rough' };
  }
  recordFarmStat(state, 'expansions');
  recordFarmStat(state, 'farmCashSpentCents', FIRST_PARCEL_PRICE_CENTS);
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'expand', amount: farmParcelSectionCount('north') }] };
}

function eventModifierBps(events: ActiveFarmMarketEvent[], cropId: string): number {
  return events
    .filter((event) => event.cropId === cropId)
    .reduce((sum, event) => sum + event.modifierBps, 0);
}

/** Deterministic, idempotent daily update using only world seed + day. */
export function updateFarmMarketToDay(state: GameState, targetDay: number): void {
  const farm = farmOf(state);
  const finalDay = Math.max(farm.market.lastUpdatedDay, Math.floor(targetDay));
  for (let day = farm.market.lastUpdatedDay + 1; day <= finalDay; day++) {
    farm.market.activeEvents = farm.market.activeEvents
      .map((event) => ({ ...event, remainingDays: event.remainingDays - 1 }))
      .filter((event) => event.remainingDays > 0);

    const rng = mulberry32(hashSeed(`${state.seed}:farm-market:${day}`));
    if (rng() < 0.42 && farm.market.activeEvents.length < 2) {
      const defs = allFarmMarketEvents();
      const picked = defs[Math.floor(rng() * defs.length) % defs.length];
      if (!farm.market.activeEvents.some((event) => event.id === picked.id)) {
        farm.market.activeEvents.push({ ...picked, remainingDays: picked.durationDays });
      }
    }

    for (const def of allFarmCrops()) {
      const quote = farm.market.quotes[def.id];
      quote.previousCents = quote.currentCents;
      const movementBps = Math.round((rng() * 2 - 1) * 900);
      const eventBps = eventModifierBps(farm.market.activeEvents, def.id);
      const momentum = quote.currentCents * (10_000 + movementBps) / 10_000;
      const eventAnchor = def.basePriceCents * (10_000 + eventBps) / 10_000;
      const next = Math.round(momentum * 0.68 + eventAnchor * 0.32);
      const min = Math.round(def.basePriceCents * 0.65);
      const max = Math.round(def.basePriceCents * FARM_MARKET_MAX_MULTIPLIER);
      quote.currentCents = Math.max(min, Math.min(max, next));
    }
    farm.market.lastUpdatedDay = day;
  }
}

export function advanceFarmClock(state: GameState, realNow: number): void {
  const farm = farmOf(state);
  const elapsedMs = Math.max(0, realNow - farm.clock.lastRealAt);
  const wholeSeconds = Math.floor(elapsedMs / 1_000);
  if (wholeSeconds <= 0) return;
  farm.clock.lastRealAt += wholeSeconds * 1_000;
  const totalMinutes = farm.clock.minute + wholeSeconds * GAME_MINUTES_PER_REAL_SECOND;
  farm.clock.day += Math.floor(totalMinutes / 1_440);
  farm.clock.minute = totalMinutes % 1_440;
  updateFarmMarketToDay(state, farm.clock.day);
}

export function advanceFarmDays(state: GameState, days = 1): void {
  const farm = farmOf(state);
  farm.clock.day += Math.max(1, Math.floor(days));
  updateFarmMarketToDay(state, farm.clock.day);
}

export function marketMovement(cents: number, previousCents: number): { delta: number; direction: 'up' | 'down' | 'flat' } {
  const delta = cents - previousCents;
  return { delta, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

export function seedStarterPlots(state: GameState): FarmPlot[] {
  return STARTER_FIELD_TILES.map((tile) => {
    state.uidCounter += 1;
    return { uid: state.uidCounter, x: tile.x, y: tile.y, crop: null };
  });
}
