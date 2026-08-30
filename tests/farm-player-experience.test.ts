import { describe, expect, it } from 'vitest';
import '../src/data';
import { createFarmGame } from '../src/core/state';
import { farmOf, plantFarmCrop, harvestFarmCrop, planParcelWork } from '../src/core/farmBusiness';
import {
  farmGuideSteps, farmerKnowledgeSummary, farmKnowledgePoints, nextFarmGuideStep, recordFarmStat,
} from '../src/core/farmKnowledge';
import { loadBarnCropToPickup } from '../src/core/farmPickup';
import { farmCropDef } from '../src/core/registry';
import { FARM_TOWN_GATE } from '../src/core/townGateway';
import { NEIGHBOR_FIELD_TILES } from '../src/core/farmParcels';
import { TOWN_PICKUP_PARKING, townPickupHit } from '../src/render/townLayout';
import { FARM_DECOR_MANIFEST } from '../src/render/farmDecor';
import { farmInteractionAtWorldPoint, farmVehicleHitsAtWorldPoint, type FarmInteractionRuntime } from '../src/render/farmInteractions';
import { farmLandmarks, farmPlotAtWorldPoint, farmWorldPoint, pointInFarmBounds } from '../src/render/farmLayout';
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
  it('starts with a concise ten-step route and advances from saved-compatible evidence', () => {
    const state = makeFarm();
    expect(farmGuideSteps(state)).toHaveLength(10);
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
    farmOf(state).equipment.barnLoftExpansionOwned = true;
    farmOf(state).equipment.countyGrainSiloOwned = true;
    expect(farmGuideSteps(state).map((step) => step.done)).toEqual([true, true, true, true, true, true, true, true, true, true]);
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

  it('reports both real vehicles when their visible hit areas overlap without changing the legacy priority resolver', () => {
    const state = makeFarm(); const rt = runtime(state);
    rt.pickup = { x: 8, y: 9 }; rt.tractor = { x: 8, y: 9 };
    const point = farmWorldPoint(rt.pickup);
    expect(farmVehicleHitsAtWorldPoint(point, rt)).toEqual(['pickup', 'tractor']);
    expect(farmInteractionAtWorldPoint(state, point, rt)?.kind).toBe('pickup');
  });

  it('keeps direct vehicle centers, visible attachments, misses, and chooser overlap deterministic', () => {
    const state = makeFarm();
    const pickup = { x: 12, y: 12, headingX: 0, headingY: 1, trailerOwned: true };
    const tractor = { x: 15, y: 12, headingX: 1, headingY: 0, attachmentVisible: true };
    const rt = { ...runtime(state), pickup, tractor };

    expect(farmVehicleHitsAtWorldPoint(farmWorldPoint(pickup), rt)).toEqual(['pickup']);
    // The pickup trailer is behind its south-facing cab; the wagon is behind
    // its east-facing tractor. These are painted attachment centers, not broad circles.
    expect(farmVehicleHitsAtWorldPoint(farmWorldPoint({ x: 12, y: 10.5 }), rt)).toEqual(['pickup']);
    expect(farmVehicleHitsAtWorldPoint(farmWorldPoint({ x: 13.55, y: 12 }), rt)).toEqual(['tractor']);
    expect(farmVehicleHitsAtWorldPoint(farmWorldPoint({ x: 12.8, y: 10.5 }), rt)).toEqual([]);

    const overlapping = { ...rt, tractor: { x: 12, y: 11.95, headingX: 0, headingY: 1, attachmentVisible: true } };
    const sharedAttachment = farmWorldPoint({ x: 12, y: 10.5 });
    expect(farmVehicleHitsAtWorldPoint(sharedAttachment, overlapping)).toEqual(['pickup', 'tractor']);
    expect(farmInteractionAtWorldPoint(state, sharedAttachment, overlapping)?.kind).toBe('pickup');
  });

  it('keeps an operated tractor drag selection exact across rough, prepared, and stubble empty sections', () => {
    const state = makeFarm(); const farm = farmOf(state);
    farm.equipment.tractor.status = 'operational'; farm.seeds.crop_corn = 3;
    const selected = state.plots.slice(0, 3);
    farm.fieldConditions[String(selected[1].uid)] = { soil: 'tilled' };
    farm.fieldConditions[String(selected[2].uid)] = { soil: 'stubble' };
    const plan = planParcelWork(state, 'starter', NOW, 'crop_corn', { selectedPlotUids: selected.map((plot) => plot.uid), anchorPlotUid: selected[0].uid });
    expect(plan.orderedPlotUids).toEqual(selected.map((plot) => plot.uid));
    expect(plan.plantPlotUids).toEqual(selected.map((plot) => plot.uid));
  });

  it('gives the hired farmhand a distinct interaction target without outranking vehicles', () => {
    const state = makeFarm();
    const rt = runtime(state);
    const farmhand = { x: 4.3, y: 5.65 };
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(farmhand), { ...rt, farmhand })).toMatchObject({
      kind: 'farmhand',
      label: 'Mara Bell · County Farmhand',
    });
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(farmhand), { ...rt, farmhand, pickup: farmhand })?.kind).toBe('pickup');
  });

  it('lets functional targets win when Scout visibly overlaps them, while open grass still selects Scout', () => {
    const state = makeFarm(); const rt = runtime(state); const field = state.plots[0];
    rt.scout = { x: field.x, y: field.y };
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(field), rt)?.kind).toBe('field');
    const pickup = { x: 8.4, y: 12.1 };
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(pickup), { ...rt, pickup, scout: pickup })?.kind).toBe('pickup');
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint({ x: 7.95, y: 12.3 }), { ...rt, scout: { x: 7.95, y: 12.3 } })?.kind).toBe('scout');
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
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(landmarks.doghouse), rt)?.kind).toBe('doghouse');
    expect(farmInteractionAtWorldPoint(state, farmWorldPoint(landmarks.doghouse), { ...rt, scout: { x: 2, y: 2 } })?.kind).toBe('doghouse');
  });

  it('expands farmhouse interaction and naming with the neighboring acreage', () => {
    const state = makeFarm();
    const rt = runtime(state);
    const farmhouse = farmLandmarks().farmhouse;
    const widenedEdge = farmWorldPoint({ x: farmhouse.x, y: farmhouse.y - 1.45 });
    expect(farmInteractionAtWorldPoint(state, widenedEdge, rt)?.kind).not.toBe('farmhouse');
    farmOf(state).parcels.northOwned = true;
    expect(farmInteractionAtWorldPoint(state, widenedEdge, rt)).toMatchObject({ kind: 'farmhouse', label: 'Expanded Farmhouse' });
  });

  it('reveals a distinct roadside stand target only after the improvement is owned', () => {
    const state = makeFarm();
    const rt = runtime(state);
    const stand = farmLandmarks().roadsideStand;
    const world = farmWorldPoint(stand);
    expect(pointInFarmBounds(world)).toBe(true);
    expect(farmPlotAtWorldPoint(NEIGHBOR_FIELD_TILES, world)).toBeUndefined();
    expect(farmInteractionAtWorldPoint(state, world, rt)).toBeNull();
    farmOf(state).townContact.status = 'completed';
    farmOf(state).roadsideStand.owned = true;
    expect(farmInteractionAtWorldPoint(state, world, rt)).toMatchObject({ kind: 'roadside-stand', label: 'McAllister Farm Stand' });
    expect(farmInteractionAtWorldPoint(state, world, { ...rt, pickup: stand })?.kind).toBe('pickup');
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
