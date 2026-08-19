import { describe, expect, it } from 'vitest';
import {
  FARM_CARGO_POUNDS_PER_UNIT, farmCargoPounds, farmCropCargoPounds,
  farmCropPricePerPoundCents, formatFarmCargoWeight, formatFarmCropWeight,
} from '../src/core/farmCargoScale';

describe('farm cargo weight presentation', () => {
  it('projects stable 10 lb handling lots without changing authoritative counts', () => {
    const crop = { storageUnitsPerItem: 3, basePriceCents: 2_600 };
    expect(FARM_CARGO_POUNDS_PER_UNIT).toBe(10);
    expect(farmCargoPounds(72)).toBe(720);
    expect(formatFarmCargoWeight(144)).toBe('1,440 lb');
    expect(farmCropCargoPounds(crop, 8)).toBe(240);
    expect(formatFarmCropWeight(crop, 8)).toBe('240 lb');
    expect(farmCropPricePerPoundCents(crop)).toBeCloseTo(86.6667, 3);
  });

  it('fails closed for invalid and negative display input', () => {
    expect(farmCargoPounds(Number.NaN)).toBe(0);
    expect(farmCargoPounds(-12)).toBe(0);
  });
});
