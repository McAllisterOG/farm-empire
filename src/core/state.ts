/**
 * 存档工厂与主 tick：创建新游戏、每帧/离线统一推进世界。
 */
import type { AvatarConfig, GameState, Stats } from './types';
import { STARTING, maxEnergy } from './balance';
import { islandSize } from './island';
import { initNeighbors } from './social';
import { refreshDaily, syncTutorialQuests } from './quests';
import { tickBeastMischief, tickBeasts } from './beasts';
import { tickWeeds } from './weeds';
import { tickPetGifts } from './pets';
import { updateEnergy } from './player';
import { createFarmBusinessState, ensureFarmFieldConditions, seedStarterPlots } from './farmBusiness';

export const SAVE_VERSION = 13;

export function defaultAvatar(): AvatarConfig {
  return {
    skin: 'cl_skin_fair',
    hair: 'cl_hair_short_brown',
    face: 'cl_face_smile',
    top: 'cl_top_tee_blue',
    bottom: 'cl_bottom_shorts',
    hat: null,
    accessory: null,
  };
}

export function emptyStats(): Stats {
  return {
    harvests: 0, plantings: 0, waterings: 0,
    animalsCollected: 0, animalsFed: 0,
    fishCaught: 0, rareFishCaught: 0,
    beastsDefeated: 0, weedsCleared: 0,
    buildingsPlaced: 0, clothesBought: 0,
    petsAdopted: 0, petFeeds: 0, petPlays: 0,
    visits: 0, helps: 0, pranks: 0, hires: 0,
    coinsEarned: 0, coinsSpent: 0, itemsSold: 0,
    expansions: 0, questsDone: 0,
    daysPlayed: 0, lastPlayDay: '',
  };
}

export function createNewGame(name: string, seed: number, now: number): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    createdAt: now,
    savedAt: now,
    uidCounter: 0,
    seed,
    player: {
      name: name || '岛主',
      level: 1,
      xp: 0,
      coins: STARTING.coins,
      food: STARTING.food,
      reputation: STARTING.reputation,
      energy: maxEnergy(1),
      energyUpdatedAt: now,
      avatar: defaultAvatar(),
      wardrobe: [
        'cl_skin_fair', 'cl_skin_tan', 'cl_skin_deep',
        'cl_hair_short_brown', 'cl_hair_long_black',
        'cl_face_smile', 'cl_face_wink',
        'cl_top_tee_blue', 'cl_bottom_shorts',
      ],
      rodTier: 1,
      px: 0,
      py: 0,
    },
    islandTier: 1,
    plots: [],
    placements: [],
    animals: [],
    pets: [],
    beasts: [],
    weeds: [],
    nextBeastAt: 0,
    nextWeedAt: 0,
    inventory: { seed_carrot: 4 },
    quests: {
      tutorialDone: [],
      active: [],
      daily: { day: '', questIds: [], completed: [] },
    },
    achievements: {},
    collections: { fish: {}, beasts: {} },
    neighbors: [],
    stats: emptyStats(),
    settings: { lang: 'zh', sound: true, music: true },
  };
  // 玩家出生在岛中心
  const c = Math.floor(islandSize(1) / 2);
  state.player.px = c;
  state.player.py = c + 2;
  // 初始 4 块已开垦农田（教程直接可种）
  const startPlots: Array<[number, number]> = [
    [c - 2, c - 1], [c - 1, c - 1], [c - 2, c], [c - 1, c],
  ];
  for (const [x, y] of startPlots) {
    state.uidCounter += 1;
    state.plots.push({ uid: state.uidCounter, x, y, crop: null });
  }
  initNeighbors(state, now);
  syncTutorialQuests(state, now);
  refreshDaily(state, now);
  return state;
}

/** Farm Empire factory. The legacy factory remains intact for compatibility tests and imports. */
export function createFarmGame(name: string, seed: number, now: number): GameState {
  const state = createNewGame(name || 'Farm Manager', seed, now);
  state.player.name = name || 'Farm Manager';
  state.player.level = 1;
  state.player.xp = 0;
  state.player.coins = 5_000;
  state.player.food = 0;
  state.player.reputation = 0;
  state.player.px = 8.5;
  state.player.py = 10.5;
  state.plots = [];
  state.placements = [];
  state.animals = [];
  state.pets = [];
  state.beasts = [];
  state.weeds = [];
  state.neighbors = [];
  state.inventory = {};
  state.quests = { tutorialDone: [], active: [], daily: { day: '', questIds: [], completed: [] } };
  state.achievements = {};
  state.collections = { fish: {}, beasts: {} };
  state.nextBeastAt = Number.MAX_SAFE_INTEGER;
  state.nextWeedAt = Number.MAX_SAFE_INTEGER;
  state.settings.lang = 'en';
  state.uidCounter = 0;
  state.plots = seedStarterPlots(state);
  state.placements = [
    { uid: ++state.uidCounter, defId: 'bld_storage', x: 8, y: 5, rot: 0 },
    { uid: ++state.uidCounter, defId: 'bld_path_stone', x: 8, y: 7, rot: 0 },
    { uid: ++state.uidCounter, defId: 'bld_path_stone', x: 8, y: 8, rot: 0 },
    { uid: ++state.uidCounter, defId: 'bld_path_stone', x: 8, y: 9, rot: 0 },
    { uid: ++state.uidCounter, defId: 'bld_path_stone', x: 9, y: 10, rot: 0 },
  ];
  state.farm = createFarmBusinessState(now);
  ensureFarmFieldConditions(state);
  return state;
}

export interface TickSummary {
  beastsArrived: number;
  weedsGrown: number;
  cropsTrampled: number;
  petGift: string | null;
}

/** 世界推进：能量、野兽、杂草、宠物技能、每日刷新（每帧或加载时调用） */
export function tickWorld(state: GameState, now: number): TickSummary {
  updateEnergy(state, now);
  refreshDaily(state, now);
  const beastsArrived = tickBeasts(state, now);
  const cropsTrampled = tickBeastMischief(state, now);
  const weedsGrown = tickWeeds(state, now);
  const petGift = tickPetGifts(state, now);
  return { beastsArrived, weedsGrown, cropsTrampled, petGift };
}
