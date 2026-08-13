import { describe, expect, it } from 'vitest';
import '../src/data';
import { pointInFarmParcel } from '../src/core/farmParcels';
import { FARM_TOWN_GATE } from '../src/core/townGateway';
import { pointInTownWalkSurface } from '../src/render/townLayout';
import {
  FARM_STAND_CUSTOMER_ROUTE,
  TOWN_NEIGHBOR_ROUTE,
  TOWN_SHOPPER_ROUTE,
  roadsideCustomerActors,
  sampleCountyLifeRoute,
  townCountyLifeActors,
} from '../src/render/countyLife';

describe('County Life presentation schedules', () => {
  it('is deterministic for the same saved clock, seed, day, and frame time', () => {
    const input = [5_701, 4, 12 * 60, 2_345_678] as const;
    expect(townCountyLifeActors(...input)).toEqual(townCountyLifeActors(...input));
    expect(roadsideCustomerActors(...input, true)).toEqual(roadsideCustomerActors(...input, true));
  });

  it('keeps roadside life gated by an open order and business hours', () => {
    expect(roadsideCustomerActors(5, 1, 12 * 60, 0, false)).toEqual([]);
    expect(roadsideCustomerActors(5, 1, 7 * 60 + 59, 0, true)).toEqual([]);
    expect(roadsideCustomerActors(5, 1, 20 * 60, 0, true)).toEqual([]);
    expect(roadsideCustomerActors(5, 1, 12 * 60, 0, true)).toHaveLength(1);
  });

  it('keeps the complete roadside route off both working acreages and clear of the gate anchor', () => {
    for (const point of FARM_STAND_CUSTOMER_ROUTE) {
      expect(pointInFarmParcel(point), `${point.x},${point.y}`).toBe(false);
      expect(Math.hypot(point.x - FARM_TOWN_GATE.x, point.y - FARM_TOWN_GATE.y)).toBeGreaterThan(.7);
    }
    for (let now = 0; now <= 180_000; now += 250) {
      const actor = roadsideCustomerActors(7_701, 3, 12 * 60, now, true)[0];
      expect(pointInFarmParcel(actor), `${actor.x},${actor.y}`).toBe(false);
    }
  });

  it('keeps every ambient resident and interpolated route segment on the public plaza', () => {
    for (const point of [...TOWN_SHOPPER_ROUTE, ...TOWN_NEIGHBOR_ROUTE]) {
      expect(pointInTownWalkSurface(point), `${point.x},${point.y}`).toBe(true);
    }
    for (let now = 0; now <= 240_000; now += 250) {
      for (const actor of townCountyLifeActors(8_009, 6, 13 * 60, now)) {
        expect(pointInTownWalkSurface(actor), `${actor.id}@${actor.x},${actor.y}`).toBe(true);
      }
    }
  });

  it('removes town residents after business hours without altering the functional NPC roster', () => {
    expect(townCountyLifeActors(9, 1, 6 * 60 + 59, 0)).toEqual([]);
    expect(townCountyLifeActors(9, 1, 12 * 60, 0).map((actor) => actor.id)).toEqual([
      'town-shopper',
      'town-neighbor',
    ]);
    expect(townCountyLifeActors(9, 1, 22 * 60, 0)).toEqual([]);
  });

  it('pauses at authored destinations and reverses without teleporting', () => {
    const route = [{ x: 0, y: 0 }, { x: 2, y: 0 }] as const;
    const options = { speed: 1, startPauseSeconds: 1, endPauseSeconds: 2, phaseSeconds: 0 };
    expect(sampleCountyLifeRoute(route, 0, options)).toMatchObject({ x: 0, y: 0, walking: false });
    expect(sampleCountyLifeRoute(route, 2_000, options)).toMatchObject({ x: 1, y: 0, walking: true, facing: 'east' });
    expect(sampleCountyLifeRoute(route, 3_500, options)).toMatchObject({ x: 2, y: 0, walking: false });
    expect(sampleCountyLifeRoute(route, 6_000, options)).toMatchObject({ x: 1, y: 0, walking: true, facing: 'west' });
  });
});
