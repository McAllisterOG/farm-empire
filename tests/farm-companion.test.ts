import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { serialize } from '../src/save/save';
import { updateFarmCompanion } from '../src/core/farmCompanion';
import { farmFarmerSpriteKey, farmScoutSpriteKey } from '../src/render/farmSprites';
import { NOW } from './helpers';

describe('Farmyard Scout companion', () => {
  const home = { x: 9.8, y: 11.6 };
  it('approaches its farmer without overshooting or teleporting', () => {
    const start = { x: 2, y: 2, mode: 'follow' as const, moving: false };
    const next = updateFarmCompanion(start, { x: 8, y: 2 }, home, 100, false);
    expect(next.x).toBeGreaterThan(start.x); expect(next.x).toBeLessThan(8); expect(next.y).toBe(2);
  });
  it('holds a comfortable follow band when the farmer stops', () => {
    const next = updateFarmCompanion({ x: 6.7, y: 5, mode: 'follow', moving: true }, { x: 8, y: 5 }, home, 100, false);
    expect(next.moving).toBe(false); expect(next.x).toBe(6.7);
  });
  it('returns to its doghouse deterministically in tractor mode', () => {
    const next = updateFarmCompanion({ x: 2, y: 2, mode: 'follow', moving: false }, { x: 8, y: 8 }, home, 100, true);
    expect(next.mode).toBe('home'); expect(next.x).toBeGreaterThan(2); expect(next.x).toBeLessThan(home.x);
  });
  it('bounds invalid or large time steps without NaN', () => {
    const next = updateFarmCompanion({ x: Number.NaN, y: Infinity, mode: 'follow', moving: false }, { x: 1, y: 1 }, home, 1_000_000, true);
    expect(Number.isFinite(next.x) && Number.isFinite(next.y)).toBe(true);
    expect(Math.hypot(next.x - home.x, next.y - home.y)).toBeLessThanOrEqual(.261);
  });
  it('uses finite sprite key enums and leaves save serialization companion-free', () => {
    expect(new Set(['south', 'north', 'east', 'west'].map((f) => farmFarmerSpriteKey(f as 'south', 3))).size).toBe(4);
    expect(farmScoutSpriteKey(2)).toBe('farm:scout:2');
    const saved = JSON.parse(serialize(createFarmGame('Save Check', 12, NOW), NOW)) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('scout');
    expect(saved.farm).not.toHaveProperty('scout');
  });
});
