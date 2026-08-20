import { describe, expect, it } from 'vitest';
import '../src/data';
import { farmCropStage, farmOf } from '../src/core/farmBusiness';
import { farmCropDef } from '../src/core/registry';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';

const SAVED_AT = 1_700_000_000_000;
const NEXT_DAY = SAVED_AT + 24 * 60 * 60_000;

function plantedState(plantedAt: number) {
  const state = createFarmGame('Offline Safety', 919, SAVED_AT);
  state.plots[0].crop = {
    defId: 'crop_corn',
    plantedAt,
    wateredBonusMs: 0,
    lastWateredAt: plantedAt,
    awaitingWater: false,
  };
  return state;
}

describe('Farm desktop session pause', () => {
  it('preserves crop progress and prevents the farm clock from catching up while closed', () => {
    const state = plantedState(SAVED_AT - 20_000);
    const before = farmCropStage(state.plots[0].crop, SAVED_AT);
    const loaded = deserialize(serialize(state, SAVED_AT), NEXT_DAY);

    expect(SAVE_VERSION).toBe(23);
    expect(farmCropStage(loaded.plots[0].crop, NEXT_DAY)).toBe(before);
    expect(loaded.plots[0].crop?.plantedAt).toBe(NEXT_DAY - 20_000);
    expect(farmOf(loaded).clock.lastRealAt).toBe(NEXT_DAY);
  });

  it('rescues crops already spoiled by the pre-v20 offline clock exactly once', () => {
    const def = farmCropDef('crop_corn');
    const legacy = plantedState(SAVED_AT - def.growMs - def.witherMs - 5_000);
    legacy.version = 19;
    const loaded = deserialize(JSON.stringify(legacy), NEXT_DAY);

    expect(loaded.version).toBe(23);
    expect(farmCropStage(loaded.plots[0].crop, NEXT_DAY)).toBe('ready');

    const savedAgain = serialize(loaded, NEXT_DAY);
    const afterAnotherDay = deserialize(savedAgain, NEXT_DAY + 24 * 60 * 60_000);
    expect(farmCropStage(afterAnotherDay.plots[0].crop, NEXT_DAY + 24 * 60 * 60_000)).toBe('ready');
  });

  it('does not repeatedly revive a crop that withered during an active v20 session', () => {
    const def = farmCropDef('crop_corn');
    const state = plantedState(SAVED_AT - def.growMs - def.witherMs - 5_000);
    const loaded = deserialize(serialize(state, SAVED_AT), NEXT_DAY);
    expect(farmCropStage(loaded.plots[0].crop, NEXT_DAY)).toBe('withered');
  });
});
