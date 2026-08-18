import type { GameState } from '../core/types';
import { farmCropDef } from '../core/registry';
import { farmCropStage, farmFieldCondition, isFarmCropWithered } from '../core/farmBusiness';
import { NEIGHBOR_FIELD_TILES } from '../core/farmParcels';
import { FARM_TOWN_GATE } from '../core/townGateway';
import { FARM_DECOR_MANIFEST } from './farmDecor';
import {
  farmhouseInteractionRadius, farmhousePresentationTier, farmLandmarks, farmLogicalPoint, farmPlotAtWorldPoint, type FarmPoint,
} from './farmLayout';

export type FarmInteractionKind =
  | 'pickup' | 'tractor' | 'farmhand' | 'scout' | 'farmhouse' | 'barn' | 'pump'
  | 'doghouse' | 'roadside-stand' | 'town-gate' | 'locked-acreage' | 'field';

export interface FarmInteractionTarget {
  kind: FarmInteractionKind;
  label: string;
  point: FarmPoint;
  plotUid?: number;
  plotX?: number;
  plotY?: number;
}

export interface FarmInteractionRuntime {
  pickup: FarmPoint;
  tractor: FarmPoint;
  scout: FarmPoint;
  farmhand?: FarmPoint;
  now: number;
}

function near(point: FarmPoint, anchor: FarmPoint, radius: number): boolean {
  return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= radius;
}

/** Scout is decorative-priority only: functional world targets always receive the click. */
export function farmScoutHitAtWorldPoint(worldPoint: FarmPoint, runtime: Pick<FarmInteractionRuntime, 'scout'>): boolean {
  return near(farmLogicalPoint(worldPoint), runtime.scout, .8);
}

/** One authoritative, explicit hit order for the farm's visible focal objects. */
export function farmInteractionAtWorldPoint(
  state: GameState,
  worldPoint: FarmPoint,
  runtime: FarmInteractionRuntime,
): FarmInteractionTarget | null {
  const farm = state.farm;
  if (!farm) return null;
  const logical = farmLogicalPoint(worldPoint);
  if (near(logical, runtime.pickup, 1.05)) return { kind: 'pickup', label: 'Old Pickup', point: { ...runtime.pickup } };
  if (near(logical, runtime.tractor, 1.0)) return { kind: 'tractor', label: 'Old Tractor', point: { ...runtime.tractor } };
  if (runtime.farmhand && near(logical, runtime.farmhand, .8)) return { kind: 'farmhand', label: 'Mara Bell · County Farmhand', point: { ...runtime.farmhand } };
  const landmarks = farmLandmarks();
  const farmhouseTier = farmhousePresentationTier(farm.parcels.northOwned);
  if (near(logical, landmarks.farmhouse, farmhouseInteractionRadius(farmhouseTier))) {
    return { kind: 'farmhouse', label: farmhouseTier === 'expanded' ? 'Expanded Farmhouse Office' : 'Farmhouse Office', point: { ...landmarks.farmhouse } };
  }
  // The physical pump sits beside the barn wall, so its tighter exact target
  // wins over the barn's intentionally generous footprint.
  const pump = FARM_DECOR_MANIFEST.find((prop) => prop.type === 'hand-pump');
  if (pump && near(logical, pump, .85)) return { kind: 'pump', label: 'Hand Pump', point: { x: pump.x, y: pump.y } };
  const barn = state.placements.find((placement) => placement.defId === 'bld_storage');
  if (barn && logical.x >= barn.x - .35 && logical.x <= barn.x + 2.35 && logical.y >= barn.y - .35 && logical.y <= barn.y + 2.35) {
    return { kind: 'barn', label: 'Barn & Cargo', point: { x: barn.x + .5, y: barn.y + .5 } };
  }
  if (near(logical, landmarks.doghouse, .95)) return { kind: 'doghouse', label: "Scout's Doghouse", point: { ...landmarks.doghouse } };
  if (farm.roadsideStand.owned && near(logical, landmarks.roadsideStand, 1.05)) {
    return { kind: 'roadside-stand', label: 'McAllister Farm Stand', point: { ...landmarks.roadsideStand } };
  }
  if (near(logical, FARM_TOWN_GATE, .95)) return { kind: 'town-gate', label: 'County Road', point: { ...FARM_TOWN_GATE } };

  if (!farm.parcels.northOwned) {
    const locked = farmPlotAtWorldPoint(NEIGHBOR_FIELD_TILES, worldPoint);
    if (locked) return { kind: 'locked-acreage', label: 'Neighboring Acreage', point: { x: locked.x, y: locked.y }, plotX: locked.x, plotY: locked.y };
  }
  const plot = farmPlotAtWorldPoint(state.plots, worldPoint);
  if (plot) {
    const condition = farmFieldCondition(state, plot.uid);
    let label = condition.soil === 'tilled'
      ? 'Prepared Soil · Ready to plant'
      : condition.soil === 'stubble'
        ? 'Harvest Stubble · Rework'
        : 'Rough Soil · Prepare';
    if (plot.crop) {
      const crop = farmCropDef(plot.crop.defId);
      const status = isFarmCropWithered(plot.crop, runtime.now) ? 'Withered' : farmCropStage(plot.crop, runtime.now);
      label = status === 'needs-water'
        ? `${crop.name} · Needs water`
        : `${crop.name} · ${status[0].toUpperCase()}${status.slice(1)}`;
    }
    return {
      kind: 'field', label,
      point: { x: plot.x, y: plot.y },
      plotUid: plot.uid,
      plotX: plot.x,
      plotY: plot.y,
    };
  }
  if (farmScoutHitAtWorldPoint(worldPoint, runtime)) return { kind: 'scout', label: 'Scout', point: { ...runtime.scout } };
  return null;
}
