import { describe, expect, it } from 'vitest';
import { FARM_VEHICLE_MOVEMENT_BOUNDS } from '../src/core/farmPickupData';
import { farmDirectionalInputRoute, farmVehicleControlTarget, isMoveOnlyFarmGround, isMoveOnlyPointerButton, shouldCompleteMoveOnlyGesture, shouldRouteDirectionToFarmVehicle } from '../src/core/farmVehicleControls';
import { shouldShowOperationCancel, vehicleOperationHelp } from '../src/ui/farmHud';

describe('direct farm vehicle controls', () => {
  it('maps cardinal and case-insensitive screen-relative controls without mutating the live position', () => {
    const current = { x: 12, y: 12 };
    expect(farmVehicleControlTarget('W', current)).toEqual({ x: 11, y: 11 });
    expect(farmVehicleControlTarget('ArrowDown', current)).toEqual({ x: 13, y: 13 });
    expect(farmVehicleControlTarget('a', current)).toEqual({ x: 11, y: 13 });
    expect(farmVehicleControlTarget('ArrowRight', current)).toEqual({ x: 13, y: 11 });
    expect(current).toEqual({ x: 12, y: 12 });
  });

  it('uses the authoritative vehicle envelope and rejects unsupported controls', () => {
    const bounds = FARM_VEHICLE_MOVEMENT_BOUNDS;
    expect(farmVehicleControlTarget('w', { x: bounds.minX, y: bounds.minY })).toEqual({ x: bounds.minX, y: bounds.minY });
    expect(farmVehicleControlTarget('s', { x: bounds.maxX, y: bounds.maxY })).toEqual({ x: bounds.maxX, y: bounds.maxY });
    expect(farmVehicleControlTarget('q', { x: 4, y: 4 })).toBeNull();
    expect(farmVehicleControlTarget(null, { x: 4, y: 4 })).toBeNull();
    expect(farmVehicleControlTarget(undefined, { x: 4, y: 4 })).toBeNull();
    expect(farmVehicleControlTarget(4, { x: 4, y: 4 })).toBeNull();
  });

  it('routes operating farm vehicles ahead of camera pan but keeps on-foot and blocked input out of that route', () => {
    const ready = { mode: 'farm' as const, operatingVehicle: true, tractorFieldJobActive: false, panelOpen: false, actionMenuOpen: false, activeOwnerWork: false };
    expect(shouldRouteDirectionToFarmVehicle(ready)).toBe(true);
    expect(shouldRouteDirectionToFarmVehicle({ ...ready, operatingVehicle: false })).toBe(false);
    expect(shouldRouteDirectionToFarmVehicle({ ...ready, tractorFieldJobActive: true })).toBe(false);
    expect(shouldRouteDirectionToFarmVehicle({ ...ready, panelOpen: true })).toBe(false);
    expect(shouldRouteDirectionToFarmVehicle({ ...ready, mode: 'town' })).toBe(false);
  });

  it('consumes blocked farm directions while preserving idle on-foot and farmhand camera routes', () => {
    const idle = { mode: 'farm' as const, operatingVehicle: false, tractorFieldJobActive: false, panelOpen: false, actionMenuOpen: false, activeOwnerWork: false };
    expect(farmDirectionalInputRoute('w', idle)).toBe('camera');
    expect(farmDirectionalInputRoute('ArrowLeft', idle)).toBe('camera');
    expect(farmDirectionalInputRoute('w', { ...idle, tractorFieldJobActive: true })).toBe('blocked');
    expect(farmDirectionalInputRoute('w', { ...idle, panelOpen: true })).toBe('blocked');
    expect(farmDirectionalInputRoute('w', { ...idle, actionMenuOpen: true })).toBe('blocked');
    expect(farmDirectionalInputRoute('w', { ...idle, activeOwnerWork: true })).toBe('blocked');
    expect(farmDirectionalInputRoute('q', idle)).toBe('none');
  });

  it('classifies only secondary pointer releases as move-only input', () => {
    expect(isMoveOnlyPointerButton(2)).toBe(true);
    expect(isMoveOnlyPointerButton(0)).toBe(false);
    expect(isMoveOnlyPointerButton(1)).toBe(false);
    expect(shouldCompleteMoveOnlyGesture(true, false)).toBe(true);
    expect(shouldCompleteMoveOnlyGesture(true, true)).toBe(false);
    expect(shouldCompleteMoveOnlyGesture(false, false)).toBe(false);
  });

  it('allows move-only farm routing only over open ground and keeps pickup guidance out of fieldwork', () => {
    expect(isMoveOnlyFarmGround(null)).toBe(true);
    for (const kind of ['field', 'barn', 'town-gate', 'pickup', 'tractor', 'farmhouse', 'scout', 'farmhand', 'roadside-stand', 'pump', 'locked-acreage']) {
      expect(isMoveOnlyFarmGround(kind)).toBe(false);
    }
    expect(vehicleOperationHelp('pickup')).toContain('cargo pad or County Road');
    expect(vehicleOperationHelp('pickup')).not.toContain('field parcel');
    expect(vehicleOperationHelp('tractor')).toContain('field parcel');
  });

  it('exposes the same safe cancellation route to touch players only while an operation can stop', () => {
    expect(shouldShowOperationCancel({ operating: false, working: false, manualWorking: true, canCancel: true })).toBe(true);
    expect(shouldShowOperationCancel({ operating: true, working: false, activeVehicle: 'tractor' })).toBe(false);
    expect(shouldShowOperationCancel()).toBe(false);
  });
});
