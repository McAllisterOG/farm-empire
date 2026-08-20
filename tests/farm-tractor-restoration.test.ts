import { describe, expect, it } from 'vitest';
import '../src/data';
import { OLD_TRACTOR_RESTORATION } from '../src/data/farmEquipment.data';
import {
  farmOf, planParcelWork, plantFarmCrop, purchaseCountyRowCropFieldKit,
  restoreOldTractor, tillFarmField,
} from '../src/core/farmBusiness';
import { createFarmGame, SAVE_VERSION } from '../src/core/state';
import { deserialize, serialize } from '../src/save/save';
import { NOW } from './helpers';

function freshFarm() { return createFarmGame('Restoration Test', 917, NOW); }

describe('Old Tractor Restoration', () => {
  it('starts fresh farms with a repair project while preserving manual fieldwork', () => {
    const state = freshFarm();
    const farm = farmOf(state);
    const plot = state.plots[0];
    expect(SAVE_VERSION).toBe(23);
    expect(farm.equipment.tractor.status).toBe('maintenance');
    expect(planParcelWork(state, 'starter', NOW).orderedPlotUids).toEqual([]);
    farm.seeds.crop_corn = 2;
    const before = JSON.stringify({ seeds: farm.seeds, plot });
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'operatedTractor').ok).toBe(false);
    expect(JSON.stringify({ seeds: farm.seeds, plot })).toBe(before);
    expect(tillFarmField(state, plot.uid).ok).toBe(true);
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'manual').ok).toBe(true);
  });

  it('requires the first County delivery and sufficient cash without partial mutation', () => {
    const state = freshFarm();
    const farm = farmOf(state);
    const initial = JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats });
    expect(restoreOldTractor(state).ok).toBe(false);
    expect(JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats })).toBe(initial);
    farm.townContact.status = 'completed';
    farm.cashCents = OLD_TRACTOR_RESTORATION.priceCents - 1;
    const insufficient = JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats });
    expect(restoreOldTractor(state).ok).toBe(false);
    expect(JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats })).toBe(insufficient);
  });

  it('charges exactly once, syncs the cash mirror, and unlocks tractor planning', () => {
    const state = freshFarm();
    const farm = farmOf(state);
    farm.townContact.status = 'completed';
    const beforeCash = farm.cashCents;
    const result = restoreOldTractor(state);
    expect(result.ok).toBe(true);
    expect(farm.cashCents).toBe(beforeCash - OLD_TRACTOR_RESTORATION.priceCents);
    expect(state.player.coins).toBe(Math.floor(farm.cashCents / 100));
    expect(farm.equipment.tractor.status).toBe('operational');
    expect(planParcelWork(state, 'starter', NOW).orderedPlotUids).toHaveLength(36);
    const after = JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats });
    expect(restoreOldTractor(state).ok).toBe(false);
    expect(JSON.stringify({ cash: farm.cashCents, status: farm.equipment.tractor.status, stats: state.stats })).toBe(after);
  });

  it('keeps the County field kit behind the restored base machine', () => {
    const state = freshFarm();
    const farm = farmOf(state);
    farm.townContact.status = 'completed';
    const before = farm.cashCents;
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(false);
    expect(farm.cashCents).toBe(before);
    expect(restoreOldTractor(state).ok).toBe(true);
    expect(purchaseCountyRowCropFieldKit(state).ok).toBe(true);
  });

  it('grandfathers v10 farms, fails malformed current status closed, and round-trips restoration', () => {
    const old = freshFarm() as unknown as Record<string, any>;
    old.version = 10;
    old.farm.cashCents = 333_444;
    old.farm.storage.crop_corn = 7;
    old.farm.equipment.tractor.status = 'maintenance';
    old.farm.equipment.tractor.x = 12.25;
    old.farm.equipment.tractor.y = 4.75;
    const migrated = deserialize(JSON.stringify(old), NOW + 1);
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(farmOf(migrated).equipment.tractor.status).toBe('operational');
    expect(farmOf(migrated).cashCents).toBe(333_444);
    expect(farmOf(migrated).storage.crop_corn).toBe(7);
    expect(farmOf(migrated).equipment.tractor).toMatchObject({ x: 12.25, y: 4.75 });

    const malformed = freshFarm() as unknown as Record<string, any>;
    delete malformed.farm.equipment.tractor.status;
    expect(farmOf(deserialize(JSON.stringify(malformed), NOW + 2)).equipment.tractor.status).toBe('maintenance');

    const restored = freshFarm();
    farmOf(restored).townContact.status = 'completed';
    expect(restoreOldTractor(restored).ok).toBe(true);
    const reloaded = deserialize(serialize(restored, NOW + 3), NOW + 4);
    expect(farmOf(reloaded).equipment.tractor.status).toBe('operational');
    expect(restoreOldTractor(reloaded).ok).toBe(false);
  });
});
