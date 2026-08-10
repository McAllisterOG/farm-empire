import type {
  ActionResult, ActiveFarmMarketEvent, FarmBusinessState, FarmPlot, GameState,
} from './types';
import { cropView } from './crops';
import { allFarmCrops, allFarmMarketEvents, cropDef, farmCropDef, farmMarketEventDef } from './registry';
import { hashSeed, mulberry32 } from './rng';
import { fail } from './types';

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

export function createFarmBusinessState(now: number): FarmBusinessState {
  const quotes: FarmBusinessState['market']['quotes'] = {};
  const seeds: Record<string, number> = {};
  const storage: Record<string, number> = {};
  for (const def of allFarmCrops()) {
    quotes[def.id] = { currentCents: def.basePriceCents, previousCents: def.basePriceCents };
    seeds[def.id] = 2;
    storage[def.id] = 0;
  }
  return {
    cashCents: STARTING_CASH_CENTS,
    seeds,
    storage,
    storageCapacity: STARTING_STORAGE_CAPACITY,
    selectedCropId: 'crop_corn',
    townContact: { status: 'unmet' },
    clock: { day: 1, minute: 8 * 60, lastRealAt: now },
    market: { quotes, activeEvents: [], lastUpdatedDay: 1 },
    parcels: { starterOwned: true, northOwned: false },
    equipment: {
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
  const raw = (state.farm ?? {}) as Partial<FarmBusinessState>;
  const rawMarket = raw.market ?? defaults.market;
  const rawClock = raw.clock ?? defaults.clock;
  const rawParcels = raw.parcels ?? defaults.parcels;
  const rawTractor = raw.equipment?.tractor ?? defaults.equipment.tractor;
  const townStatus = raw.townContact?.status;
  const validCropIds = new Set(allFarmCrops().map((c) => c.id));
  const selectedCropId = validCropIds.has(String(raw.selectedCropId))
    ? String(raw.selectedCropId)
    : defaults.selectedCropId;

  const seeds: Record<string, number> = {};
  const storage: Record<string, number> = {};
  const quotes: FarmBusinessState['market']['quotes'] = {};
  for (const def of allFarmCrops()) {
    seeds[def.id] = clampInt(raw.seeds?.[def.id], defaults.seeds[def.id]);
    storage[def.id] = clampInt(raw.storage?.[def.id], 0);
    const quote = rawMarket.quotes?.[def.id];
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

  state.farm = {
    cashCents: clampInt(raw.cashCents, STARTING_CASH_CENTS),
    seeds,
    storage,
    storageCapacity: clampInt(raw.storageCapacity, STARTING_STORAGE_CAPACITY, 1),
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
      northOwned: rawParcels.northOwned === true,
    },
    equipment: {
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
  const def = farmCropDef(cropId);
  const cost = def.seedPriceCents * count;
  if (farm.cashCents < cost) return fail('Not enough cash for those seeds.');
  farm.cashCents -= cost;
  farm.seeds[cropId] = (farm.seeds[cropId] ?? 0) + count;
  syncCashMirror(state);
  return { ok: true, events: [{ type: 'toast', target: `Bought ${count} ${def.name} seed${count === 1 ? '' : 's'}.` }] };
}

export function selectFarmCrop(state: GameState, cropId: string): ActionResult {
  const def = farmCropDef(cropId);
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
export function planParcelWork(state: GameState, parcelId: FarmParcelId, now: number): ParcelWorkPlan {
  const farm = farmOf(state);
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
    plantPlotUids: orderedPlots.filter((plot) => !plot.crop).map((plot) => plot.uid),
    harvestPlotUids: orderedPlots
      .filter((plot) => !!plot.crop && cropView(plot.crop, now).stage === 'ready')
      .map((plot) => plot.uid),
  };
}

export function plantFarmCrop(state: GameState, plotUid: number, cropId: string, now: number): ActionResult {
  const farm = farmOf(state);
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot || !isOwnedFieldTile(state, plot.x, plot.y)) return fail('This field is not owned.');
  if (plot.crop) return fail('That field section is already planted.');
  const farmDef = farmCropDef(cropId);
  if ((farm.seeds[cropId] ?? 0) < 1) return fail(`No ${farmDef.name} seeds available.`);
  const legacyDef = cropDef(cropId);
  const speedBps = farm.equipment.tractor.status === 'operational'
    ? farm.equipment.tractor.workSpeedBonusBps
    : 0;
  const effectiveGrowMs = Math.round(farmDef.growMs * (10_000 - speedBps) / 10_000);
  const preworkedMs = Math.max(0, legacyDef.growMs - effectiveGrowMs);
  farm.seeds[cropId] -= 1;
  plot.crop = { defId: cropId, plantedAt: now, wateredBonusMs: preworkedMs, lastWateredAt: 0 };
  return { ok: true, events: [{ type: 'plant', target: cropId, amount: 1 }] };
}

export function harvestFarmCrop(state: GameState, plotUid: number, now: number): ActionResult {
  const farm = farmOf(state);
  const plot = state.plots.find((candidate) => candidate.uid === plotUid);
  if (!plot?.crop) return fail('There is no crop to harvest.');
  if (cropView(plot.crop, now).stage !== 'ready') return fail('This crop is still growing.');
  const def = farmCropDef(plot.crop.defId);
  const bonus = farm.equipment.tractor.status === 'operational'
    ? farm.equipment.tractor.harvestBonusUnits
    : 0;
  const amount = def.harvestYield + bonus;
  const needed = amount * def.storageUnitsPerItem;
  if (storageRemaining(state) < needed) {
    return fail(`Barn full: ${needed} free capacity is required. Sell crops before harvesting.`);
  }
  farm.storage[def.id] = (farm.storage[def.id] ?? 0) + amount;
  plot.crop = null;
  return { ok: true, events: [{ type: 'harvest', target: def.id, amount }] };
}

export function sellStoredCrop(state: GameState, cropId: string, count: number): ActionResult {
  if (!Number.isInteger(count) || count <= 0) return fail('Choose a positive sale quantity.');
  const farm = farmOf(state);
  const def = farmCropDef(cropId);
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
