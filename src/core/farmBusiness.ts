import type {
  ActionResult, ActiveFarmMarketEvent, FarmBusinessState, FarmPlot, GameState,
} from './types';
import { allFarmCrops, allFarmMarketEvents, farmCropDef, farmCropDefOrNull, farmMarketEventDef } from './registry';
import { hashSeed, mulberry32 } from './rng';
import { fail } from './types';
import { BARN_LOFT_EXPANSION, COUNTY_ROW_CROP_FIELD_KIT } from '../data/farmEquipment.data';

export const STARTING_CASH_CENTS = 500_000;
export const STARTING_STORAGE_CAPACITY = 150;
export const FIRST_PARCEL_PRICE_CENTS = 650_000;
export const GAME_MINUTES_PER_REAL_SECOND = 8;

export const STARTER_FIELD_TILES = Array.from({ length: 9 }, (_, i) => ({
  x: 5 + (i % 3),
  y: 7 + Math.floor(i / 3),
}));

export const NEIGHBOR_FIELD_TILES = Array.from({ length: 9 }, (_, i) => ({
  x: 10 + (i % 3),
  y: 7 + Math.floor(i / 3),
}));

export type FarmParcelId = 'starter' | 'north';
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

export const TRACTOR_DISMOUNT_OFFSET = { x: 0.75, y: 0.25 } as const;

function parcelTiles(parcelId: FarmParcelId): { x: number; y: number }[] {
  return parcelId === 'starter' ? STARTER_FIELD_TILES : NEIGHBOR_FIELD_TILES;
}

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
    countyReliefClaimed: false,
    selectedCropId: 'crop_corn',
    townContact: { status: 'unmet' },
    clock: { day: 1, minute: 8 * 60, lastRealAt: now },
    market: { quotes, activeEvents: [], lastUpdatedDay: 1 },
    parcels: { starterOwned: true, northOwned: false },
    equipment: {
      countyRowCropFieldKitOwned: false,
      barnLoftExpansionOwned: false,
      tractor: {
        id: 'old-tractor',
        name: 'Old Red Tractor',
        status: 'operational',
        x: 9,
        y: 11,
        workSpeedBonusBps: 2_000,
        harvestBonusUnits: 1,
      },
    },
  };
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
  const townStatus = objectRecord(raw.townContact).status;
  const rawSeeds = objectRecord(raw.seeds);
  const rawStorage = objectRecord(raw.storage);
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
  const loftOwned = rawLoftOwned === true && northOwned;
  state.farm = {
    cashCents: clampInt(raw.cashCents, STARTING_CASH_CENTS),
    seeds,
    storage,
    storageCapacity: loftOwned ? BARN_LOFT_EXPANSION.toCapacity : STARTING_STORAGE_CAPACITY,
    countyReliefClaimed: raw.countyReliefClaimed === true,
    selectedCropId,
    townContact: { status: townStatus === 'offered' || townStatus === 'active' || townStatus === 'completed' ? townStatus : 'unmet' },
    clock: {
      day: clampInt(rawClock.day, 1, 1),
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
      tractor: {
        id: String(rawTractor.id || defaults.equipment.tractor.id),
        name: String(rawTractor.name || defaults.equipment.tractor.name),
        status: rawTractor.status === 'maintenance' ? 'maintenance' : 'operational',
        x: clampNumber(rawTractor.x, defaults.equipment.tractor.x),
        y: clampNumber(rawTractor.y, defaults.equipment.tractor.y),
        workSpeedBonusBps: clampInt(rawTractor.workSpeedBonusBps, 2_000),
        harvestBonusUnits: clampInt(rawTractor.harvestBonusUnits, 1),
      },
    },
  };
  if (!isFarmCropUnlocked(state, state.farm.selectedCropId)) state.farm.selectedCropId = 'crop_corn';
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
  if (STARTER_FIELD_TILES.some((tile) => tile.x === x && tile.y === y)) return farm.parcels.starterOwned;
  if (NEIGHBOR_FIELD_TILES.some((tile) => tile.x === x && tile.y === y)) return farm.parcels.northOwned;
  return false;
}

export function ownedFarmParcelAt(state: GameState, x: number, y: number): FarmParcelId | null {
  const farm = farmOf(state);
  if (farm.parcels.starterOwned && STARTER_FIELD_TILES.some((tile) => tile.x === x && tile.y === y)) {
    return 'starter';
  }
  if (farm.parcels.northOwned && NEIGHBOR_FIELD_TILES.some((tile) => tile.x === x && tile.y === y)) {
    return 'north';
  }
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
export function planParcelWork(state: GameState, parcelId: FarmParcelId, now: number, cropId?: string): ParcelWorkPlan {
  const farm = farmOf(state);
  const plannedCropId = cropId ?? farm.selectedCropId;
  const owned = parcelId === 'starter' ? farm.parcels.starterOwned : farm.parcels.northOwned;
  if (!owned) {
    return { parcelId, orderedPlotUids: [], plantPlotUids: [], harvestPlotUids: [] };
  }

  const plotByCoordinate = new Map(state.plots.map((plot) => [`${plot.x}:${plot.y}`, plot]));
  const orderedPlots = serpentineFieldTiles(parcelTiles(parcelId))
    .map((tile) => plotByCoordinate.get(`${tile.x}:${tile.y}`))
    .filter((plot): plot is FarmPlot => !!plot);
  return {
    parcelId,
    orderedPlotUids: orderedPlots.map((plot) => plot.uid),
    plantPlotUids: !isFarmCropUnlocked(state, plannedCropId) ? [] : orderedPlots.filter((plot) => !plot.crop).map((plot) => plot.uid),
    harvestPlotUids: orderedPlots
      .filter((plot) => farmCropReady(plot, now))
      .map((plot) => plot.uid),
  };
}

export function plantFarmCrop(state: GameState, plotUid: number, cropId: string, now: number, context: FarmWorkContext = 'manual'): ActionResult {
  const farm = farmOf(state);
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot || !isOwnedFieldTile(state, plot.x, plot.y)) return fail('This field is not owned.');
  if (plot.crop) return fail('That field section is already planted.');
  const farmDef = farmCropDefOrNull(cropId);
  if (!farmDef) return fail('Unknown crop.');
  const unlock = farmCropUnlockInfo(state, cropId);
  if (!unlock.unlocked) return fail(`${farmDef.name} locked: ${unlock.requirement}`);
  if ((farm.seeds[cropId] ?? 0) < 1) return fail(`No ${farmDef.name} seeds available.`);
  const speedBps = context === 'operatedTractor' && farm.equipment.countyRowCropFieldKitOwned && farm.equipment.tractor.status === 'operational'
      ? COUNTY_ROW_CROP_FIELD_KIT.workSpeedBonusBps : 0;
  const effectiveGrowMs = Math.round(farmDef.growMs * (10_000 - speedBps) / 10_000);
  const preworkedMs = Math.max(0, farmDef.growMs - effectiveGrowMs);
  farm.seeds[cropId] -= 1;
  plot.crop = { defId: cropId, plantedAt: now, wateredBonusMs: preworkedMs, lastWateredAt: 0 };
  return { ok: true, events: [{ type: 'plant', target: cropId, amount: 1 }] };
}

export function harvestFarmCrop(state: GameState, plotUid: number, now: number, context: FarmWorkContext = 'manual'): ActionResult {
  const farm = farmOf(state);
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot?.crop) return fail('There is no crop to harvest.');
  if (isFarmCropWithered(plot.crop, now)) return fail('This crop has withered. Clear it before planting again.');
  if (!farmCropReady(plot, now)) return fail('This crop is still growing.');
  const def = farmCropDefOrNull(plot.crop.defId);
  if (!def) return fail('Unknown crop.');
  const bonus = context === 'operatedTractor' && farm.equipment.countyRowCropFieldKitOwned && farm.equipment.tractor.status === 'operational'
      ? COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits : 0;
  const amount = def.harvestYield + bonus;
  const needed = amount * def.storageUnitsPerItem;
  if (storageRemaining(state) < needed) {
    return fail(`Barn full: ${needed} free capacity is required. Sell crops before harvesting.`);
  }
  farm.storage[def.id] = (farm.storage[def.id] ?? 0) + amount;
  plot.crop = null;
  return { ok: true, events: [{ type: 'harvest', target: def.id, amount }] };
}

export function purchaseCountyRowCropFieldKit(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.townContact.status !== 'completed') return fail('Complete the County Pantry order before buying this field kit.');
  if (farm.equipment.countyRowCropFieldKitOwned) return fail('The County Row-Crop Field Kit is already installed.');
  if (farm.cashCents < COUNTY_ROW_CROP_FIELD_KIT.priceCents) return fail('Not enough cash for the County Row-Crop Field Kit.');
  farm.cashCents -= COUNTY_ROW_CROP_FIELD_KIT.priceCents;
  farm.equipment.countyRowCropFieldKitOwned = true;
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'County Row-Crop Field Kit purchased and installed.' }] };
}

function farmCropReady(plot: FarmPlot, now: number): boolean {
  if (!plot.crop) return false;
  return farmCropStage(plot.crop, now) === 'ready';
}

export type FarmCropStage = 'growing' | 'ready' | 'withered';

export function farmCropStage(crop: FarmPlot['crop'], now: number): FarmCropStage | 'empty' {
  if (!crop) return 'empty';
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
  return { ok: true, events: [{ type: 'toast', target: 'Withered field section cleared. No crop or refund was recovered.' }] };
}

export function cheapestFarmSeed(): { cropId: string; priceCents: number; name: string } {
  const def = allFarmCrops().slice().sort((a, b) => a.seedPriceCents - b.seedPriceCents || a.id.localeCompare(b.id))[0];
  return { cropId: def.id, priceCents: def.seedPriceCents, name: def.name };
}

export function countyReliefEligible(state: GameState, now: number): boolean {
  const farm = farmOf(state);
  if (farm.countyReliefClaimed) return false;
  const cheapest = cheapestFarmSeed();
  if (farm.cashCents >= cheapest.priceCents) return false;
  if (allFarmCrops().some((def) => (farm.seeds[def.id] ?? 0) > 0)) return false;
  if (storageUsed(state) > 0) return false;
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
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: 'Barn Loft Expansion purchased. Storage capacity is now 200.' }] };
}

export function sellStoredCrop(state: GameState, cropId: string, count: number): ActionResult {
  if (!Number.isInteger(count) || count <= 0) return fail('Choose a positive sale quantity.');
  const farm = farmOf(state);
  const def = farmCropDefOrNull(cropId);
  if (!def) return fail('Unknown crop.');
  const owned = farm.storage[cropId] ?? 0;
  if (count > owned) return fail(`Only ${owned} ${def.name} unit${owned === 1 ? '' : 's'} are stored.`);
  const quote = farm.market.quotes[cropId];
  const totalCents = quote.currentCents * count;
  farm.storage[cropId] = owned - count;
  farm.cashCents += totalCents;
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'sell', target: cropId, amount: count, data: totalCents }] };
}

export function purchaseNeighborParcel(state: GameState): ActionResult {
  const farm = farmOf(state);
  if (farm.parcels.northOwned) return fail('The neighboring parcel is already owned.');
  if (farm.cashCents < FIRST_PARCEL_PRICE_CENTS) return fail('Not enough cash to purchase this parcel.');
  farm.cashCents -= FIRST_PARCEL_PRICE_CENTS;
  farm.parcels.northOwned = true;
  for (const tile of NEIGHBOR_FIELD_TILES) {
    if (state.plots.some((plot) => plot.x === tile.x && plot.y === tile.y)) continue;
    state.uidCounter += 1;
    state.plots.push({ uid: state.uidCounter, x: tile.x, y: tile.y, crop: null });
  }
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'expand', amount: 9 }] };
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
      const max = Math.round(def.basePriceCents * 1.55);
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
