import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf, plantFarmCrop, harvestFarmCrop } from '../src/core/farmBusiness';
import {
  farmGuideSteps, farmerKnowledgeSummary, farmKnowledgePoints, nextFarmGuideStep, recordFarmStat,
} from '../src/core/farmKnowledge';
import { loadBarnCropToPickup } from '../src/core/farmPickup';
import { farmCropDef } from '../src/core/registry';
import { FARM_TOWN_GATE } from '../src/core/townGateway';
import { TOWN_PICKUP_PARKING, townPickupHit } from '../src/render/townLayout';
import { FARM_DECOR_MANIFEST } from '../src/render/farmDecor';
import { farmInteractionAtWorldPoint, type FarmInteractionRuntime } from '../src/render/farmInteractions';
import { farmLandmarks, farmWorldPoint } from '../src/render/farmLayout';
import { farmCameraPolicy, townCameraPolicy } from '../src/render/cameraPolicy';
import { NOW } from './helpers';

function makeFarm() {
  return createFarmGame('Experience', 77, NOW);
}

function runtime(state: ReturnType<typeof makeFarm>): FarmInteractionRuntime {
  const farm = farmOf(state);
  return { pickup: farm.pickup, tractor: farm.equipment.tractor, scout: farmLandmarks().scoutHome, now: NOW };
}

describe('Farmbook progress and Farmer Knowledge', () => {
  it('starts with a concise nine-step route and advances from saved-compatible evidence', () => {
    const state = makeFarm();
    expect(farmGuideSteps(state)).toHaveLength(9);
    expect(farmGuideSteps(state).every((step) => !step.done)).toBe(true);
    expect(nextFarmGuideStep(state)?.id).toBe('prepare');
    expect(farmerKnowledgeSummary(state).level.name).toBe('New Hand');

    state.stats.plantings = 1;
    state.stats.farmSectionsTilled = 1;
    state.stats.farmSectionsWatered = 1;
    state.stats.harvests = 1;
    state.stats.farmCargoLoads = 1;
    state.stats.farmTownVisits = 1;
    state.stats.itemsSold = 1;
    farmOf(state).equipment.tractor.status = 'operational';
    farmOf(state).parcels.northOwned = true;
    expect(farmGuideSteps(state).map((step) => step.done)).toEqual([true, true, true, true, true, true, true, true, true]);
    expect(nextFarmGuideStep(state)).toBeNull();
    expect(farmKnowledgePoints(state)).toBeGreaterThan(0);
  });

  it('records only finite positive whole action amounts and repairs bad counters', () => {
    const state = makeFarm();
    state.stats.farmTownVisits = Number.NaN;
    recordFarmStat(state, 'farmTownVisits', 2.9);
    recordFarmStat(state, 'farmTownVisits', -10);
    recordFarmStat(state, 'farmTownVisits', Number.POSITIVE_INFINITY);
    expect(state.stats.farmTownVisits).toBe(2);
  });

  it('tracks planting, harvest, tractor work, and cargo loading through real transactions', () => {
    const state = makeFarm();
    const farm = farmOf(state);
    farm.equipment.tractor.status = 'operational';
    farm.seeds.crop_corn = 1;
    const plot = state.plots[0];
    expect(plantFarmCrop(state, plot.uid, 'crop_corn', NOW, 'operatedTractor').ok).toBe(true);
    expect(state.stats.plantings).toBe(1);
    expect(state.stats.farmTractorSections).toBe(1);
    plot.crop!.plantedAt = NOW - farmCropDef('crop_corn').growMs - 1;
    expect(harvestFarmCrop(state, plot.uid, NOW, 'operatedTractor').ok).toBe(true);
    expect(state.stats.harvests).toBe(1);
    expect(state.stats.farmHarvestUnits).toBeGreaterThan(0);
    expect(loadBarnCropToPickup(state, 'crop_corn', 1).ok).toBe(true);
    expect(state.stats.farmCargoLoads).toBe(1);
    expect(state.stats.farmCargoUnitsMoved).toBe(1);
  });
});

describe('authoritative farm object interactions', () => {
  it('gives a vehicle priority when it overlaps the town gate', () => {
    const state = makeFarm();
    const rt = runtime(state);
    rt.pickup = { ...FARM_TOWN_GATE };
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(FARM_TOWN_GATE), rt)?.kind).toBe('pickup');
  });

  it('routes each visible homestead landmark to its own concise action target', () => {
    const state = makeFarm();
    const rt = runtime(state);
    const landmarks = farmLandmarks();
    const barn = state.placements.find((placement) => placement.defId === 'bld_storage')!;
    const pump = FARM_DECOR_MANIFEST.find((prop) => prop.type === 'hand-pump')!;
    const cases = [
      [landmarks.farmhouse, 'farmhouse'],
      [{ x: barn.x + .5, y: barn.y + .5 }, 'barn'],
      [pump, 'pump'],
      [FARM_TOWN_GATE, 'town-gate'],
    ] as const;
    for (const [point, kind] of cases) {
      expect(farmInteractionAtWorldPoint(state, farmWorldPoint(point), rt)?.kind).toBe(kind);
    }
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(landmarks.doghouse), rt)?.kind).toBe('scout');
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(landmarks.doghouse), { ...rt, scout: { x: 2, y: 2 } })?.kind).toBe('doghouse');
  });

  it('distinguishes locked acreage, open soil, and a ready named crop', () => {
    const state = makeFarm();
    const rt = runtime(state);
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint({ x: 10, y: 3 }), rt)?.kind).toBe('locked-acreage');
    const plot = state.plots[0];
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(plot), rt)).toMatchObject({ kind: 'field', label: 'Rough Soil · Prepare', plotUid: plot.uid });
    plot.crop = { defId: 'crop_corn', plantedAt: NOW - farmCropDef('crop_corn').growMs - 1, wateredBonusMs: 0, lastWateredAt: 0 };
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(plot), rt)?.label).toBe('Corn · Ready');
  });
});

describe('player-facing camera framing', () => {
  it('keeps both locations close enough to read and prevents losing the map in empty space', () => {
    expect(farmCameraPolicy().minZoom).toBeGreaterThanOrEqual(.46);
    expect(townCameraPolicy().minZoom).toBeGreaterThanOrEqual(.72);
  });

  it('gives the County pickup a dedicated parking hit target away from the return sign', () => {
    expect(townPickupHit(TOWN_PICKUP_PARKING, true)).toBe(true);
    expect(townPickupHit(TOWN_PICKUP_PARKING, false)).toBe(false);
    expect(Math.hypot(TOWN_PICKUP_PARKING.x - 16, TOWN_PICKUP_PARKING.y - 14.5)).toBeGreaterThan(2);
  });
});
