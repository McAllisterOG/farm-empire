import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf } from '../src/core/farmBusiness';
import { cargoPanelPresentation, harvestWagonProgressPresentation } from '../src/ui/panels/farmPanels';
import { NOW } from './helpers';

describe('vehicle logistics clarity presentation', () => {
  it('hides zero crop rows while separating pickup produce and seed-bag weight', () => {
    const state = createFarmGame('Cargo clarity', 12, NOW); const farm = farmOf(state);
    farm.pickup.cargo.seeds.crop_corn = 55;
    farm.pickup.cargo.crops.crop_wheat = 2;
    farm.storage.crop_corn = 3;
    const town = cargoPanelPresentation(state, 'town');
    expect(town.cropIds).toEqual(['crop_wheat']);
    expect(town.pickupProduceUsed).toBe(2);
    expect(town.pickupSeedUsed).toBe(55);
    expect(cargoPanelPresentation(state, 'farm').cropIds).toEqual(['crop_corn', 'crop_wheat']);
  });

  it('states the exact County wagon price and only the unmet prerequisite checklist', () => {
    const state = createFarmGame('Wagon clarity', 13, NOW); const farm = farmOf(state);
    const locked = harvestWagonProgressPresentation(state);
    expect(locked.current).toContain('basic wagon');
    expect(locked.next).toContain('$2,400');
    expect(locked.next).toContain('restored tractor');
    farm.equipment.tractor.status = 'operational';
    farm.equipment.countyRowCropFieldKitOwned = true;
    farm.parcels.northOwned = true;
    farm.countyFreight.lastCompletedDay = 1;
    expect(harvestWagonProgressPresentation(state)).toMatchObject({ unlocked: true });
    expect(harvestWagonProgressPresentation(state).next).toContain('ready at this desk');
  });
});
