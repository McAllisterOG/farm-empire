import type { AvatarConfig } from '../core/types';
import { TOWN_BUILDINGS, TOWN_DECOR, TOWN_NPCS, type TownNpcDef } from '../data/town.data';
import type { Camera } from './camera';
import type { FarmFacing } from './farmSprites';
import { diamondPath, isoX, isoY, TILE_H } from './iso';
import { farmNightAlpha } from './lighting';
import { TOWN_BOUNDS, TOWN_EXIT, TOWN_WALK_POLYGON } from './townLayout';
import {
  drawTownBuilding, drawTownDecor, drawTownExitSign, drawTownLampGlow, drawTownNpc, drawTownPlayer,
} from './townSprites';
import { drawOldPickup } from './pickupPainter';

export interface TownRenderScene {
  actor: { avatar: AvatarConfig; x: number; y: number; walking: boolean; facing: FarmFacing; name: string };
  clockMinute: number;
  gesturingNpcId: TownNpcDef['id'] | null;
  gestureUntil: number;
  pickup?: { x: number; y: number; trailerOwned: boolean };
  interactionHint?: { label: string; x: number; y: number };
}

interface TownDrawItem { depth: number; draw: () => void }

function project(camera: Camera, point: { x: number; y: number }, ground = false): { x: number; y: number } {
  return { x: camera.sx(isoX(point.x, point.y)), y: camera.sy(isoY(point.x, point.y) + (ground ? TILE_H / 2 : 0)) };
}

function polygonPath(ctx: CanvasRenderingContext2D, camera: Camera, points: readonly { x: number; y: number }[]): void {
  ctx.beginPath();
  points.forEach((point, index) => { const screen = project(camera, point); if (index) ctx.lineTo(screen.x, screen.y); else ctx.moveTo(screen.x, screen.y); });
  ctx.closePath();
}

function drawTownGround(ctx: CanvasRenderingContext2D, camera: Camera): void {
  ctx.fillStyle = '#6e9257'; ctx.fillRect(0, 0, camera.viewW, camera.viewH);
  for (let y = TOWN_BOUNDS.minY; y <= TOWN_BOUNDS.maxY; y++) for (let x = TOWN_BOUNDS.minX; x <= TOWN_BOUNDS.maxX; x++) {
    const screen = project(camera, { x, y }); diamondPath(ctx, screen.x, screen.y);
    const variant = Math.abs((x * 19 + y * 31) % 4); ctx.fillStyle = ['#86a96b', '#80a465', '#8bad70', '#7da061'][variant]; ctx.fill();
    ctx.strokeStyle = 'rgba(71,105,61,.12)'; ctx.lineWidth = 1; ctx.stroke();
  }
  polygonPath(ctx, camera, TOWN_WALK_POLYGON); ctx.fillStyle = '#c6b89e'; ctx.fill(); ctx.strokeStyle = '#806f5b'; ctx.lineWidth = Math.max(2, camera.zoom * 3); ctx.stroke();
  ctx.save(); polygonPath(ctx, camera, TOWN_WALK_POLYGON); ctx.clip();
  for (let y = 6; y <= 15; y++) for (let x = 4; x <= 20; x++) {
    const screen = project(camera, { x, y }); diamondPath(ctx, screen.x, screen.y);
    ctx.strokeStyle = 'rgba(103,91,74,.16)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.restore();
}

function drawTownTree(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number, phase: number): void {
  const sway = Math.sin(now / 2100 + phase) * 1.1;
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom); ctx.fillStyle = '#62432d'; ctx.fillRect(-3, -25, 6, 27); ctx.translate(sway, 0);
  for (const [dx, dy, radius, color] of [[-11, -34, 13, '#436c39'], [11, -34, 13, '#4a783e'], [0, -47, 16, '#568343']] as const) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(dx, dy, radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTownName(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, name: string): void {
  ctx.save(); ctx.font = `700 ${Math.max(10, 11 * zoom)}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; const width = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(39,34,28,.58)'; ctx.fillRect(x - width / 2 - 4, y - 105 * zoom, width + 8, 15 * zoom); ctx.fillStyle = '#fff'; ctx.fillText(name, x, y - 94 * zoom); ctx.restore();
}

function drawTownEdgeCluster(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number): void {
  for (const house of [{ x: 3.6, y: 3.2 }, { x: 21.4, y: 15.2 }, { x: 22.2, y: 4.0 }]) {
    const p = project(camera, house, true); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(zoom * 1.45, zoom * 1.45);
    ctx.fillStyle = 'rgba(45,34,24,.2)'; ctx.beginPath(); ctx.ellipse(0, 3, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#caa66e'; ctx.fillRect(-17, -25, 34, 25); ctx.fillStyle = '#78533b'; ctx.beginPath(); ctx.moveTo(-22, -24); ctx.lineTo(0, -42); ctx.lineTo(22, -24); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#97b7b2'; ctx.fillRect(-11, -17, 7, 7); ctx.fillRect(5, -17, 7, 7); ctx.restore();
  }
  const field = project(camera, { x: 21.8, y: 4.2 }, true); ctx.save(); ctx.translate(field.x, field.y); ctx.scale(zoom, zoom); ctx.strokeStyle = '#7c9e52'; ctx.lineWidth = 3; for (let i = -18; i <= 18; i += 9) { ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i + 8, 12); ctx.stroke(); } ctx.restore();
}

export function renderTown(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  scene: TownRenderScene,
  now: number,
): void {
  const zoom = camera.zoom;
  drawTownGround(ctx, camera);
  drawTownEdgeCluster(ctx, camera, zoom);
  const items: TownDrawItem[] = [];
  const treeAnchors = [
    { x: 3, y: 8 }, { x: 4, y: 13 }, { x: 8, y: 17 }, { x: 13, y: 17 },
    { x: 21, y: 12 }, { x: 22, y: 7 }, { x: 8, y: 2.5 }, { x: 15, y: 2.8 },
  ];
  treeAnchors.forEach((tree, index) => { const screen = project(camera, tree, true); items.push({ depth: tree.x + tree.y, draw: () => drawTownTree(ctx, screen.x, screen.y, zoom, now, index) }); });
  for (const building of TOWN_BUILDINGS) {
    const anchor = { x: building.x + building.w / 2, y: building.y + building.h };
    const screen = project(camera, anchor, true);
    items.push({ depth: anchor.x + anchor.y, draw: () => drawTownBuilding(ctx, screen.x, screen.y, zoom, building, now) });
  }
  for (const decor of TOWN_DECOR) {
    const screen = project(camera, decor, true);
    items.push({ depth: decor.x + decor.y + .1, draw: () => drawTownDecor(ctx, screen.x, screen.y, zoom, decor) });
  }
  for (const npc of TOWN_NPCS) {
    const screen = project(camera, npc, true); const gesturing = scene.gesturingNpcId === npc.id && now < scene.gestureUntil;
    items.push({ depth: npc.x + npc.y + .4, draw: () => drawTownNpc(ctx, screen.x, screen.y, zoom, npc, now, gesturing) });
  }
  if (scene.pickup) {
    const pickupScreen = project(camera, scene.pickup, true);
    items.push({ depth: scene.pickup.x + scene.pickup.y + .3, draw: () => drawOldPickup(ctx, pickupScreen.x, pickupScreen.y, zoom * 1.24, false, false, now, 1, 0, 0, 0, scene.pickup!.trailerOwned) });
  }
  const exitScreen = project(camera, TOWN_EXIT, true);
  items.push({ depth: TOWN_EXIT.x + TOWN_EXIT.y + .2, draw: () => drawTownExitSign(ctx, exitScreen.x, exitScreen.y, zoom) });
  const actorScreen = project(camera, scene.actor, true);
  items.push({ depth: scene.actor.x + scene.actor.y + .45, draw: () => {
    drawTownPlayer(ctx, actorScreen.x, actorScreen.y, zoom, scene.actor.avatar, scene.actor.facing, scene.actor.walking, now);
    drawTownName(ctx, actorScreen.x, actorScreen.y, zoom, scene.actor.name);
  } });
  items.sort((a, b) => a.depth - b.depth); items.forEach((item) => item.draw());

  const night = farmNightAlpha(scene.clockMinute);
  if (night > .01) {
    ctx.fillStyle = `rgba(24,34,76,${night})`; ctx.fillRect(0, 0, camera.viewW, camera.viewH);
    for (const decor of TOWN_DECOR.filter((item) => item.kind === 'lamp')) {
      const screen = project(camera, decor, true); drawTownLampGlow(ctx, screen.x, screen.y, zoom, night);
    }
    for (const building of TOWN_BUILDINGS) {
      const screen = project(camera, building.door, true); drawTownLampGlow(ctx, screen.x, screen.y, zoom, night * .7);
    }
  }
  if (scene.interactionHint) drawTownInteractionHint(ctx, camera, zoom, scene.interactionHint);
}

function drawTownInteractionHint(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, hint: NonNullable<TownRenderScene['interactionHint']>): void {
  const point = project(camera, hint, true); const y = point.y - 66 * zoom;
  ctx.save(); ctx.font = `700 ${Math.max(11, 12 * zoom)}px Segoe UI, sans-serif`; const width = ctx.measureText(hint.label).width + 24;
  ctx.fillStyle = 'rgba(31,48,34,.92)'; ctx.beginPath(); ctx.roundRect(point.x - width / 2, y - 18, width, 26, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(244,226,167,.78)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff8dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hint.label, point.x, y - 5); ctx.restore();
}
