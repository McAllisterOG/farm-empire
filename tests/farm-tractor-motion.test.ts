import { describe, expect, it } from 'vitest';
import { advanceTractorMotion, createTractorMotion, resetTractorMotion, TRACTOR_MAX_SPEED } from '../src/core/farmTractorMotion';

describe('runtime tractor motion', () => {
  it('is deterministic, accelerates under the cap, and arrives at the exact target', () => {
    const run = () => {
      let point = { x: 0, y: 0 }; let motion = createTractorMotion();
      for (let index = 0; index < 200; index++) {
        const step = advanceTractorMotion(point, { x: 4, y: 3 }, motion, 16);
        point = step.position; motion = step.motion;
        if (step.arrived) return { point, motion, index };
      }
      throw new Error('tractor did not arrive');
    };
    const a = run(); const b = run();
    expect(a).toEqual(b);
    expect(a.point).toEqual({ x: 4, y: 3 });
    expect(a.motion.speed).toBe(0);
  });

  it('turns toward diagonal travel and never exceeds the speed cap', () => {
    let point = { x: 0, y: 0 }; let motion = createTractorMotion(); let peak = 0;
    for (let index = 0; index < 12; index++) {
      const step = advanceTractorMotion(point, { x: 0, y: 8 }, motion, 16);
      point = step.position; motion = step.motion; peak = Math.max(peak, motion.speed);
    }
    expect(motion.headingY).toBeGreaterThan(0);
    expect(Math.abs(motion.steer)).toBeLessThanOrEqual(1);
    expect(peak).toBeLessThanOrEqual(TRACTOR_MAX_SPEED);
    expect(motion.wheelPhase).toBeGreaterThan(0);
  });

  it('turns deterministically through an exact reversal at normal frame intervals', () => {
    let point = { x: 0, y: 0 }; let motion = createTractorMotion();
    const headings: { x: number; y: number }[] = [];
    for (let index = 0; index < 24; index++) {
      const step = advanceTractorMotion(point, { x: -8, y: 0 }, motion, 16);
      point = step.position; motion = step.motion;
      headings.push({ x: motion.headingX, y: motion.headingY });
    }
    expect(headings[0].y).toBeGreaterThan(0);
    expect(headings.at(-1)!.x).toBeLessThan(0);
    expect(point.x).toBeLessThan(0);
    expect(headings).toEqual(headings.map((_, index) => {
      let replayPoint = { x: 0, y: 0 }; let replayMotion = createTractorMotion();
      for (let frame = 0; frame <= index; frame++) {
        const step = advanceTractorMotion(replayPoint, { x: -8, y: 0 }, replayMotion, 16);
        replayPoint = step.position; replayMotion = step.motion;
      }
      return { x: replayMotion.headingX, y: replayMotion.headingY };
    }));
  });

  it('brakes for a close target and reset preserves visual heading but stops motion', () => {
    const moving = { ...createTractorMotion(), speed: TRACTOR_MAX_SPEED, headingX: 0, headingY: 1, wheelPhase: 1 };
    const braking = advanceTractorMotion({ x: 0, y: 0 }, { x: 0.1, y: 0 }, moving, 16);
    expect(braking.arrived).toBe(false);
    expect(braking.motion.speed).toBeLessThan(TRACTOR_MAX_SPEED);
    const step = advanceTractorMotion({ x: 0, y: 0 }, { x: 0.03, y: 0 }, moving, 16);
    expect(step.arrived).toBe(true);
    expect(step.position).toEqual({ x: 0.03, y: 0 });
    expect(step.motion.speed).toBe(0);
    expect(resetTractorMotion(moving)).toMatchObject({ headingX: 0, headingY: 1, speed: 0, steer: 0 });
  });
});
