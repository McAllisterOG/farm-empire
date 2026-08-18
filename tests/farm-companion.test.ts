import { describe, expect, it } from 'vitest';
import { createFarmGame } from '../src/core/state';
import { serialize } from '../src/save/save';
import { advanceFarmCompanionFetch, canAdvanceFarmCompanionFetch, frisbeeThrowProgress, updateFarmCompanion } from '../src/core/farmCompanion';
import { FARM_FACINGS, FARM_WALK_FRAME_COUNT } from '../src/render/farmSprites';
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
  it('begins the tractor home transition without teleporting and resumes follow mode after exit', () => {
    const start = { x: 5, y: 5, mode: 'follow' as const, moving: false };
    const towardHome = updateFarmCompanion(start, { x: 8, y: 8 }, home, 16, true);
    expect(towardHome).not.toMatchObject(home);
    expect(Math.hypot(towardHome.x - home.x, towardHome.y - home.y)).toBeLessThan(Math.hypot(start.x - home.x, start.y - home.y));
    expect(updateFarmCompanion(towardHome, { x: 8, y: 8 }, home, 16, false).mode).toBe('follow');
  });
  it('bounds invalid or large time steps without NaN', () => {
    const next = updateFarmCompanion({ x: Number.NaN, y: Infinity, mode: 'follow', moving: false }, { x: 1, y: 1 }, home, 1_000_000, true);
    expect(Number.isFinite(next.x) && Number.isFinite(next.y)).toBe(true);
    expect(Math.hypot(next.x - home.x, next.y - home.y)).toBeLessThanOrEqual(.261);
  });
  it('runs a deterministic runtime-only frisbee fetch through pickup and return', () => {
    const fetch = { phase: 'outbound' as const, target: { x: 4, y: 2 }, throwFrom: { x: 2, y: 2 }, phaseStartedAt: 0 };
    const start = { x: 2, y: 2, mode: 'follow' as const, moving: false };
    const outbound = advanceFarmCompanionFetch(start, fetch, { x: 2, y: 2 }, home, 1_000, 100);
    expect(outbound.fetch?.phase).toBe('outbound');
    let runner = outbound;
    for (let index = 0; index < 8; index++) runner = advanceFarmCompanionFetch(runner.scout, runner.fetch!, { x: 2, y: 2 }, home, 100, 200 + index * 100);
    const atFrisbee = runner;
    expect(atFrisbee.fetch?.phase).toBe('pickup');
    const returning = advanceFarmCompanionFetch(atFrisbee.scout, atFrisbee.fetch!, { x: 2, y: 2 }, home, 16, atFrisbee.fetch!.phaseStartedAt + 520);
    expect(returning.fetch?.phase).toBe('returning');
    let returnRunner = returning;
    for (let index = 0; index < 8; index++) returnRunner = advanceFarmCompanionFetch(returnRunner.scout, returnRunner.fetch!, { x: 2, y: 2 }, home, 100, 900 + index * 100);
    const complete = returnRunner;
    expect(complete.fetch).toBeNull(); expect(complete.scout).toMatchObject({ x: 2, y: 2, moving: false });
  });
  it('bounds thrown-frisbee arc progress before it waits at the target', () => {
    expect(frisbeeThrowProgress('outbound', 1_000, 1_000)).toBe(0);
    expect(frisbeeThrowProgress('outbound', 1_000, 1_280)).toBe(.5);
    expect(frisbeeThrowProgress('outbound', 1_000, 9_000)).toBe(1);
    expect(frisbeeThrowProgress('returning', 1_000, 1_100)).toBe(1);
  });
  it('fails closed while any manual owner-work state is active', () => {
    const idle = { onFarm: true, operatingVehicle: false, tractorJob: false, farmhandJob: false, manualFieldAction: false, manualFieldJob: false, basketUnload: false };
    expect(canAdvanceFarmCompanionFetch(idle)).toBe(true);
    expect(canAdvanceFarmCompanionFetch({ ...idle, manualFieldAction: true })).toBe(false);
    expect(canAdvanceFarmCompanionFetch({ ...idle, manualFieldJob: true })).toBe(false);
    expect(canAdvanceFarmCompanionFetch({ ...idle, basketUnload: true })).toBe(false);
  });
  it('uses finite sprite key enums and leaves save serialization companion-free', () => {
    expect(FARM_FACINGS).toEqual(['south', 'north', 'east', 'west']);
    expect(FARM_WALK_FRAME_COUNT).toBe(4);
    const saved = JSON.parse(serialize(createFarmGame('Save Check', 12, NOW), NOW)) as Record<string, unknown>;
    expect(saved).not.toHaveProperty('scout');
    expect(saved.farm).not.toHaveProperty('scout');
  });
});
