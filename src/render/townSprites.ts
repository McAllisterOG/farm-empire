import type { AvatarConfig } from '../core/types';
import type { TownBuildingDef, TownDecorDef, TownNpcDef } from '../data/town.data';
import type { CountyLifeActor } from './countyLife';
import type { FarmFacing } from './farmSprites';

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
}

function buildingSign(ctx: CanvasRenderingContext2D, label: string, y: number, width: number, color: string): void {
  rect(ctx, -width / 2, y - 12, width, 17, '#f4dfaa');
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(-width / 2, y - 12, width, 17);
  ctx.fillStyle = color; ctx.font = '900 8px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, 0, y);
}

export function drawTownBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  building: TownBuildingDef,
  now: number,
  kitchenCompleted = false,
): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.16, zoom * 1.16);
  if (building.id === 'miller-feed-seed') {
    ellipse(ctx, 0, 5, 62, 15, 'rgba(48,38,25,.24)');
    rect(ctx, -48, -59, 96, 61, '#e3d2a7');
    ctx.strokeStyle = '#c2a873'; ctx.lineWidth = 1.5;
    for (let line = -42; line <= 42; line += 12) { ctx.beginPath(); ctx.moveTo(line, -56); ctx.lineTo(line, -1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-57, -58); ctx.lineTo(0, -91); ctx.lineTo(57, -58); ctx.closePath(); ctx.fillStyle = '#426346'; ctx.fill();
    ctx.fillStyle = '#597b50'; ctx.beginPath(); ctx.moveTo(-50, -57); ctx.lineTo(0, -85); ctx.lineTo(50, -57); ctx.closePath(); ctx.fill();
    rect(ctx, -12, -38, 24, 40, '#63432c'); rect(ctx, -9, -34, 18, 36, '#765038');
    rect(ctx, -39, -42, 17, 18, '#9fc2bd'); rect(ctx, 22, -42, 17, 18, '#9fc2bd');
    const flutter = Math.sin(now / 520) * 1.5;
    for (let stripe = 0; stripe < 6; stripe++) rect(ctx, -48 + stripe * 16, -58, 16, 12 + (stripe % 2 ? flutter : -flutter), stripe % 2 ? '#f1ead2' : '#4e754b');
    buildingSign(ctx, building.sign, -61, 70, '#31533b');
    rect(ctx, -55, 1, 110, 6, '#6d5137');
  } else if (building.id === 'county-grain-exchange') {
    ellipse(ctx, 0, 5, 74, 18, 'rgba(48,38,25,.24)');
    rect(ctx, -60, -65, 120, 67, '#a95741');
    ctx.strokeStyle = '#7e3e32'; ctx.lineWidth = 2;
    for (let line = -52; line < 60; line += 14) { ctx.beginPath(); ctx.moveTo(line, -62); ctx.lineTo(line, 0); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-68, -64); ctx.lineTo(0, -99); ctx.lineTo(68, -64); ctx.closePath(); ctx.fillStyle = '#663b32'; ctx.fill();
    rect(ctx, -22, -47, 44, 49, '#5b3d2c'); rect(ctx, -17, -42, 34, 44, '#77523a');
    rect(ctx, -50, -47, 16, 18, '#b9d3d0'); rect(ctx, 34, -47, 16, 18, '#b9d3d0');
    rect(ctx, 46, -105, 29, 107, '#d9c9a3'); rect(ctx, 50, -98, 21, 100, '#c7b488');
    ctx.beginPath(); ctx.moveTo(44, -104); ctx.lineTo(61, -122); ctx.lineTo(78, -104); ctx.closePath(); ctx.fillStyle = '#705047'; ctx.fill();
    rect(ctx, 72, -84, 28, 7, '#886345');
    ctx.strokeStyle = '#886345'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(97, -80); ctx.lineTo(82, -42); ctx.stroke();
    buildingSign(ctx, building.sign, -68, 82, '#74402f');
    rect(ctx, -66, 1, 140, 7, '#63442e');
  } else if (building.id === 'county-pantry-kitchen') {
    ellipse(ctx, 0, 5, 67, 17, 'rgba(48,38,25,.24)'); rect(ctx, -58, -58, 116, 60, '#e7c58d');
    ctx.beginPath(); ctx.moveTo(-66, -57); ctx.lineTo(0, -92); ctx.lineTo(66, -57); ctx.closePath(); ctx.fillStyle = '#a9533d'; ctx.fill();
    rect(ctx, -17, -42, 34, 44, '#71442d'); rect(ctx, -13, -37, 26, 39, '#9a6040');
    rect(ctx, -51, -41, 23, 20, '#c2d8ca'); rect(ctx, 29, -41, 23, 20, '#c2d8ca');
    rect(ctx, -50, -13, 22, 12, '#7a9250'); rect(ctx, 28, -13, 22, 12, '#d36d4a');
    if (kitchenCompleted) { rect(ctx, -10, -37, 20, 16, '#ffe794'); rect(ctx, -8, -35, 16, 12, '#fff5bd'); }
    buildingSign(ctx, building.sign, -61, 112, '#7d4131'); rect(ctx, -62, 1, 124, 7, '#6d4934');
  } else {
    ellipse(ctx, 0, 5, 76, 18, 'rgba(48,38,25,.24)');
    rect(ctx, -66, -60, 132, 62, '#8ca2a0');
    ctx.strokeStyle = '#687d7c'; ctx.lineWidth = 1.5;
    for (let line = -58; line <= 58; line += 13) { ctx.beginPath(); ctx.moveTo(line, -57); ctx.lineTo(line, 1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-73, -60); ctx.lineTo(-7, -87); ctx.lineTo(73, -60); ctx.closePath(); ctx.fillStyle = '#495d5d'; ctx.fill();
    rect(ctx, 3, -44, 50, 46, '#45575a');
    for (let line = 8; line < 51; line += 10) rect(ctx, line, -40, 2, 38, '#718587');
    rect(ctx, -52, -42, 29, 44, '#6b4933'); rect(ctx, -48, -38, 21, 40, '#7d573e');
    rect(ctx, -17, -44, 14, 16, '#b7d1cf');
    buildingSign(ctx, building.sign, -62, 84, '#324f50');
    rect(ctx, -73, 1, 146, 7, '#594b3a');
    const puff = Math.max(0, Math.sin(now / 780));
    ellipse(ctx, 53 + puff * 3, -91 - puff * 7, 5 + puff * 2, 4 + puff, 'rgba(225,224,208,.58)');
  }
  ctx.restore();
}

export function drawTownNpc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  npc: TownNpcDef,
  now: number,
  gesturing: boolean,
): void {
  const phase = (now / 360 + (npc.id.charCodeAt(0) % 7)) % 4;
  const bob = Math.sin(phase * Math.PI) * 0.65;
  const wave = gesturing ? Math.sin(now / 85) * 3 : 0;
  const colors = npc.style === 'supply-clerk'
    ? { shirt: '#e8d39e', apron: '#4d754d', hair: '#725039', hat: '#c99742', prop: '#80603d' }
    : npc.style === 'grain-buyer'
      ? { shirt: '#b98554', apron: '#71513d', hair: '#46352c', hat: '#6a4c39', prop: '#d9c89f' }
      : npc.style === 'kitchen-host' ? { shirt: '#d97049', apron: '#f0dfb5', hair: '#31261f', hat: '#f4ead0', prop: '#80a35e' } : { shirt: '#426f86', apron: '#274c61', hair: '#4d342b', hat: '#d4c5a2', prop: '#b9c0bd' };
  ctx.save(); ctx.translate(x, y + bob * zoom); ctx.scale(zoom * 1.65, zoom * 1.65);
  ellipse(ctx, 0, 2, 16, 5, 'rgba(38,30,24,.22)');
  ctx.strokeStyle = '#52392c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-6, 0); ctx.moveTo(5, -20); ctx.lineTo(6, 0); ctx.stroke();
  rect(ctx, -10, -36, 20, 20, colors.shirt); rect(ctx, -7, -31, 14, 17, colors.apron);
  ctx.strokeStyle = colors.shirt; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-8, -31); ctx.lineTo(-14, -18 - wave); ctx.moveTo(8, -31); ctx.lineTo(14, gesturing ? -29 + wave : -18); ctx.stroke();
  ellipse(ctx, 0, -45, 10, 10, '#c9895f');
  ctx.fillStyle = colors.hair; ctx.beginPath(); ctx.arc(0, -49, 10, Math.PI, 0); ctx.fill();
  if (npc.style === 'supply-clerk') { rect(ctx, -13, -55, 26, 4, colors.hat); rect(ctx, -7, -61, 14, 7, colors.hat); }
  if (npc.style === 'grain-buyer') { rect(ctx, -11, -54, 22, 4, colors.hat); rect(ctx, -6, -59, 12, 6, colors.hat); }
  ctx.fillStyle = '#fff'; rect(ctx, -4, -46, 2, 2, '#fff'); rect(ctx, 3, -46, 2, 2, '#fff');
  if (npc.style === 'supply-clerk') {
    ctx.strokeStyle = colors.prop; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-20, 2); ctx.stroke();
    ctx.strokeStyle = '#b38b48'; for (let i = -23; i <= -17; i += 3) { ctx.beginPath(); ctx.moveTo(-20, 1); ctx.lineTo(i, 7); ctx.stroke(); }
  } else if (npc.style === 'grain-buyer') {
    rect(ctx, 10, -25, 10, 14, colors.prop); rect(ctx, 12, -23, 6, 1.5, '#7f6a48'); rect(ctx, 12, -19, 6, 1.5, '#7f6a48');
  } else if (npc.style === 'kitchen-host') {
    rect(ctx, 10, -26, 12, 10, colors.prop); ellipse(ctx, 16, -30, 7, 3, '#d6b744');
  } else {
    ctx.strokeStyle = colors.prop; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(12, -21); ctx.lineTo(20, -29); ctx.stroke();
    ellipse(ctx, 21, -30, 4, 2, colors.prop);
  }
  ctx.restore();
}

export function drawTownPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  avatar: AvatarConfig,
  facing: FarmFacing,
  walking: boolean,
  now: number,
): void {
  const frame = walking ? Math.floor(now / 100) % 4 : 0;
  const bob = walking && frame === 1 ? -2 : walking && frame === 3 ? 1 : Math.sin(now / 700) * .6;
  const swing = walking ? (frame % 2 ? 4 : -4) : 0;
  const skin = avatar.skin.includes('deep') ? '#7a4d38' : avatar.skin.includes('tan') ? '#bd8056' : '#f0c29b';
  const hair = avatar.hair.includes('black') ? '#25201e' : '#70422c';
  ctx.save(); ctx.translate(x, y + bob * zoom); ctx.scale(zoom * 1.9, zoom * 1.9);
  ellipse(ctx, 0, 2, 16, 5, 'rgba(38,30,24,.22)');
  ctx.strokeStyle = '#365b9a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-7 + swing, -8); ctx.moveTo(5, -20); ctx.lineTo(7 - swing, -8); ctx.stroke();
  ctx.strokeStyle = '#5a3825'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-5 - swing, 0); ctx.moveTo(4, -9); ctx.lineTo(5 + swing, 0); ctx.stroke();
  rect(ctx, -9, -29, 18, 21, '#3e78a8'); rect(ctx, -5, -29, 10, 13, '#f0dfb5'); rect(ctx, -9, -29, 18, 4, '#d99b3d');
  ellipse(ctx, 0, -38, 9, 9, skin); ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -42, 9, Math.PI, 0); ctx.fill();
  rect(ctx, -11, -49, 22, 4, '#c58a2e'); rect(ctx, -6, -54, 12, 7, '#c58a2e');
  if (facing !== 'north') { const eyeX = facing === 'east' ? 3 : facing === 'west' ? -3 : 0; rect(ctx, eyeX - 2, -39, 2, 2, '#fff'); }
  if (facing === 'south') rect(ctx, 2, -39, 2, 2, '#fff');
  if (facing === 'north') rect(ctx, -8, -43, 16, 10, hair);
  ctx.restore();
}

/** Unlabelled ambient residents: visually distinct from the three service NPCs. */
export function drawCountyLifeActor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  actor: CountyLifeActor,
  now: number,
): void {
  const frame = actor.walking ? Math.floor(now / 115) % 4 : 0;
  const bob = actor.walking ? (frame === 1 ? -1.5 : frame === 3 ? 1 : 0) : Math.sin(now / 760 + actor.id.length) * .55;
  const swing = actor.walking ? (frame % 2 ? 3.5 : -3.5) : 0;
  const palette = actor.kind === 'stand-customer'
    ? { skin: '#9b6549', hair: '#3b2923', shirt: '#a84f3e', coat: '#365f70', legs: '#65432e', hat: '#d6b56a' }
    : actor.kind === 'town-shopper'
      ? { skin: '#d8a175', hair: '#6f4330', shirt: '#d9b86b', coat: '#4e774e', legs: '#514337', hat: '#9b6940' }
      : { skin: '#8b5943', hair: '#292322', shirt: '#d3b58b', coat: '#8b5744', legs: '#3e4850', hat: '#577184' };
  const direction = actor.facing === 'west' ? -1 : 1;
  ctx.save(); ctx.translate(x, y + bob * zoom); ctx.scale(zoom * 1.48, zoom * 1.48);
  ellipse(ctx, 0, 2, 15, 4.5, 'rgba(38,30,24,.2)');
  ctx.strokeStyle = palette.legs; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(-5 - swing, 0); ctx.moveTo(4, -17); ctx.lineTo(5 + swing, 0); ctx.stroke();
  rect(ctx, -9, -34, 18, 19, palette.coat); rect(ctx, -5, -33, 10, 12, palette.shirt);
  ctx.strokeStyle = palette.coat; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-7, -30); ctx.lineTo(-12 - swing * .5, -17); ctx.moveTo(7, -30); ctx.lineTo(12 + swing * .5, -17); ctx.stroke();
  ellipse(ctx, 0, -43, 9, 9, palette.skin);
  ctx.fillStyle = palette.hair; ctx.beginPath(); ctx.arc(0, -47, 9, Math.PI, 0); ctx.fill();
  if (actor.kind === 'stand-customer') {
    rect(ctx, -11, -53, 22, 4, palette.hat); rect(ctx, -6, -58, 12, 6, palette.hat);
  } else if (actor.kind === 'town-neighbor') {
    rect(ctx, -9, -52, 18, 4, palette.hat); rect(ctx, -6, -57, 12, 6, palette.hat);
  }
  if (actor.facing !== 'north') {
    rect(ctx, direction * 2 - 1, -44, 2, 2, '#fff');
    if (actor.facing === 'south') rect(ctx, -3, -44, 2, 2, '#fff');
  } else rect(ctx, -7, -48, 14, 8, palette.hair);
  if (actor.kind === 'stand-customer' || actor.kind === 'town-shopper') {
    const basketX = direction * 14;
    ctx.strokeStyle = '#6b472d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(basketX, -15, 6, Math.PI, 0); ctx.stroke();
    rect(ctx, basketX - 7, -15, 14, 10, '#9b6b3c');
    rect(ctx, basketX - 5, -17, 4, 3, '#d7b744'); rect(ctx, basketX, -18, 4, 4, '#76964a');
  } else {
    ctx.strokeStyle = '#6c4b31'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(direction * 12, -16); ctx.lineTo(direction * 15, -2); ctx.stroke();
  }
  ctx.restore();
}

export function drawTownDecor(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, decor: TownDecorDef): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom);
  ellipse(ctx, 0, 2, decor.kind === 'bench' ? 23 : 14, 5, 'rgba(43,34,25,.2)');
  if (decor.kind === 'lamp') {
    rect(ctx, -2, -43, 4, 45, '#4a4a3f'); rect(ctx, -7, -48, 14, 8, '#6e5a3b'); rect(ctx, -5, -47, 10, 6, '#f3cf75');
  } else if (decor.kind === 'bench') {
    rect(ctx, -22, -19, 44, 6, '#7b5432'); rect(ctx, -22, -10, 44, 5, '#8f653c'); rect(ctx, -17, -5, 4, 8, '#4d4338'); rect(ctx, 13, -5, 4, 8, '#4d4338');
  } else if (decor.kind === 'sacks') {
    ellipse(ctx, -7, -6, 9, 8, '#b89b62'); ellipse(ctx, 8, -7, 9, 9, '#cfb275'); rect(ctx, 1, -10, 4, 3, '#6b5335');
  } else if (decor.kind === 'pallet') {
    rect(ctx, -18, -3, 36, 5, '#765135'); rect(ctx, -15, -16, 14, 13, '#a8703d'); rect(ctx, 2, -20, 14, 17, '#b77b42');
  } else {
    ctx.strokeStyle = '#2e2e2c'; ctx.lineWidth = 5; for (const [dx, dy] of [[-7, -6], [6, -8], [0, -17]] as const) { ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2); ctx.stroke(); }
  }
  ctx.restore();
}

export function drawTownExitSign(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.15, zoom * 1.15);
  ellipse(ctx, 0, 3, 24, 7, 'rgba(43,34,25,.2)'); rect(ctx, -18, -42, 4, 44, '#6c4c31'); rect(ctx, 15, -42, 4, 44, '#6c4c31');
  rect(ctx, -28, -49, 56, 20, '#eadba9'); ctx.strokeStyle = '#765236'; ctx.lineWidth = 2; ctx.strokeRect(-28, -49, 56, 20);
  ctx.fillStyle = '#426144'; ctx.font = '900 9px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TO FARM', 0, -36);
  ctx.beginPath(); ctx.moveTo(-8, -21); ctx.lineTo(8, -21); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill(); ctx.restore();
}

export function drawTownLampGlow(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, alpha: number): void {
  const radius = 45 * zoom; const gradient = ctx.createRadialGradient(x, y - 40 * zoom, 2, x, y - 40 * zoom, radius);
  gradient.addColorStop(0, `rgba(255,219,127,${alpha * .85})`); gradient.addColorStop(1, 'rgba(255,219,127,0)');
  ctx.fillStyle = gradient; ctx.fillRect(x - radius, y - 40 * zoom - radius, radius * 2, radius * 2);
}
