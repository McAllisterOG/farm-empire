import type { FarmWeatherKind } from '../core/farmWeather';
import type { Camera } from './camera';

/** Screen-space weather keeps presentation transient and independent of saved farm coordinates. */
export function drawWeatherCast(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  weather: FarmWeatherKind,
  now: number,
): void {
  if (weather === 'clear') return;
  const rain = weather === 'rain';
  ctx.save();
  ctx.fillStyle = rain ? 'rgba(48, 69, 78, .16)' : 'rgba(65, 79, 76, .09)';
  ctx.fillRect(0, 0, camera.viewW, camera.viewH);
  ctx.fillStyle = rain ? 'rgba(35, 49, 54, .055)' : 'rgba(42, 55, 54, .04)';
  for (let index = 0; index < 6; index++) {
    const width = 250 + index * 29;
    const travel = camera.viewW + width * 2;
    const x = ((index * 337 + now * (rain ? .006 : .011)) % travel) - width;
    const y = camera.viewH * (.12 + (index % 3) * .28);
    ctx.beginPath();
    ctx.ellipse(x, y, width, 62 + index * 8, -.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawWeatherPrecipitation(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  weather: FarmWeatherKind,
  now: number,
): void {
  if (weather !== 'rain') return;
  const count = Math.max(70, Math.min(190, Math.round(camera.viewW * camera.viewH / 7_500)));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = 'rgba(205, 229, 235, .5)';
  for (let index = 0; index < count; index++) {
    const xSeed = (index * 83 + (index % 7) * 41) % Math.max(1, camera.viewW + 80);
    const ySeed = (index * 149 + (index % 11) * 29) % Math.max(1, camera.viewH + 60);
    const y = (ySeed + now * .42) % (camera.viewH + 60) - 30;
    const x = (xSeed + now * .065 + y * .13) % (camera.viewW + 80) - 40;
    const length = 10 + (index % 4) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - length * .32, y + length);
    ctx.stroke();
  }
  ctx.restore();
}
