export interface ScreenPoint {
  x: number;
  y: number;
}

export interface PinchGestureFrame {
  center: ScreenPoint;
  distance: number;
}

export interface PinchCameraTransform {
  center: ScreenPoint;
  panX: number;
  panY: number;
  zoomFactor: number;
}

export function measurePinchGesture(first: ScreenPoint, second: ScreenPoint): PinchGestureFrame {
  return {
    center: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  };
}

export function pinchCameraTransform(
  previous: PinchGestureFrame,
  current: PinchGestureFrame,
): PinchCameraTransform {
  const zoomFactor = previous.distance > 0 && Number.isFinite(previous.distance) && Number.isFinite(current.distance)
    ? current.distance / previous.distance
    : 1;
  return {
    center: current.center,
    panX: current.center.x - previous.center.x,
    panY: current.center.y - previous.center.y,
    zoomFactor: Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1,
  };
}
