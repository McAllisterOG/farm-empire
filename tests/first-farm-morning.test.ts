import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { firstFarmMorningGuide, shouldPresentStarterGuideTarget, shouldShowFirstFarmMorningWelcome } from '../src/core/firstFarmMorning';
import { shouldShowFirstDeliveryChip } from '../src/ui/farmHud';
import { farmOf } from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import { NOW } from './helpers';

function makeFarm() { return createFarmGame('Willow Farm', 91, NOW); }
function phase(state: ReturnType<typeof makeFarm>) { return firstFarmMorningGuide(state, NOW).phase; }
const idle = { tractorOperating: false, tractorJob: false, tractorMoving: false, manualAction: false, manualJob: false, dragging: false, farmhandJob: false, farmhandAction: false, farmhandMoving: false };

describe('First Farm Morning presenter', () => {
  it('derives corn-only field, basket, barn, pickup, and contact transitions without mutation', () => {
    const state = makeFarm(); const before = JSON.stringify(state);
    expect(phase(state)).toBe('prepare'); expect(JSON.stringify(state)).toBe(before);
    farmOf(state).fieldConditions[String(state.plots[0].uid)] = { soil: 'tilled' }; expect(phase(state)).toBe('prepared');
    state.plots[0].crop = { defId: 'crop_wheat', plantedAt: NOW - farmCropDef('crop_wheat').growMs - 1, wateredBonusMs: 0, lastWateredAt: 0 }; expect(phase(state)).toBe('prepare');
    state.plots[0].crop = { defId: 'crop_corn', plantedAt: NOW, wateredBonusMs: 0, lastWateredAt: 0, awaitingWater: true }; expect(phase(state)).toBe('planted-needs-water');
    state.plots[0].crop.awaitingWater = false; expect(phase(state)).toBe('growing');
    state.plots[0].crop.plantedAt = NOW - farmCropDef('crop_corn').growMs - 1; expect(phase(state)).toBe('ready');
    state.plots[0].crop = null; farmOf(state).handBasket.crops.crop_wheat = 8; expect(phase(state)).toBe('prepared');
    farmOf(state).handBasket.crops = { crop_corn: 8 }; expect(phase(state)).toBe('carried');
    farmOf(state).handBasket.crops = {}; farmOf(state).storage.crop_corn = 8; expect(phase(state)).toBe('stored');
    farmOf(state).storage.crop_corn = 0; farmOf(state).pickup.cargo.crops.crop_corn = 12; expect(phase(state)).toBe('meet-mae');
    farmOf(state).townContact.status = 'offered'; expect(phase(state)).toBe('offered');
    farmOf(state).townContact.status = 'active'; expect(phase(state)).toBe('loaded');
    farmOf(state).pickup.cargo.crops = {}; farmOf(state).handBasket.crops.crop_corn = 2; expect(phase(state)).toBe('carried');
    farmOf(state).handBasket.crops = {}; farmOf(state).storage.crop_corn = 2; expect(phase(state)).toBe('stored');
    farmOf(state).townContact.status = 'completed'; expect(phase(state)).toBe('completed');
  });

  it('shows welcome only for an untouched unmet farm and fails safely for missing/malformed inputs', () => {
    const fresh = makeFarm(); expect(shouldShowFirstFarmMorningWelcome(fresh)).toBe(true);
    farmOf(fresh).fieldConditions[String(fresh.plots[0].uid)] = { soil: 'tilled' }; expect(shouldShowFirstFarmMorningWelcome(fresh)).toBe(false);
    const offered = makeFarm(); farmOf(offered).townContact.status = 'offered'; expect(shouldShowFirstFarmMorningWelcome(offered)).toBe(false);
    expect(firstFarmMorningGuide({ ...makeFarm(), farm: undefined }, Number.NaN)).toMatchObject({ showWelcome: false, fieldTarget: null });
  });

  it('gates pulse and chip presentation around active work and town', () => {
    expect(shouldPresentStarterGuideTarget(idle)).toBe(true);
    for (const key of Object.keys(idle) as (keyof typeof idle)[]) expect(shouldPresentStarterGuideTarget({ ...idle, [key]: true })).toBe(false);
    expect(shouldShowFirstDeliveryChip('farm', false, { operating: false, working: false })).toBe(true);
    expect(shouldShowFirstDeliveryChip('town', false, { operating: false, working: false })).toBe(false);
    expect(shouldShowFirstDeliveryChip('farm', false, { operating: true, working: false })).toBe(false);
    expect(shouldShowFirstDeliveryChip('farm', false, { operating: false, working: false, manualWorking: true })).toBe(false);
  });
});