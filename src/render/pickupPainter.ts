import { farmUprightPose } from './farmLayout';

/** Shared readable pickup silhouette for farm and County freight views. */
export function drawOldPickup(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, operating = false, moving = false, now = 0, headingX = 1, headingY = 0, steer = 0, wheelPhase = 0, trailerOwned = false): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * 1.35, scale * 1.35);
  const pose = farmUprightPose({ x: headingX, y: headingY });
  ctx.rotate(pose.slope); if (pose.mirrored) ctx.scale(-1, 1);
  if (trailerOwned) {
    ctx.fillStyle = 'rgba(38,29,21,.2)'; ctx.beginPath(); ctx.ellipse(-53, 10, 31, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#513c2d'; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-25, 1); ctx.lineTo(-36, 0); ctx.stroke();
    ctx.fillStyle = '#342f2d'; ctx.beginPath(); ctx.arc(-61, 6, 6.5, 0, Math.PI * 2); ctx.arc(-40, 6, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#181716'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(-61, 6, 5, 0, Math.PI * 2); ctx.arc(-40, 6, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#cab88d'; ctx.beginPath(); ctx.arc(-61, 6, 2.2, 0, Math.PI * 2); ctx.arc(-40, 6, 2.2, 0, Math.PI * 2); ctx.fill();
    const trailerBody = ctx.createLinearGradient(0, -20, 0, 4);
    trailerBody.addColorStop(0, '#cf8050'); trailerBody.addColorStop(1, '#91452f');
    ctx.fillStyle = trailerBody; ctx.fillRect(-72, -18, 40, 20);
    ctx.fillStyle = '#713825'; ctx.fillRect(-73, -1, 42, 5);
    ctx.strokeStyle = '#e0b170'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-70, -18); ctx.lineTo(-70, -23); ctx.lineTo(-34, -23); ctx.lineTo(-34, -18); ctx.moveTo(-58, -22); ctx.lineTo(-58, -6); ctx.moveTo(-46, -22); ctx.lineTo(-46, -6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,222,160,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-67, -15); ctx.lineTo(-35, -15); ctx.stroke();
    ctx.fillStyle = '#f2c55d'; ctx.fillRect(-72, -4, 4, 4); ctx.fillStyle = '#9f2f27'; ctx.fillRect(-35, -4, 4, 4);
  }
  ctx.fillStyle = 'rgba(38,29,21,.25)'; ctx.beginPath(); ctx.ellipse(0, 9, 35, 10, 0, 0, Math.PI * 2); ctx.fill();
  const roll = moving ? wheelPhase : 0;
  const drawWheel = (wx: number, wy: number, radius: number, phase: number) => {
    ctx.fillStyle = '#292827'; ctx.beginPath(); ctx.arc(wx, wy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111211'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(wx, wy, radius - 1.6, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#807866'; ctx.lineWidth = 1.15;
    for (let spoke = 0; spoke < 5; spoke++) { const angle = phase + spoke * Math.PI * .4; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(angle) * (radius - 2.5), wy + Math.sin(angle) * (radius - 2.5)); ctx.stroke(); }
    ctx.fillStyle = '#d3c19b'; ctx.beginPath(); ctx.arc(wx, wy, 2.3, 0, Math.PI * 2); ctx.fill();
  };
  drawWheel(-20, 5, 7.5, roll); drawWheel(21, 5, 7.5, -roll + steer * .25);
  ctx.fillStyle = '#5c3229'; ctx.fillRect(-27, -5, 57, 9);
  const body = ctx.createLinearGradient(0, -25, 0, 6);
  body.addColorStop(0, '#dc7250'); body.addColorStop(.55, '#bd4f39'); body.addColorStop(1, '#87362e');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-29, -12); ctx.lineTo(1, -12); ctx.lineTo(7, -27); ctx.lineTo(24, -27); ctx.lineTo(30, -11); ctx.lineTo(30, 1); ctx.lineTo(-29, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8b392e'; ctx.fillRect(-29, -14, 29, 5); ctx.fillStyle = '#e28a57'; ctx.fillRect(-27, -13, 25, 2);
  ctx.strokeStyle = '#703229'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4, -11); ctx.lineTo(28, -11); ctx.moveTo(5, -9); ctx.lineTo(5, 0); ctx.stroke();
  ctx.fillStyle = '#b9d8df'; ctx.beginPath(); ctx.moveTo(9, -24); ctx.lineTo(21, -24); ctx.lineTo(25, -13); ctx.lineTo(7, -13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(239,250,246,.48)'; ctx.beginPath(); ctx.moveTo(10, -23); ctx.lineTo(16, -23); ctx.lineTo(9, -14); ctx.lineTo(7.5, -14); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6c3b31'; ctx.lineWidth = 1.2; ctx.strokeRect(8, -24, 14, 11);
  ctx.fillStyle = '#d7c59d'; ctx.fillRect(29, -8, 3, 5); ctx.fillStyle = '#f0c160'; ctx.fillRect(27, -8, 3, 4);
  ctx.fillStyle = '#9f332b'; ctx.fillRect(-31, -10, 3, 7); ctx.fillStyle = '#e1c071'; ctx.fillRect(-31, -9, 2, 3);
  ctx.fillStyle = '#c3b9a4'; ctx.fillRect(27, 0, 7, 3); ctx.fillRect(-32, 0, 7, 3);
  ctx.fillStyle = '#452f2a'; ctx.fillRect(19, -9, 4, 2); ctx.strokeStyle = '#7d3029'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(16, -11); ctx.lineTo(16, 0); ctx.stroke();
  if (operating) { ctx.fillStyle = '#f2c59f'; ctx.beginPath(); ctx.arc(5, -30, 3.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#80553b'; ctx.fillRect(2, -34, 7, 2.5); }
  ctx.fillStyle = 'rgba(231,221,180,.42)'; ctx.beginPath(); ctx.arc(34 + steer * 3, -7 - Math.abs(headingY) * 2 - Math.sin(now / 300) * 1.2, moving ? 3.3 : 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
