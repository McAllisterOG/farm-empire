import { farmUprightPose } from './farmLayout';

/** Shared readable pickup silhouette for farm and County freight views. */
export function drawOldPickup(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, operating = false, moving = false, now = 0, headingX = 1, headingY = 0, steer = 0, wheelPhase = 0): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * 1.35, scale * 1.35);
  const pose = farmUprightPose({ x: headingX, y: headingY });
  ctx.rotate(pose.slope); if (pose.mirrored) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(40,30,20,.24)'; ctx.beginPath(); ctx.ellipse(0, 8, 32, 9, 0, 0, Math.PI * 2); ctx.fill();
  const roll = moving ? wheelPhase : 0;
  ctx.fillStyle = '#2d3438'; ctx.beginPath(); ctx.arc(-20, 5, 7, 0, Math.PI * 2); ctx.arc(20, 5, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c75a3d'; ctx.fillRect(-27, -8, 54, 14); ctx.fillStyle = '#8d3d31'; ctx.fillRect(4, -25, 22, 18);
  ctx.fillStyle = '#b8d7dd'; ctx.fillRect(8, -22, 16, 10); ctx.fillStyle = '#e7b56b'; ctx.fillRect(-25, -5, 6, 5);
  ctx.strokeStyle = '#d6a24e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-17, 5); ctx.lineTo(-17 + roll, 5); ctx.moveTo(17, 5); ctx.lineTo(17 - roll, 5); ctx.stroke();
  if (operating) { ctx.fillStyle = '#f2d8a5'; ctx.fillRect(-2, -35, 5, 9); }
  ctx.fillStyle = 'rgba(218,218,180,.4)'; ctx.beginPath(); ctx.arc(-30 - steer * 4, -19 - Math.abs(headingY) * 3 - Math.sin(now / 300) * 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
