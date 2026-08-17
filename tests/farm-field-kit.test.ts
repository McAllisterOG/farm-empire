import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_ROW_CROP_FIELD_KIT } from '../src/data/farmEquipment.data';
import { farmOf, harvestFarmCrop, plantFarmCrop, purchaseCountyRowCropFieldKit, tillFarmField } from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { tractorToolbarPose, tractorToolbarPoseFromRenderState } from '../src/core/farmTractorMotion';
import { deserialize, serialize } from '../src/save/save';
import { offerCountyWorkOrder, acceptCountyWorkOrder, fulfillCountyWorkOrder } from '../src/core/farmTownContact';
import { cropDef, farmCropDef } from '../src/core/registry';
import { loadBarnCropToPickup } from '../src/core/farmPickup';

const NOW = 1_784_394_000_000;

function farm() {
  const state = createFarmGame('Kit Test', 77, NOW);
  farmOf(state).equipment.tractor.status = 'operational';
  return state;
}

describe('County Row-Crop Field Kit', () => {
  it('starts unowned and stays locked until the County Pantry order is complete', () => {
    const state = farm();
    expect(SAVE_VERSION).toBe(17);
    expect(farmOf(state).equipment.countyRowCropFieldKitOwned).toBe(false);
    const before = farmOf(state).cashCents;
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(false);
    expect(farmOf(state).cashCents).toBe(before);
    offerCountyWorkOrder(state); acceptCountyWorkOrder(state);
    farmOf(state).storage.crop_corn = 12;
    loadBarnCropToPickup(state, 'crop_corn', 12);
    fulfillCountyWorkOrder(state, { pickupPresent: true, source: 'pickup' });
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(true);
    expect(farmOf(state).cashCents).toBe(500_000 + 8_500 - COUNTY_ROW_CROP_FIELD_KIT.priceCents);
  });

  it('purchases atomically once and syncs the cash mirror', () => {
    const state = farm(); const f = farmOf(state);
    f.townContact.status = 'completed'; f.cashCents = COUNTY_ROW_CROP_FIELD_KIT.priceCents - 1;
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(false);
    expect(f.cashCents).toBe(COUNTY_ROW_CROP_FIELD_KIT.priceCents - 1);
    f.cashCents = COUNTY_ROW_CROP_FIELD_KIT.priceCents;
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(true);
    expect(state.player.coins).toBe(0);
    const after = f.cashCents;
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(false);
    expect(f.cashCents).toBe(after);
  });

  it('applies effects only to operated tractor work, with manual work at base values', () => {
    const state = farm(); const f = farmOf(state); f.equipment.countyRowCropFieldKitOwned = true;
    const plot = state.plots[0]; f.seeds.crop_corn = 2;
    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'manual').ok).toBe(true);
    expect(plot.crop!.wateredBonusMs).toBe(0);
    plot.crop = null;
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'operatedTractor').ok).toBe(true);
    expect(plot.crop!.wateredBonusMs).toBe(Math.round(farmCropDef('crop_corn').growMs * .2));
    plot.crop!.plantedAt = NOW - cropDef('crop_corn').growMs - 1;
    expect(harvestFarmCrop(state, plot.uid, NOW, 'manual').ok).toBe(true);
    expect(f.storage.crop_corn).toBe(8);
  });

  it('gives operated harvest base yield without the kit, kit yield with it, and base yield on foot', () => {
    const state = farm(); const f = farmOf(state); const plot = state.plots[0];
    const mature = (owned: boolean, context: 'manual' | 'operatedTractor'): number => {
      f.equipment.countyRowCropFieldKitOwned = owned;
      f.storage.crop_corn = 0;
      plot.crop = { defId: 'crop_corn', plantedAt: NOW - farmCropDef('crop_corn').growMs - 1, wateredBonusMs: 0, lastWateredAt: 0 };
      expect(harvestFarmCrop(state, plot.uid, NOW, context).ok).toBe(true);
      return f.storage.crop_corn;
    };
    expect(mature(false, 'operatedTractor')).toBe(farmCropDef('crop_corn').harvestYield);
    expect(mature(true, 'operatedTractor')).toBe(farmCropDef('crop_corn').harvestYield + COUNTY_ROW_CROP_FIELD_KIT.harvestBonusUnits);
    expect(mature(true, 'manual')).toBe(farmCropDef('crop_corn').harvestYield);
  });

  it('grandfathers literal v5 ownership, defaults current missing ownership closed, and round-trips it', () => {
    const old = farm() as unknown as Record<string, any>;
    old.farm.cashCents = 321_654;
    old.farm.storage.crop_corn = 7;
    old.farm.parcels.northOwned = true;
    old.farm.market.quotes.crop_corn.currentCents = 777;
    old.farm.townContact.status = 'completed';
    old.farm.equipment.tractor.x = 12.25;
    old.farm.equipment.tractor.y = 4.75;
    old.version = 5;
    delete old.farm.equipment.countyRowCropFieldKitOwned;
    const migrated = deserialize(JSON.stringify(old), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).equipment.countyRowCropFieldKitOwned).toBe(true);
    expect(farmOf(migrated).cashCents).toBe(321_654);
    expect(farmOf(migrated).storage.crop_corn).toBe(7);
    expect(farmOf(migrated).parcels.northOwned).toBe(true);
    expect(farmOf(migrated).market.quotes.crop_corn.currentCents).toBe(777);
    expect(farmOf(migrated).townContact.status).toBe('completed');
    expect(farmOf(migrated).equipment.tractor.x).toBe(12.25);
    expect(farmOf(migrated).equipment.tractor.y).toBe(4.75);
    const current = farm() as unknown as Record<string, any>;
    delete current.farm.equipment.countyRowCropFieldKitOwned;
    const closed = deserialize(JSON.stringify(current), NOW + 1);
    expect(farmOf(closed).equipment.countyRowCropFieldKitOwned).toBe(false);
    const reloaded = deserialize(serialize(migrated, NOW + 2), NOW + 3);
    expect(farmOf(reloaded).equipment.countyRowCropFieldKitOwned).toBe(true);
  });

  it('keeps toolbar pose deterministic and transient', () => {
    expect(tractorToolbarPose(false)).toBe('raised');
    expect(tractorToolbarPose(true)).toBe('lowered');
    expect(tractorToolbarPoseFromRenderState({ operating: true, moving: false, working: false })).toBe('raised');
    expect(tractorToolbarPoseFromRenderState({ operating: true, moving: true, working: false })).toBe('raised');
    expect(tractorToolbarPoseFromRenderState({ operating: true, moving: false, working: true })).toBe('lowered');
    expect(tractorToolbarPoseFromRenderState({ operating: false, moving: false, working: true })).toBe('raised');
    const state = farm();
    expect(JSON.stringify(state)).not.toContain('toolbar');
  });
});
