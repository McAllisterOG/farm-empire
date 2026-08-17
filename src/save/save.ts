/**
 * 存档：localStorage 槽位 + JSON 导出/导入 + schema 版本迁移。
 * core 层不依赖本模块；测试直接调用 serialize/deserialize/migrate。
 */
import type { GameState } from '../core/types';
import { SAVE_VERSION, createFarmGame, emptyStats } from '../core/state';
import { initNeighbors } from '../core/social';
import { normalizeFarmBusinessState } from '../core/farmBusiness';
import { PICKUP_START } from '../core/farmPickupData';
import { FARM_TOWN_RETURN, LEGACY_FARM_TOWN_GATE, LEGACY_FARM_TOWN_RETURN } from '../core/townGateway';

export const SLOT_COUNT = 3;
const KEY_PREFIX = 'farm-empire:save:';
const KEY_ACTIVE = 'farm-empire:activeSlot';

export function serialize(state: GameState, now: number): string {
  state.savedAt = now;
  return JSON.stringify(state);
}

/**
 * 版本迁移链：每个函数把 vN 提升到 vN+1。
 * v1 → v2：补 pets/collections；v2 → v3：补 stats 新字段与 neighbors。
 */
type Migrator = (raw: Record<string, unknown>) => void;

const MIGRATIONS: Record<number, Migrator> = {
  1: (raw) => {
    if (!raw.pets) raw.pets = [];
    if (!raw.collections) raw.collections = { fish: {}, beasts: {} };
    raw.version = 2;
  },
  2: (raw) => {
    const stats = (raw.stats ?? {}) as Record<string, unknown>;
    const full = emptyStats() as unknown as Record<string, unknown>;
    for (const k of Object.keys(full)) {
      if (!(k in stats)) stats[k] = full[k];
    }
    raw.stats = stats;
    if (!raw.neighbors) raw.neighbors = [];
    raw.version = 3;
  },
  3: (raw) => {
    // A clean Farm Empire namespace keeps Paradise Isle browser saves untouched.
    raw.version = 4;
  },
  4: (raw) => {
    // Farm town-contact state is created defensively by farm normalization.
    raw.version = 5;
  },
  5: (raw) => {
    const farm = raw.farm as Record<string, unknown> | undefined;
    if (farm && typeof farm === 'object' && !Array.isArray(farm)) {
      const equipment = (farm.equipment && typeof farm.equipment === 'object' && !Array.isArray(farm.equipment) ? farm.equipment : {}) as Record<string, unknown>;
      equipment.countyRowCropFieldKitOwned = true;
      farm.equipment = equipment;
    }
    raw.version = 6;
  },
  6: (raw) => {
    const farm = raw.farm as Record<string, unknown> | undefined;
    if (farm && typeof farm === 'object' && !Array.isArray(farm)) {
      const equipment = (farm.equipment && typeof farm.equipment === 'object' && !Array.isArray(farm.equipment) ? farm.equipment : {}) as Record<string, unknown>;
      equipment.barnLoftExpansionOwned = false;
      farm.equipment = equipment;
      farm.countyReliefClaimed = false;
    }
    raw.version = 7;
  },
  7: (raw) => {
    // Pickup cargo is deliberately minimal; farm normalization supplies every
    // missing or malformed field and preserves all prior business state.
    raw.version = 8;
  },
  8: (raw) => {
    // Acreage v2 adds missing owned sections during defensive farm normalization.
    // Existing UIDs, crops, cargo, ownership, and business values are preserved.
    const player = raw.player && typeof raw.player === 'object' && !Array.isArray(raw.player)
      ? raw.player as Record<string, unknown> : null;
    if (player) {
      const px = Number(player.px); const py = Number(player.py);
      const atLegacyAnchor = [LEGACY_FARM_TOWN_GATE, LEGACY_FARM_TOWN_RETURN]
        .some((anchor) => Number.isFinite(px) && Number.isFinite(py) && Math.hypot(px - anchor.x, py - anchor.y) <= .9);
      if (atLegacyAnchor) { player.px = FARM_TOWN_RETURN.x; player.py = FARM_TOWN_RETURN.y; }
    }
    const farm = raw.farm && typeof raw.farm === 'object' && !Array.isArray(raw.farm)
      ? raw.farm as Record<string, unknown> : null;
    const pickup = farm?.pickup && typeof farm.pickup === 'object' && !Array.isArray(farm.pickup)
      ? farm.pickup as Record<string, unknown> : null;
    if (pickup) {
      const x = Number(pickup.x); const y = Number(pickup.y);
      if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - LEGACY_FARM_TOWN_GATE.x, y - LEGACY_FARM_TOWN_GATE.y) <= .9) {
        pickup.x = PICKUP_START.x; pickup.y = PICKUP_START.y;
      }
    }
    raw.version = 9;
  },
  9: (raw) => {
    // Manual field conditions are reconstructed from existing plots during
    // defensive normalization. Existing crops retain their growth timestamps.
    raw.version = 10;
  },
  10: (raw) => {
    // Tractor restoration begins with v11. Pre-v11 farms already owned an
    // operational tractor, so preserve that established progression state.
    const farm = raw.farm && typeof raw.farm === 'object' && !Array.isArray(raw.farm)
      ? raw.farm as Record<string, unknown> : null;
    const equipment = farm?.equipment && typeof farm.equipment === 'object' && !Array.isArray(farm.equipment)
      ? farm.equipment as Record<string, unknown> : null;
    const tractor = equipment?.tractor && typeof equipment.tractor === 'object' && !Array.isArray(equipment.tractor)
      ? equipment.tractor as Record<string, unknown> : null;
    if (tractor) tractor.status = 'operational';
    raw.version = 11;
  },
  11: (raw) => {
    // The repeatable County freight board is supplied by defensive farm
    // normalization. No offer, payout, or completion is granted by migration.
    raw.version = 12;
  },
  12: (raw) => {
    // Trailer ownership did not exist in v12; never grant it from a stray key.
    const farm = raw.farm && typeof raw.farm === 'object' ? raw.farm as Record<string, unknown> : null;
    const equipment = farm?.equipment && typeof farm.equipment === 'object' ? farm.equipment as Record<string, unknown> : null;
    if (equipment) delete equipment.countyUtilityTrailerOwned;
    raw.version = 13;
  },
  13: (raw) => {
    // Workforce is a new v14 system. Migration never grants a hire or wage.
    const farm = raw.farm && typeof raw.farm === 'object' ? raw.farm as Record<string, unknown> : null;
    if (farm) delete farm.workforce;
    raw.version = 14;
  },
  14: (raw) => {
    // The roadside stand is a new v15 investment. Migration must never grant
    // ownership or a completed local order from an unknown stray field.
    const farm = raw.farm && typeof raw.farm === 'object' ? raw.farm as Record<string, unknown> : null;
    if (farm) delete farm.roadsideStand;
    raw.version = 15;
  },
  15: (raw) => {
    // The County Grain Silo is a new v16 investment. Never grant ownership
    // from a stray pre-v16 key or trust a stored capacity value.
    const farm = raw.farm && typeof raw.farm === 'object' ? raw.farm as Record<string, unknown> : null;
    const equipment = farm?.equipment && typeof farm.equipment === 'object' ? farm.equipment as Record<string, unknown> : null;
    if (equipment) delete equipment.countyGrainSiloOwned;
    raw.version = 16;
  },
  16: (raw) => {
    // Hand-carried produce becomes authoritative in v17. Never trust a stray
    // pre-v17 basket field; defensive farm normalization creates it empty.
    const farm = raw.farm && typeof raw.farm === 'object' ? raw.farm as Record<string, unknown> : null;
    if (farm) delete farm.handBasket;
    raw.version = 17;
  },
  17: (raw) => {
    // Commercial Freight V2 changes offer generation only. Existing accepted
    // standard contracts are normalized defensively; migration grants nothing.
    raw.version = 18;
  },
};

export function migrate(raw: Record<string, unknown>): GameState {
  let v = Number(raw.version ?? 1);
  if (v > SAVE_VERSION) throw new Error(`save version ${v} is newer than game (${SAVE_VERSION})`);
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`no migration from v${v}`);
    step(raw);
    v = Number(raw.version);
  }
  return raw as unknown as GameState;
}

export function deserialize(json: string, now: number): GameState {
  const raw = JSON.parse(json) as Record<string, unknown>;
  if (typeof raw !== 'object' || raw === null || !raw.player) {
    throw new Error('not a valid save');
  }
  const state = migrate(raw);
  // 邻居为空（老档/异常）时重建
  if (Object.prototype.hasOwnProperty.call(raw, 'farm')) normalizeFarmBusinessState(state, now);
  else initNeighbors(state, now);
  return state;
}

// ---------------------------------------------------------------- localStorage 封装

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

export function saveToSlot(state: GameState, slot: number, now: number): void {
  if (!storageAvailable()) return;
  localStorage.setItem(KEY_PREFIX + slot, serialize(state, now));
  localStorage.setItem(KEY_ACTIVE, String(slot));
}

export function loadFromSlot(slot: number, now: number): GameState | null {
  if (!storageAvailable()) return null;
  const json = localStorage.getItem(KEY_PREFIX + slot);
  if (!json) return null;
  try {
    return deserialize(json, now);
  } catch (err) {
    console.error('save corrupted:', err);
    return null;
  }
}

export interface SlotInfo {
  slot: number;
  name: string;
  level: number;
  coins: number;
  savedAt: number;
}

export function slotInfos(): (SlotInfo | null)[] {
  if (!storageAvailable()) return Array.from({ length: SLOT_COUNT }, () => null);
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const json = localStorage.getItem(KEY_PREFIX + i);
    if (!json) return null;
    try {
      const raw = JSON.parse(json) as GameState;
      return {
        slot: i,
        name: raw.player?.name ?? '?',
        level: raw.player?.level ?? 1,
        coins: raw.farm ? Math.floor(raw.farm.cashCents / 100) : (raw.player?.coins ?? 0),
        savedAt: raw.savedAt ?? 0,
      };
    } catch {
      return null;
    }
  });
}

export function activeSlot(): number {
  if (!storageAvailable()) return 0;
  return Number(localStorage.getItem(KEY_ACTIVE) ?? 0);
}

export function deleteSlot(slot: number): void {
  if (!storageAvailable()) return;
  localStorage.removeItem(KEY_PREFIX + slot);
}

export function newGameInSlot(name: string, slot: number, now: number): GameState {
  const seed = (Math.floor(Math.random() * 0xffffffff) ^ now) >>> 0;
  const state = createFarmGame(name, seed, now);
  saveToSlot(state, slot, now);
  return state;
}

/** 导出为可分享的 base64 字符串 */
export function exportSave(state: GameState, now: number): string {
  const json = serialize(state, now);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(b64: string, now: number): GameState {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return deserialize(json, now);
}
