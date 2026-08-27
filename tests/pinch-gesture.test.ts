import { describe, expect, it } from 'vitest';
import { measurePinchGesture, pinchCameraTransform } from '../src/core/pinchGesture';

describe('pinch gesture camera policy', () => {
  it('measures a stable center and separation', () => {
    expect(measurePinchGesture({ x: 20, y: 40 }, { x: 80, y: 120 })).toEqual({
      center: { x: 50, y: 80 },
      distance: 100,
    });
  });

  it('combines midpoint panning with proportional zoom', () => {
    const previous = measurePinchGesture({ x: 0, y: 0 }, { x: 100, y: 0 });
    const current = measurePinchGesture({ x: 10, y: 20 }, { x: 210, y: 20 });
    expect(pinchCameraTransform(previous, current)).toEqual({
      center: { x: 110, y: 20 },
      panX: 60,
      panY: 20,
      zoomFactor: 2,
    });
  });

  it('fails safely when the previous fingers overlap', () => {
    const previous = measurePinchGesture({ x: 5, y: 5 }, { x: 5, y: 5 });
    const current = measurePinchGesture({ x: 0, y: 0 }, { x: 20, y: 0 });
    expect(pinchCameraTransform(previous, current).zoomFactor).toBe(1);
  });
});
