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
  pickup: FarmPoint & { headingX?: number; headingY?: number; trailerOwned?: boolean };
  tractor: FarmPoint & { headingX?: number; headingY?: number; attachmentVisible?: boolean };
  scout: FarmPoint;
  farmhand?: FarmPoint;
  farmhands?: { point: FarmPoint; label: string }[];
  now: number;
}

function near(point: FarmPoint, anchor: FarmPoint, radius: number): boolean {
  return Math.hypot(point.x - anchor.x, point.y - anchor.y) <= radius;
}

function headingOf(vehicle: { headingX?: number; headingY?: number }): FarmPoint {
  const length = Math.hypot(vehicle.headingX ?? 1, vehicle.headingY ?? 0);
  return length > 0.0001 ? { x: (vehicle.headingX ?? 1) / length, y: (vehicle.headingY ?? 0) / length } : { x: 1, y: 0 };
}

/** A narrow oriented capsule for a painted attachment behind its vehicle. */
function attachmentHit(point: FarmPoint, vehicle: FarmPoint & { headingX?: number; headingY?: number }, distance: number, halfLength: number, halfWidth: number): boolean {
  const heading = headingOf(vehicle);
  const center = { x: vehicle.x - heading.x * distance, y: vehicle.y - heading.y * distance };
  const dx = point.x - center.x; const dy = point.y - center.y;
  const along = dx * heading.x + dy * heading.y;
  const across = dx * -heading.y + dy * heading.x;
  return Math.abs(along) <= halfLength && Math.abs(across) <= halfWidth;
}

/** Reports both real vehicle silhouettes before the ordinary priority resolver picks one. */
export function farmVehicleHitsAtWorldPoint(worldPoint: FarmPoint, runtime: Pick<FarmInteractionRuntime, 'pickup' | 'tractor'>): Array<'pickup' | 'tractor'> {
  const logical = farmLogicalPoint(worldPoint);
  const hits: Array<'pickup' | 'tractor'> = [];
  // The attachment dimensions mirror the visible painter proportions while
  // remaining intentionally tighter than the primary vehicle silhouettes.
  if (near(logical, runtime.pickup, 1.05)
    || (runtime.pickup.trailerOwned === true && attachmentHit(logical, runtime.pickup, 1.5, .62, .46))) hits.push('pickup');
  if (near(logical, runtime.tractor, 1.0)
    || (runtime.tractor.attachmentVisible === true && attachmentHit(logical, runtime.tractor, 1.45, .72, .48))) hits.push('tractor');
  return hits;
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
  const vehicleHits = farmVehicleHitsAtWorldPoint(worldPoint, runtime);
  if (vehicleHits.includes('pickup')) return { kind: 'pickup', label: 'Old Pickup', point: { ...runtime.pickup } };
  if (vehicleHits.includes('tractor')) return { kind: 'tractor', label: 'Old Tractor', point: { ...runtime.tractor } };
  if (runtime.farmhand && near(logical, runtime.farmhand, .8)) return { kind: 'farmhand', label: 'Mara Bell · County Farmhand', point: { ...runtime.farmhand } };
  for (const worker of runtime.farmhands ?? []) if (near(logical, worker.point, .8)) return { kind: 'farmhand', label: worker.label, point: { ...worker.point } };
  const landmarks = farmLandmarks();
  const farmhouseTier = farmhousePresentationTier(farm.parcels.northOwned, farm.farmstead.officeQuartersOwned);
  if (near(logical, landmarks.farmhouse, farmhouseInteractionRadius(farmhouseTier))) {
    return { kind: 'farmhouse', label: farmhouseTier === 'crew-quarters' ? 'Farmstead Office & Crew Quarters' : farmhouseTier === 'expanded' ? 'Expanded Farmhouse' : 'Farmhouse', point: { ...landmarks.farmhouse } };
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
