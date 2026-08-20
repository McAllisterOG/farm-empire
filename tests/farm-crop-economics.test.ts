import { describe, expect, it } from 'vitest';
import '../src/data';
import { COUNTY_FREIGHT_TEMPLATES } from '../src/data/countyFreight.data';
import { COUNTY_GRAIN_SILO, COUNTY_UTILITY_TRAILER } from '../src/data/farmEquipment.data';
import { farmCropEconomics } from '../src/core/farmCropEconomics';
import { farmParcelSectionCount } from '../src/core/farmParcels';
import { farmCropDef } from '../src/core/registry';

describe('Farm crop economics', () => {
  it('returns exact base-price capital, gross, net, storage, and optional operated field-kit yields', () => {
    expect(farmCropEconomics(farmCropDef('crop_corn'), { sectionCount: 36, includeOperatedFieldKitYield: true })).toEqual({
      sectionCount: 36,
      seedCostCents: 50_400,
      harvestItems: 360,
      grossBaseValueCents: 147_600,
      netBaseValueCents: 97_200,
      totalStorageUnits: 360,
      operatedFieldKitHarvestItems: 396,
      operatedFieldKitStorageUnits: 396,
    });
  });

  it('does not mutate frozen crop definitions or options while toggling field-kit planning', () => {
    const def = Object.freeze(structuredClone(farmCropDef('crop_corn')));
    const withoutKit = Object.freeze({ sectionCount: 36, includeOperatedFieldKitYield: false });
    const withKit = Object.freeze({ sectionCount: 36, includeOperatedFieldKitYield: true });
    const definitionBefore = structuredClone(def);
    const withoutKitBefore = structuredClone(withoutKit);
    const withKitBefore = structuredClone(withKit);

    expect(farmCropEconomics(def, withoutKit).operatedFieldKitHarvestItems).toBeUndefined();
    expect(farmCropEconomics(def, withKit)).toMatchObject({
      operatedFieldKitHarvestItems: 396,
      operatedFieldKitStorageUnits: 396,
    });
    expect(def).toEqual(definitionBefore);
    expect(withoutKit).toEqual(withoutKitBefore);
    expect(withKit).toEqual(withKitBefore);
  });

  it('keeps differentiated crop tradeoffs without claiming one universal best crop', () => {
    const sections = farmParcelSectionCount('starter');
    const tomato = farmCropEconomics(farmCropDef('crop_tomato'), { sectionCount: sections });
    const soy = farmCropEconomics(farmCropDef('crop_soybean'), { sectionCount: sections });
    const corn = farmCropEconomics(farmCropDef('crop_corn'), { sectionCount: sections });
    const wheat = farmCropEconomics(farmCropDef('crop_wheat'), { sectionCount: sections });
    const potato = farmCropEconomics(farmCropDef('crop_potato'), { sectionCount: sections });
    const cabbage = farmCropEconomics(farmCropDef('crop_cabbage'), { sectionCount: sections });

    expect(tomato.netBaseValueCents / farmCropDef('crop_tomato').growMs).toBeGreaterThan(cabbage.netBaseValueCents / farmCropDef('crop_cabbage').growMs);
    expect(soy.netBaseValueCents / soy.totalStorageUnits).toBeGreaterThan(Math.max(corn.netBaseValueCents / corn.totalStorageUnits, wheat.netBaseValueCents / wheat.totalStorageUnits, potato.netBaseValueCents / potato.totalStorageUnits));
    expect(cabbage.netBaseValueCents / cabbage.totalStorageUnits).toBeGreaterThan(tomato.netBaseValueCents / tomato.totalStorageUnits);
  });

  it('keeps exact 10-lb handling-lot mass roles within authoritative storage tiers', () => {
    expect(COUNTY_GRAIN_SILO).toMatchObject({ fromCapacity: 720, toCapacity: 1_200 });
    const starter = { sectionCount: farmParcelSectionCount('starter'), includeOperatedFieldKitYield: true };
    const north = { sectionCount: farmParcelSectionCount('north'), includeOperatedFieldKitYield: true };
    expect(farmCropEconomics(farmCropDef('crop_pumpkin'), { sectionCount: 1 }).totalStorageUnits).toBe(24);
    expect(farmCropEconomics(farmCropDef('crop_pumpkin'), { sectionCount: 1 }).harvestItems).toBe(8);
    expect(farmCropEconomics(farmCropDef('crop_corn'), starter).operatedFieldKitStorageUnits).toBe(396);
    expect(farmCropEconomics(farmCropDef('crop_tomato'), starter).operatedFieldKitStorageUnits).toBe(612);
    expect(farmCropEconomics(farmCropDef('crop_pumpkin'), starter).operatedFieldKitStorageUnits).toBe(972);
    for (const cropId of ['crop_corn', 'crop_wheat', 'crop_soybean', 'crop_potato', 'crop_carrot', 'crop_cabbage']) {
      expect(farmCropEconomics(farmCropDef(cropId), north).operatedFieldKitStorageUnits).toBeLessThanOrEqual(COUNTY_GRAIN_SILO.toCapacity);
    }
    for (const cropId of ['crop_tomato', 'crop_pumpkin']) {
      expect(farmCropEconomics(farmCropDef(cropId), north).operatedFieldKitStorageUnits).toBeGreaterThan(COUNTY_GRAIN_SILO.toCapacity);
    }
  });

  it('sizes the 1,200-lot silo for full 96-section operated field crops, not bulky load-outs', () => {
    const options = { sectionCount: farmParcelSectionCount('north'), includeOperatedFieldKitYield: true };
    for (const cropId of ['crop_corn', 'crop_soybean', 'crop_cabbage']) {
      expect(farmCropEconomics(farmCropDef(cropId), options).operatedFieldKitStorageUnits).toBeLessThanOrEqual(COUNTY_GRAIN_SILO.toCapacity);
    }
    for (const cropId of ['crop_tomato', 'crop_pumpkin']) {
      expect(farmCropEconomics(farmCropDef(cropId), options).operatedFieldKitStorageUnits).toBeGreaterThan(COUNTY_GRAIN_SILO.toCapacity);
    }
  });

  it('keeps trailer capacity and every Freight Board requirement within the unchanged base pickup limit', () => {
    expect(COUNTY_UTILITY_TRAILER).toMatchObject({ fromCapacity: 72, toCapacity: 144 });
    expect(COUNTY_FREIGHT_TEMPLATES.map(({ cropId, requiredUnits }) => ({ cropId, requiredUnits }))).toEqual([
      { cropId: 'crop_corn', requiredUnits: 16 }, { cropId: 'crop_wheat', requiredUnits: 14 },
      { cropId: 'crop_soybean', requiredUnits: 18 }, { cropId: 'crop_potato', requiredUnits: 20 },
      { cropId: 'crop_carrot', requiredUnits: 18 }, { cropId: 'crop_tomato', requiredUnits: 36 },
      { cropId: 'crop_cabbage', requiredUnits: 16 }, { cropId: 'crop_pumpkin', requiredUnits: 8 },
    ]);
    expect(COUNTY_FREIGHT_TEMPLATES.every((template) => template.requiredUnits * farmCropDef(template.cropId).storageUnitsPerItem <= COUNTY_UTILITY_TRAILER.fromCapacity)).toBe(true);
  });
});
