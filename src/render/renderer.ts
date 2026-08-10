/**
 * 场景渲染器：地形 → 地块 → 按深度排序的实体 → 徽章 → 日夜色调。
 * 支持渲染玩家自己的岛、NPC 邻居岛、好友快照岛（三者都归一成 RenderScene）。
 */
import type {
  AnimalInstance, AvatarConfig, BeastInstance, FarmPlot, GameState, Placement, Terrain,
} from '../core/types';
import { buildTerrain } from '../core/island';
import { buildingDef } from '../core/registry';
import { cropView } from '../core/crops';
import { animalPhase } from '../core/animals';
import { WATER_COOLDOWN_MS } from '../core/balance';
import { FARM_TOWN_GATE } from '../core/townGateway';
import { Camera } from './camera';
import { diamondPath, isoX, isoY, TILE_H, TILE_W } from './iso';
import { charKey, drawSprite } from './sprites';
import { farmMainlandBounds, farmPlotFootprint, farmUprightPose, farmWorldPoint } from './farmLayout';
import { farmLandmarks } from './farmLayout';
import { farmGroundVariant } from './farmTerrain';
import { FARM_WALK_FRAME_COUNT, type FarmFacing } from './farmSprites';
import { FARM_DECOR_MANIFEST, FARM_FENCE_MANIFEST, FARM_FIREFLY_ANCHORS, farmWindbreakAnchors, type FarmDecor, type FarmFenceCue } from './farmDecor';
import { farmNightAlpha as farmClockNightAlpha, nightAlphaAtHour as clockNightAlpha } from './lighting';
import { renderTown, type TownRenderScene } from './townRenderer';
import { TOWN_CAMERA } from './townLayout';
import { tractorToolbarPoseFromRenderState } from '../core/farmTractorMotion';

export interface SceneActor {
  avatar: AvatarConfig;
  x: number;   // 格坐标（浮点）
  y: number;
  walking: boolean;
  name?: string;
  facing?: FarmFacing;
}

/** 渲染层看到的统一场景描述 */
export interface RenderScene {
  seed: number;
  islandTier: number;
  plots: FarmPlot[];
  placements: Placement[];
  animals: AnimalInstance[];
  beasts: BeastInstance[];
  weeds: { uid: number; x: number; y: number }[];
  pets: { defId: string; x: number; y: number }[];
  actors: SceneActor[];
  /** 悬停格与可否操作提示 */
  hover: { tx: number; ty: number; ok: boolean } | null;
  /** 编辑/摆放模式下的虚影 */
  ghost: { defId: string; tx: number; ty: number; ok: boolean } | null;
  /** Optional Farm Empire overlay data; legacy scenes omit it. */
  farm?: {
    lockedTiles: { x: number; y: number }[];
    parcelLabel: string;
    tractor: {
      name: string;
      status: 'operational' | 'maintenance';
      x: number;
      y: number;
      operating?: boolean;
      working?: boolean;
      moving?: boolean;
      headingX?: number;
      headingY?: number;
      steer?: number;
      wheelPhase?: number;
    };
    scout: { x: number; y: number; moving: boolean; mode: 'follow' | 'home'; facing: FarmFacing; scratching: boolean };
    clockMinute: number;
  };
  /** Optional isolated County Service Center scene; never serialized. */
  town?: TownRenderScene;
}

export function sceneFromState(state: GameState): RenderScene {
  return {
    seed: state.seed,
    islandTier: state.islandTier,
    plots: state.plots,
    placements: state.placements,
    animals: state.animals,
    beasts: state.beasts,
    weeds: state.weeds,
    pets: state.pets.map((p) => ({ defId: p.defId, x: p.x, y: p.y })),
    actors: [],
    hover: null,
    ghost: null,
  };
}

interface DrawItem {
  depth: number;
  draw: () => void;
}

/** 一天中的光照：返回夜色覆盖透明度 0(白天)~0.45(深夜) */
export function nightAlpha(now: number): number {
  const d = new Date(now);
  const override = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).__PI_HOUR__
    : undefined;
  const hour = typeof override === 'number' ? override : d.getHours() + d.getMinutes() / 60;
  if (hour >= 7 && hour <= 17) return 0;
  if (hour > 17 && hour < 20) return ((hour - 17) / 3) * 0.42;
  if (hour >= 20 || hour < 5) return 0.42;
  return (1 - (hour - 5) / 2) * 0.42; // 5-7 点渐亮
}

/** Shared lighting curve for an explicit farm-clock or real-world hour. */
export function nightAlphaAtHour(hour: number): number {
  return clockNightAlpha(hour);
}

export function farmNightAlpha(clockMinute: number): number {
  return farmClockNightAlpha(clockMinute);
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera = new Camera();
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera.resize(w, h);
  }

  /** 主绘制入口 */
  render(scene: RenderScene, now: number): void {
    const { ctx, camera } = this;
    const zoom = camera.zoom;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (scene.town) {
      renderTown(ctx, camera, scene.town, now);
      return;
    }

    const farmScene = Boolean(scene.farm);
    if (farmScene) {
      this.renderFarm(scene, now);
      return;
    }

    // 海洋底色
    ctx.fillStyle = scene.farm ? '#7fa9b5' : '#4aa8d8';
    ctx.fillRect(0, 0, camera.viewW, camera.viewH);

    const terrain = buildTerrain(scene.seed, scene.islandTier);
    const size = terrain.length;

    // 可视格范围粗裁剪
    const pad = 3;
    const corners = [
      camera.tileAt(0, 0), camera.tileAt(camera.viewW, 0),
      camera.tileAt(0, camera.viewH), camera.tileAt(camera.viewW, camera.viewH),
    ];
    const minTx = Math.max(0, Math.min(...corners.map((c) => c.tx)) - pad);
    const maxTx = Math.min(size - 1, Math.max(...corners.map((c) => c.tx)) + pad);
    const minTy = Math.max(0, Math.min(...corners.map((c) => c.ty)) - pad);
    const maxTy = Math.min(size - 1, Math.max(...corners.map((c) => c.ty)) + pad);

    // ---- 地形
    const waterPhase = Math.floor(now / 700) % 3;
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const t: Terrain = terrain[ty][tx];
        const sx = camera.sx(isoX(tx, ty));
        const sy = camera.sy(isoY(tx, ty));
        const variant = (tx * 7 + ty * 13) % 4;
        if (t === 'water') {
          // 岸边浅水 / 远处深水
          const nearLand =
            (tx > 0 && terrain[ty][tx - 1] !== 'water') || (tx < size - 1 && terrain[ty][tx + 1] !== 'water') ||
            (ty > 0 && terrain[ty - 1][tx] !== 'water') || (ty < size - 1 && terrain[ty + 1][tx] !== 'water');
          drawSprite(ctx, `tile:water:${(variant + waterPhase) % 4}:${nearLand ? 'shallow' : 'deep'}`, sx, sy, zoom);
        } else {
          drawSprite(ctx, `tile:${t}:${variant}`, sx, sy, zoom);
        }
      }
    }

    // ---- 地块（贴地，先于实体）
    for (const plot of scene.plots) {
      const sx = camera.sx(isoX(plot.x, plot.y));
      const sy = camera.sy(isoY(plot.x, plot.y));
      const wet = !!plot.crop && now - plot.crop.lastWateredAt < WATER_COOLDOWN_MS;
      drawSprite(ctx, `tile:plot:${wet ? 'wet' : 'dry'}`, sx, sy, zoom);
    }
    if (scene.farm && scene.farm.lockedTiles.length > 0) {
      ctx.save();
      ctx.setLineDash([5 * zoom, 4 * zoom]);
      for (const tile of scene.farm.lockedTiles) {
        const sx = camera.sx(isoX(tile.x, tile.y));
        const sy = camera.sy(isoY(tile.x, tile.y));
        diamondPath(ctx, sx, sy, TILE_W * zoom - 5, TILE_H * zoom - 3);
        ctx.fillStyle = 'rgba(124, 86, 52, 0.34)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(106, 63, 34, 0.95)';
        ctx.lineWidth = Math.max(1.5, 2 * zoom);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const centerX = scene.farm.lockedTiles.reduce((sum, tile) => sum + tile.x, 0) / scene.farm.lockedTiles.length;
      const centerY = scene.farm.lockedTiles.reduce((sum, tile) => sum + tile.y, 0) / scene.farm.lockedTiles.length;
      const labelX = camera.sx(isoX(centerX, centerY));
      const labelY = camera.sy(isoY(centerX, centerY)) - 26 * zoom;
      ctx.font = `700 ${Math.max(10, Math.round(11 * zoom))}px "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      const labelWidth = ctx.measureText(`LOCKED · ${scene.farm.parcelLabel}`).width + 14;
      ctx.fillStyle = 'rgba(255, 248, 226, 0.95)';
      ctx.fillRect(labelX - labelWidth / 2, labelY - 14, labelWidth, 20);
      ctx.strokeStyle = '#8b5a32';
      ctx.strokeRect(labelX - labelWidth / 2, labelY - 14, labelWidth, 20);
      ctx.fillStyle = '#6d4124';
      ctx.fillText(`LOCKED · ${scene.farm.parcelLabel}`, labelX, labelY + 1);
      ctx.textAlign = 'start';
      ctx.restore();
    }
    // 道路也贴地
    for (const pl of scene.placements) {
      const def = buildingDef(pl.defId);
      if (def.category !== 'path') continue;
      const sx = camera.sx(isoX(pl.x, pl.y));
      const sy = camera.sy(isoY(pl.x, pl.y));
      drawSprite(ctx, `bld:${pl.defId}`, sx, sy + (TILE_H / 2) * zoom, zoom);
    }

    // ---- 悬停高亮
    if (scene.hover) {
      const sx = camera.sx(isoX(scene.hover.tx, scene.hover.ty));
      const sy = camera.sy(isoY(scene.hover.tx, scene.hover.ty));
      drawSprite(ctx, `hl:${scene.hover.ok ? 'ok' : 'bad'}`, sx, sy, zoom);
    }

    // ---- 实体深度排序
    const items: DrawItem[] = [];
    const bob = Math.sin(now / 350) * 1.6;

    for (const plot of scene.plots) {
      if (!plot.crop) continue;
      const crop = plot.crop;
      const view = cropView(crop, now);
      const sx = camera.sx(isoX(plot.x, plot.y));
      const sy = camera.sy(isoY(plot.x, plot.y) + TILE_H / 2);
      items.push({
        depth: plot.x + plot.y,
        draw: () => {
          drawSprite(ctx, `crop:${crop.defId}:${view.stage}`, sx, sy, zoom);
          if (view.stage === 'ready') {
            drawSprite(ctx, 'fx:ready', sx, sy - 52 * zoom + bob * zoom, zoom);
          } else if (view.stage === 'withered') {
            drawSprite(ctx, 'fx:hungry', sx, sy - 40 * zoom + bob * zoom, zoom);
          }
        },
      });
    }

    for (const pl of scene.placements) {
      const def = buildingDef(pl.defId);
      if (def.category === 'path') continue;
      const cx = pl.x + (def.w - 1) / 2;
      const cy = pl.y + (def.h - 1) / 2;
      const sx = camera.sx(isoX(cx, cy));
      const sy = camera.sy(isoY(cx, cy) + TILE_H / 2);
      items.push({
        depth: pl.x + def.w - 1 + pl.y + def.h - 1,
        draw: () => {
          if (pl.rot === 1) {
            ctx.save();
            ctx.translate(sx, 0);
            ctx.scale(-1, 1);
            drawSprite(ctx, `bld:${pl.defId}`, 0, sy, zoom);
            ctx.restore();
          } else {
            drawSprite(ctx, `bld:${pl.defId}`, sx, sy, zoom);
          }
        },
      });
    }

    for (const a of scene.animals) {
      const sx = camera.sx(isoX(a.x, a.y));
      const sy = camera.sy(isoY(a.x, a.y) + TILE_H / 2);
      const phase = animalPhase(a, now);
      items.push({
        depth: a.x + a.y,
        draw: () => {
          drawSprite(ctx, `animal:${a.defId}`, sx, sy + Math.abs(Math.sin(now / 400 + a.uid)) * -2 * zoom, zoom);
          if (phase === 'hungry') drawSprite(ctx, 'fx:hungry', sx, sy - 46 * zoom + bob * zoom, zoom);
          else if (phase === 'ready') drawSprite(ctx, 'fx:ready', sx, sy - 46 * zoom + bob * zoom, zoom);
        },
      });
    }

    for (const b of scene.beasts) {
      const sx = camera.sx(isoX(b.x, b.y));
      const sy = camera.sy(isoY(b.x, b.y) + TILE_H / 2);
      items.push({
        depth: b.x + b.y,
        draw: () => {
          const shake = Math.sin(now / 90 + b.uid) * 1.2 * zoom;
          drawSprite(ctx, `beast:${b.defId}`, sx + shake, sy, zoom);
          drawSprite(ctx, 'fx:beast', sx, sy - 48 * zoom + bob * zoom, zoom);
        },
      });
    }

    for (const w of scene.weeds) {
      const sx = camera.sx(isoX(w.x, w.y));
      const sy = camera.sy(isoY(w.x, w.y));
      items.push({ depth: w.x + w.y, draw: () => drawSprite(ctx, 'weed', sx, sy, zoom) });
    }

    for (const p of scene.pets) {
      const sx = camera.sx(isoX(p.x, p.y));
      const sy = camera.sy(isoY(p.x, p.y) + TILE_H / 2);
      items.push({
        depth: p.x + p.y,
        draw: () => drawSprite(ctx, `pet:${p.defId}`, sx, sy + Math.abs(Math.sin(now / 300 + p.x)) * -2.4 * zoom, zoom),
      });
    }

    if (scene.farm) {
      const tractor = scene.farm.tractor;
      const sx = camera.sx(isoX(tractor.x, tractor.y));
      const sy = camera.sy(isoY(tractor.x, tractor.y) + TILE_H / 2);
      items.push({
        depth: tractor.x + tractor.y,
        draw: () => drawOldTractor(ctx, sx, sy, zoom, tractor.status, !!tractor.operating, !!tractor.working, now),
      });
    }

    for (const actor of scene.actors) {
      const sx = camera.sx(isoX(actor.x, actor.y));
      const sy = camera.sy(isoY(actor.x, actor.y) + TILE_H / 2);
      const frame = actor.walking ? Math.floor(now / 90) % 8 : -1;
      items.push({
        depth: actor.x + actor.y + 0.01,
        draw: () => {
          drawSprite(ctx, charKey(actor.avatar, frame), sx, sy, zoom);
          if (actor.name) {
            ctx.font = `${Math.round(11 * zoom)}px "Segoe UI", sans-serif`;
            ctx.textAlign = 'center';
            const tw = ctx.measureText(actor.name).width;
            ctx.fillStyle = 'rgba(40, 34, 28, 0.55)';
            ctx.fillRect(sx - tw / 2 - 4, sy - 76 * zoom, tw + 8, 14 * zoom);
            ctx.fillStyle = '#fff';
            ctx.fillText(actor.name, sx, sy - 76 * zoom + 11 * zoom);
            ctx.textAlign = 'start';
          }
        },
      });
    }

    // 摆放虚影
    if (scene.ghost) {
      const def = buildingDef(scene.ghost.defId);
      const g = scene.ghost;
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const sx = camera.sx(isoX(g.tx + dx, g.ty + dy));
          const sy = camera.sy(isoY(g.tx + dx, g.ty + dy));
          drawSprite(ctx, `hl:${g.ok ? 'ok' : 'bad'}`, sx, sy, zoom);
        }
      }
      const cx = g.tx + (def.w - 1) / 2;
      const cy = g.ty + (def.h - 1) / 2;
      items.push({
        depth: 9999,
        draw: () => {
          ctx.globalAlpha = 0.65;
          drawSprite(ctx, `bld:${g.defId}`, camera.sx(isoX(cx, cy)), camera.sy(isoY(cx, cy) + TILE_H / 2), zoom);
          ctx.globalAlpha = 1;
        },
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const item of items) item.draw();

    // ---- 日夜色调
    const na = nightAlpha(now);
    if (na > 0.01) {
      ctx.fillStyle = `rgba(24, 34, 76, ${na})`;
      ctx.fillRect(0, 0, camera.viewW, camera.viewH);
      // 路灯/篝火光晕
      for (const pl of scene.placements) {
        if (pl.defId !== 'bld_streetlamp' && pl.defId !== 'bld_bonfire' && pl.defId !== 'bld_lighthouse') continue;
        const sx = camera.sx(isoX(pl.x, pl.y));
        const sy = camera.sy(isoY(pl.x, pl.y));
        const r = (pl.defId === 'bld_lighthouse' ? 110 : 70) * zoom;
        const grad = ctx.createRadialGradient(sx, sy - 30 * zoom, 6, sx, sy - 30 * zoom, r);
        grad.addColorStop(0, `rgba(255, 224, 130, ${na * 0.75})`);
        grad.addColorStop(1, 'rgba(255, 224, 130, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx - r, sy - 30 * zoom - r, r * 2, r * 2);
      }
    }
  }

  centerOnIsland(scene: RenderScene): void {
    if (scene.farm) {
      const point = farmWorldPoint({ x: 9, y: 8.5 });
      this.camera.centerOnTile(point.x, point.y);
      return;
    }
    const size = buildTerrain(scene.seed, scene.islandTier).length;
    this.camera.centerOnTile(size / 2 - 0.5, size / 2 - 0.5);
  }

  centerOnFarm(): void {
    const point = farmWorldPoint({ x: 7.8, y: 7.4 });
    this.camera.centerOnTile(point.x, point.y);
  }

  centerOnTown(): void {
    this.camera.centerOnTile(TOWN_CAMERA.x, TOWN_CAMERA.y);
    this.camera.zoom = TOWN_CAMERA.zoom;
  }

  /** Farm-only presentation branch.  Legacy island rendering above stays isolated. */
  private renderFarm(scene: RenderScene, now: number): void {
    const { ctx, camera } = this;
    const zoom = camera.zoom;
    ctx.fillStyle = '#6f9254';
    ctx.fillRect(0, 0, camera.viewW, camera.viewH);
    const corners = [camera.tileAt(0, 0), camera.tileAt(camera.viewW, 0), camera.tileAt(0, camera.viewH), camera.tileAt(camera.viewW, camera.viewH)];
    const bounds = farmMainlandBounds();
    const minX = Math.max(bounds.minX, Math.min(...corners.map((p) => p.tx)) - 3);
    const maxX = Math.min(bounds.maxX, Math.max(...corners.map((p) => p.tx)) + 3);
    const minY = Math.max(bounds.minY, Math.min(...corners.map((p) => p.ty)) - 3);
    const maxY = Math.min(bounds.maxY, Math.max(...corners.map((p) => p.ty)) + 3);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      drawSprite(ctx, `tile:farmground:${farmGroundVariant(scene.seed, x, y)}`, camera.sx(isoX(x, y)), camera.sy(isoY(x, y)), zoom);
    }
    drawFarmyard(ctx, camera, zoom);
    for (const plot of scene.plots) drawFarmSection(ctx, camera, plot, now, zoom, false);
    for (const plot of scene.farm!.lockedTiles) drawFarmSection(ctx, camera, { ...plot, uid: -1, crop: null }, now, zoom, true);
    drawLockedParcelLabel(ctx, camera, scene, zoom);

    if (scene.hover) {
      farmFootprintPath(ctx, camera, farmPlotFootprint({ x: scene.hover.tx, y: scene.hover.ty }));
      ctx.fillStyle = 'rgba(255, 239, 132, .18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 239, 132, .92)'; ctx.lineWidth = Math.max(1.5, zoom * 2); ctx.stroke();
    }

    const items: DrawItem[] = [];
    const bob = Math.sin(now / 350) * 1.6;
    for (const tree of farmWindbreakAnchors()) {
      items.push({ depth: tree.x + tree.y, draw: () => drawFarmTree(ctx, camera.sx(isoX(tree.x, tree.y)), camera.sy(isoY(tree.x, tree.y)), zoom, now, tree.x * 19 + tree.y) });
    }
    for (const fence of FARM_FENCE_MANIFEST) {
      items.push({ depth: fence.x + fence.y + .05, draw: () => drawFarmFence(ctx, camera.sx(isoX(fence.x, fence.y)), camera.sy(isoY(fence.x, fence.y) + TILE_H / 2), zoom, fence) });
    }
    for (const prop of FARM_DECOR_MANIFEST) {
      const point = farmWorldPoint(prop);
      items.push({ depth: point.x + point.y + .1, draw: () => drawFarmDecor(ctx, camera.sx(isoX(point.x, point.y)), camera.sy(isoY(point.x, point.y) + TILE_H / 2), zoom, prop) });
    }
    const townGatePoint = farmWorldPoint(FARM_TOWN_GATE);
    items.push({ depth: townGatePoint.x + townGatePoint.y + .18, draw: () => drawFarmTownGateway(ctx, camera.sx(isoX(townGatePoint.x, townGatePoint.y)), camera.sy(isoY(townGatePoint.x, townGatePoint.y) + TILE_H / 2), zoom) });
    for (const plot of scene.plots) if (plot.crop) {
      const point = farmWorldPoint(plot);
      const stage = cropView(plot.crop, now).stage;
      items.push({ depth: point.x + point.y, draw: () => drawFarmCropRows(ctx, camera, plot, stage, zoom, now, bob) });
    }
    for (const pl of scene.placements) {
      const def = buildingDef(pl.defId);
      // Farm Empire lays its own continuous gravel lane; legacy stone paths are
      // retained in save data but are not rendered as tiny leftover tiles.
      if (def.category === 'path') continue;
      const point = farmWorldPoint({ x: pl.x + (def.w - 1) / 2, y: pl.y + (def.h - 1) / 2 });
      items.push({ depth: point.x + point.y + 0.2, draw: () => pl.defId === 'bld_storage'
        ? drawFarmBarn(ctx, camera.sx(isoX(point.x, point.y)), camera.sy(isoY(point.x, point.y) + TILE_H / 2), zoom)
        : drawSprite(ctx, `bld:${pl.defId}`, camera.sx(isoX(point.x, point.y)), camera.sy(isoY(point.x, point.y) + TILE_H / 2), zoom * 1.16) });
    }
    const doghousePoint = farmWorldPoint(farmLandmarks().doghouse);
    items.push({ depth: doghousePoint.x + doghousePoint.y + 0.15, draw: () => drawFarmDoghouse(ctx, camera.sx(isoX(doghousePoint.x, doghousePoint.y)), camera.sy(isoY(doghousePoint.x, doghousePoint.y) + TILE_H / 2), zoom) });
    const tractor = scene.farm!.tractor;
    const tractorPoint = farmWorldPoint(tractor);
    items.push({ depth: tractorPoint.x + tractorPoint.y + 0.3, draw: () => drawOldTractor(ctx, camera.sx(isoX(tractorPoint.x, tractorPoint.y)), camera.sy(isoY(tractorPoint.x, tractorPoint.y) + TILE_H / 2), zoom, tractor.status, !!tractor.operating, !!tractor.working, now, tractor.headingX, tractor.headingY, tractor.steer, tractor.wheelPhase, !!tractor.moving) });
    const scoutPoint = farmWorldPoint(scene.farm!.scout);
    items.push({ depth: scoutPoint.x + scoutPoint.y + 0.35, draw: () => drawScout(ctx, camera.sx(isoX(scoutPoint.x, scoutPoint.y)), camera.sy(isoY(scoutPoint.x, scoutPoint.y) + TILE_H / 2), zoom, now, scene.farm!.scout.moving, scene.farm!.scout.mode === 'home' && !scene.farm!.scout.moving, scene.farm!.scout.facing) });
    for (const actor of scene.actors) {
      const point = farmWorldPoint(actor);
      items.push({ depth: point.x + point.y + 0.4, draw: () => {
        const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y) + TILE_H / 2);
        drawFarmFarmer(ctx, sx, sy, zoom, actor.avatar, actor.facing ?? 'south', actor.walking ? Math.floor(now / 100) % FARM_WALK_FRAME_COUNT : 0, now);
        if (actor.name) drawFarmName(ctx, sx, sy, actor.name, zoom);
      } });
    }
    items.sort((a, b) => a.depth - b.depth); items.forEach((item) => item.draw());
    const na = farmNightAlpha(scene.farm!.clockMinute);
    if (na > .01) {
      ctx.fillStyle = `rgba(24, 34, 76, ${na})`; ctx.fillRect(0, 0, camera.viewW, camera.viewH);
      drawFarmNightGlow(ctx, camera, zoom, na, now, doghousePoint, scene.placements);
    }
    if (scene.farm!.scout.scratching) drawScoutHeart(ctx, camera.sx(isoX(scoutPoint.x, scoutPoint.y)), camera.sy(isoY(scoutPoint.x, scoutPoint.y)) - 42 * zoom, zoom, now);
  }
}

export { TILE_W };

function farmFootprintPath(ctx: CanvasRenderingContext2D, camera: Camera, footprint: { minX: number; minY: number; maxX: number; maxY: number }): void {
  const corners = [
    { x: footprint.minX, y: footprint.minY }, { x: footprint.maxX, y: footprint.minY },
    { x: footprint.maxX, y: footprint.maxY }, { x: footprint.minX, y: footprint.maxY },
  ].map((point) => ({ x: camera.sx(isoX(point.x, point.y)), y: camera.sy(isoY(point.x, point.y)) }));
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  corners.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.closePath();
}

function drawFarmSection(ctx: CanvasRenderingContext2D, camera: Camera, plot: FarmPlot, now: number, zoom: number, locked: boolean): void {
  const footprint = farmPlotFootprint(plot);
  farmFootprintPath(ctx, camera, footprint);
  const wet = !!plot.crop && now - plot.crop.lastWateredAt < WATER_COOLDOWN_MS;
  ctx.fillStyle = locked ? 'rgba(119, 88, 57, .46)' : wet ? '#6c4930' : '#95643f'; ctx.fill();
  ctx.strokeStyle = locked ? '#6d452c' : '#593a27'; ctx.lineWidth = Math.max(1.2, zoom * 1.7); ctx.stroke();
  if (locked) return;
  // Furrows use the actual large footprint, rather than duplicating old tile artwork.
  ctx.strokeStyle = wet ? 'rgba(56, 35, 21, .46)' : 'rgba(78, 46, 27, .42)'; ctx.lineWidth = Math.max(1, zoom * 1.25);
  for (let index = 1; index < 5; index++) {
    const t = index / 5; const x = footprint.minX + (footprint.maxX - footprint.minX) * t;
    const a = { x: camera.sx(isoX(x, footprint.minY)), y: camera.sy(isoY(x, footprint.minY)) };
    const b = { x: camera.sx(isoX(x, footprint.maxY)), y: camera.sy(isoY(x, footprint.maxY)) };
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function drawFarmCropRows(ctx: CanvasRenderingContext2D, camera: Camera, plot: FarmPlot, stage: string, zoom: number, now: number, bob: number): void {
  const footprint = farmPlotFootprint(plot);
  // Five by four deterministic plants make each section feel like one planted field.
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const x = footprint.minX + (col + .5 + (row % 2 ? .08 : 0)) * (footprint.maxX - footprint.minX) / 5;
    const y = footprint.minY + (row + .5) * (footprint.maxY - footprint.minY) / 4;
    const sx = camera.sx(isoX(x, y)); const sy = camera.sy(isoY(x, y) + TILE_H / 2);
    // Separate row phases read as a breeze across the section, not a global bob.
    const sway = Math.sin(now / 720 + row * 1.17 + col * .34 + plot.x * .7 + plot.y) * (stage === 'seedling' ? .45 : 1.15) * zoom;
    drawSprite(ctx, `crop:${plot.crop!.defId}:${stage}`, sx + sway, sy, zoom * .54);
  }
  const centre = farmWorldPoint(plot); const sx = camera.sx(isoX(centre.x, centre.y)); const sy = camera.sy(isoY(centre.x, centre.y) + TILE_H / 2);
  if (stage === 'ready') drawSprite(ctx, 'fx:ready', sx, sy - 67 * zoom + bob * zoom, zoom * 1.15);
  else if (stage === 'withered') drawSprite(ctx, 'fx:hungry', sx, sy - 56 * zoom + bob * zoom, zoom * 1.15);
}

function drawFarmyard(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number): void {
  // A restrained gravel lane connects the barn, field entrances, and town road.
  const lane = [{ x: 19, y: 14 }, { x: 23, y: 14 }, { x: 26, y: 17 }, { x: 29, y: 20 }, { x: 32, y: 23 }, { x: 35, y: 22 }, farmWorldPoint(FARM_TOWN_GATE)];
  ctx.strokeStyle = '#b9a071'; ctx.lineWidth = 13 * zoom; ctx.lineCap = 'round'; ctx.beginPath();
  lane.forEach((point, index) => { const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y)); index ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke();
  ctx.strokeStyle = 'rgba(100, 75, 46, .35)'; ctx.lineWidth = 2 * zoom; ctx.stroke();
}

function drawFarmTownGateway(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.35, zoom * 1.35);
  ctx.fillStyle = 'rgba(45,34,24,.24)'; ctx.beginPath(); ctx.ellipse(0, 4, 42, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#765036'; ctx.fillRect(-33, -48, 6, 51); ctx.fillRect(27, -48, 6, 51);
  ctx.fillStyle = '#9d7145'; ctx.fillRect(-38, -54, 11, 7); ctx.fillRect(27, -54, 11, 7);
  ctx.fillStyle = '#eadba9'; ctx.fillRect(-46, -70, 92, 25); ctx.strokeStyle = '#704a31'; ctx.lineWidth = 2; ctx.strokeRect(-46, -70, 92, 25);
  ctx.fillStyle = '#355f3e'; ctx.font = '900 11px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TOWN 2 MI', 0, -53);
  ctx.beginPath(); ctx.moveTo(23, -38); ctx.lineTo(37, -30); ctx.lineTo(23, -22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#564436'; ctx.lineWidth = 2; for (let line = -23; line <= 23; line += 9) { ctx.beginPath(); ctx.moveTo(line, -2); ctx.lineTo(line + 6, 6); ctx.stroke(); }
  ctx.restore();
}

function drawFarmDoghouse(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.55, zoom * 1.55);
  ctx.fillStyle = 'rgba(48,34,23,.23)'; ctx.beginPath(); ctx.ellipse(0, 3, 28, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b84f37'; ctx.fillRect(-22, -26, 44, 28);
  ctx.beginPath(); ctx.moveTo(-27, -26); ctx.lineTo(0, -46); ctx.lineTo(27, -26); ctx.closePath(); ctx.fillStyle = '#6e392e'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, -4, 10, Math.PI, 0); ctx.lineTo(10, 2); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fillStyle = '#382b25'; ctx.fill();
  ctx.fillStyle = '#f0d39a'; ctx.font = '700 7px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SCOUT', 0, -31); ctx.restore();
}

function drawFarmFarmer(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, avatar: AvatarConfig, facing: FarmFacing, frame: number, now: number): void {
  const walk = frame % FARM_WALK_FRAME_COUNT; const bob = walk ? (walk === 1 ? -2 : walk === 3 ? 1 : 0) : Math.sin(now / 700) * .8;
  const skin = avatar.skin.includes('deep') ? '#7a4d38' : avatar.skin.includes('tan') ? '#bd8056' : '#f0c29b';
  const hair = avatar.hair.includes('black') ? '#25201e' : '#70422c';
  ctx.save(); ctx.translate(x, y + bob * zoom); ctx.scale(zoom * 2, zoom * 2);
  ctx.fillStyle = 'rgba(38,30,24,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  const swing = walk ? (walk % 2 ? 4 : -4) : 0;
  ctx.strokeStyle = '#365b9a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-7 + swing, -8); ctx.moveTo(5, -20); ctx.lineTo(7 - swing, -8); ctx.stroke();
  ctx.strokeStyle = '#5a3825'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-5 - swing, 0); ctx.moveTo(4, -9); ctx.lineTo(5 + swing, 0); ctx.stroke();
  ctx.fillStyle = '#3e78a8'; ctx.fillRect(-9, -29, 18, 21); ctx.fillStyle = '#f0dfb5'; ctx.fillRect(-5, -29, 10, 13); ctx.fillStyle = '#d99b3d'; ctx.fillRect(-9, -29, 18, 4);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -38, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -42, 9, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#c58a2e'; ctx.fillRect(-11, -49, 22, 4); ctx.fillRect(-6, -54, 12, 7);
  if (facing !== 'north') { ctx.fillStyle = '#fff'; const eyeX = facing === 'east' ? 3 : facing === 'west' ? -3 : 0; ctx.fillRect(eyeX - 2, -39, 2, 2); }
  if (facing === 'south') { ctx.fillStyle = '#fff'; ctx.fillRect(2, -39, 2, 2); ctx.strokeStyle = '#9f5d4e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -35, 3, 0, Math.PI); ctx.stroke(); }
  if (facing === 'north') { ctx.fillStyle = hair; ctx.fillRect(-8, -43, 16, 10); ctx.strokeStyle = '#f0dfb5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -28); ctx.lineTo(-5, -18); ctx.moveTo(5, -28); ctx.lineTo(5, -18); ctx.stroke(); }
  if (facing === 'east' || facing === 'west') { ctx.fillStyle = skin; ctx.fillRect(facing === 'east' ? 8 : -10, -38, 3, 3); }
  ctx.restore();
}

function drawScout(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number, moving: boolean, sitting: boolean, facing: FarmFacing): void {
  const trot = moving ? Math.sin(now / 90) * 2 : 0; const wag = Math.sin(now / 110) * (moving ? .55 : .9);
  ctx.save(); ctx.translate(x, y + trot * zoom); ctx.scale(zoom * 1.2, zoom * 1.2);
  ctx.fillStyle = 'rgba(35,29,23,.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#965b3c'; ctx.beginPath(); ctx.ellipse(sitting ? -3 : 0, sitting ? -12 : -11, sitting ? 10 : 14, sitting ? 15 : 9, 0, 0, Math.PI * 2); ctx.fill();
  if (sitting) { ctx.beginPath(); ctx.ellipse(-8, -2, 10, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  const headX = sitting ? 4 : facing === 'west' ? -11 : facing === 'north' ? 0 : 11; const headY = sitting ? -27 : -17;
  ctx.fillStyle = '#b97b4c'; ctx.beginPath(); ctx.arc(headX, headY, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e2c1'; ctx.fillRect(headX - 2, headY - 5, 4, 8); ctx.fillRect(-5, -6, 6, 3); ctx.fillRect(4, -6, 6, 3);
  ctx.strokeStyle = '#287b80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(headX - 5, headY + 5); ctx.lineTo(headX + 5, headY + 5); ctx.stroke();
  ctx.fillStyle = '#553521'; ctx.beginPath(); ctx.moveTo(7, -22); ctx.lineTo(8, -31); ctx.lineTo(13, -23); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(14, -22); ctx.lineTo(18, -29); ctx.lineTo(18, -19); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6f452b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12, -13); ctx.quadraticCurveTo(-22, -19 + wag * 6, -24, -11 + wag * 4); ctx.stroke();
  ctx.strokeStyle = '#4b3426'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-8 + trot, 1); ctx.moveTo(6, -5); ctx.lineTo(7 - trot, 1); ctx.stroke();
  ctx.fillStyle = '#261d19'; ctx.fillRect(14, -18, 2, 2); ctx.fillRect(18, -15, 3, 2);
  ctx.restore();
}

function drawScoutHeart(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number): void {
  ctx.save(); ctx.translate(x, y - (now % 1200) / 1200 * 12 * zoom); ctx.scale(zoom * 1.5, zoom * 1.5); ctx.font = '22px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2e2c1'; ctx.fillText('♥', 1, 1); ctx.fillStyle = '#ef7d96'; ctx.fillText('♥', 0, 0); ctx.restore();
}

function drawFarmTree(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number, phase: number): void {
  const sway = Math.sin(now / 1900 + phase * .37) * 1.3;
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom);
  ctx.fillStyle = '#68472c'; ctx.fillRect(-2, -19, 4, 20);
  ctx.translate(sway, 0);
  ctx.fillStyle = '#426f35'; ctx.beginPath(); ctx.arc(0, -25, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b8c42'; ctx.beginPath(); ctx.arc(-5, -29, 7, 0, Math.PI * 2); ctx.arc(6, -29, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawFarmFence(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, fence: FarmFenceCue): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom);
  ctx.fillStyle = 'rgba(52,38,25,.18)'; ctx.beginPath(); ctx.ellipse(0, 2, fence.direction === 'east-west' ? 31 : 13, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6f4b2e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const horizontal = fence.direction === 'east-west'; const half = fence.gate ? 18 : 30;
  const post = (px: number, py: number) => { ctx.fillStyle = '#8d6338'; ctx.fillRect(px - 2.5, py - 22, 5, 24); ctx.fillStyle = '#b78a52'; ctx.fillRect(px - 1, py - 20, 2, 17); };
  if (horizontal) {
    post(-half, 0); post(half, 0); ctx.beginPath(); ctx.moveTo(-half, -16); ctx.lineTo(half, -12); ctx.moveTo(-half, -8); ctx.lineTo(half, -5); ctx.stroke();
    if (fence.gate) { ctx.strokeStyle = '#b78a52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(12, -20); ctx.stroke(); }
  } else {
    post(-7, -12); post(7, 12); ctx.beginPath(); ctx.moveTo(-7, -27); ctx.lineTo(7, -4); ctx.moveTo(-2, -25); ctx.lineTo(12, -2); ctx.stroke();
    if (fence.gate) { ctx.strokeStyle = '#b78a52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(12, -5); ctx.stroke(); }
  }
  ctx.restore();
}

function drawFarmDecor(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, prop: FarmDecor): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom);
  ctx.fillStyle = 'rgba(47,34,22,.2)'; ctx.beginPath(); ctx.ellipse(0, 3, prop.type === 'crate-pallet' ? 22 : 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (prop.type === 'hay-bale') {
    ctx.fillStyle = '#b98732'; ctx.fillRect(-12, -18, 24, 20); ctx.fillStyle = '#d5ad4d'; ctx.fillRect(-10, -20, 20, 8); ctx.strokeStyle = '#8e6428'; ctx.lineWidth = 1.5;
    for (const line of [-5, 3]) { ctx.beginPath(); ctx.moveTo(-12, line); ctx.lineTo(12, line + 2); ctx.stroke(); }
  } else if (prop.type === 'crate-pallet') {
    ctx.fillStyle = '#7b522d'; ctx.fillRect(-19, -2, 38, 5); ctx.fillStyle = '#b77b3e'; ctx.fillRect(-17, -14, 15, 13); ctx.fillRect(2, -17, 15, 16); ctx.strokeStyle = '#6b4126'; ctx.lineWidth = 1.5;
    for (const px of [-13, 6]) { ctx.beginPath(); ctx.moveTo(px, -13); ctx.lineTo(px + 8, -2); ctx.moveTo(px + 8, -13); ctx.lineTo(px, -2); ctx.stroke(); }
  } else if (prop.type === 'water-trough') {
    ctx.fillStyle = '#245f65'; ctx.fillRect(-17, -13, 34, 13); ctx.fillStyle = '#57aab0'; ctx.fillRect(-14, -11, 28, 5); ctx.strokeStyle = '#173f46'; ctx.lineWidth = 2; ctx.strokeRect(-17, -13, 34, 13); ctx.fillStyle = '#70482b'; ctx.fillRect(-12, 0, 4, 5); ctx.fillRect(8, 0, 4, 5);
  } else {
    ctx.fillStyle = '#7f9f9c'; ctx.fillRect(-3, -25, 6, 27); ctx.fillStyle = '#b8d2ce'; ctx.fillRect(-5, -27, 10, 5); ctx.strokeStyle = '#4e6f6d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(14, -31); ctx.lineTo(18, -27); ctx.stroke(); ctx.fillStyle = '#795034'; ctx.fillRect(-10, 1, 20, 4);
  }
  ctx.restore();
}

function drawFarmNightGlow(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, alpha: number, now: number, doghousePoint: { x: number; y: number }, placements: RenderScene['placements']): void {
  const barn = placements.find((placement) => placement.defId === 'bld_storage');
  const lights = [doghousePoint, ...(barn ? [farmWorldPoint({ x: barn.x, y: barn.y })] : [])];
  for (const light of lights) {
    const sx = camera.sx(isoX(light.x, light.y)); const sy = camera.sy(isoY(light.x, light.y)) - 17 * zoom; const radius = 47 * zoom;
    const gradient = ctx.createRadialGradient(sx, sy, 2, sx, sy, radius);
    gradient.addColorStop(0, `rgba(255,218,132,${alpha * .7})`); gradient.addColorStop(1, 'rgba(255,218,132,0)');
    ctx.fillStyle = gradient; ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
  }
  const nightStrength = Math.max(0, Math.min(1, alpha / .42));
  FARM_FIREFLY_ANCHORS.forEach((anchor, index) => {
    const fly = farmWorldPoint(anchor); const sx = camera.sx(isoX(fly.x, fly.y)); const sy = camera.sy(isoY(fly.x, fly.y)) - (8 + Math.sin(now / 900 + index) * 3) * zoom;
    ctx.fillStyle = `rgba(255,239,137,${(.42 + Math.sin(now / 500 + index) * .2) * nightStrength})`; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.1, 1.8 * zoom), 0, Math.PI * 2); ctx.fill();
  });
}

function drawLockedParcelLabel(ctx: CanvasRenderingContext2D, camera: Camera, scene: RenderScene, zoom: number): void {
  if (!scene.farm || scene.farm.lockedTiles.length === 0) return;
  const x = scene.farm.lockedTiles.reduce((sum, p) => sum + p.x, 0) / scene.farm.lockedTiles.length;
  const y = scene.farm.lockedTiles.reduce((sum, p) => sum + p.y, 0) / scene.farm.lockedTiles.length;
  const point = farmWorldPoint({ x, y }); const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y)) - 42 * zoom;
  ctx.save(); ctx.font = `700 ${Math.max(10, 12 * zoom)}px Segoe UI, sans-serif`; ctx.textAlign = 'center';
  const label = `LOCKED · ${scene.farm.parcelLabel}`; const width = ctx.measureText(label).width + 16;
  ctx.fillStyle = 'rgba(255,248,226,.94)'; ctx.fillRect(sx - width / 2, sy - 15, width, 21); ctx.strokeStyle = '#805638'; ctx.strokeRect(sx - width / 2, sy - 15, width, 21); ctx.fillStyle = '#694126'; ctx.fillText(label, sx, sy); ctx.restore();
}

function drawFarmName(ctx: CanvasRenderingContext2D, sx: number, sy: number, name: string, zoom: number): void {
  ctx.save(); ctx.font = `${Math.round(11 * zoom)}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; const width = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(40,34,28,.55)'; ctx.fillRect(sx - width / 2 - 4, sy - 118 * zoom, width + 8, 14 * zoom); ctx.fillStyle = '#fff'; ctx.fillText(name, sx, sy - 107 * zoom); ctx.restore();
}

function drawFarmBarn(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 2, zoom * 2);
  ctx.fillStyle = 'rgba(40,30,20,.22)'; ctx.beginPath(); ctx.ellipse(0, 5, 58, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a84634'; ctx.fillRect(-42, -53, 84, 55);
  ctx.strokeStyle = '#7b392d'; ctx.lineWidth = 2; for (let bx = -35; bx < 40; bx += 10) { ctx.beginPath(); ctx.moveTo(bx, -50); ctx.lineTo(bx, -2); ctx.stroke(); }
  ctx.fillStyle = '#f2d8a5'; ctx.fillRect(-45, -54, 90, 6);
  ctx.beginPath(); ctx.moveTo(-50, -53); ctx.lineTo(0, -85); ctx.lineTo(50, -53); ctx.closePath(); ctx.fillStyle = '#70372d'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-44, -54); ctx.lineTo(0, -80); ctx.lineTo(44, -54); ctx.closePath(); ctx.fillStyle = '#bd5840'; ctx.fill();
  ctx.fillStyle = '#e5c788'; ctx.fillRect(-16, -36, 32, 38); ctx.fillStyle = '#69422d'; ctx.fillRect(-12, -32, 24, 34);
  ctx.strokeStyle = '#e5c788'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(0, 2); ctx.stroke();
  ctx.fillStyle = '#b8d7dd'; ctx.fillRect(-34, -37, 12, 12); ctx.fillRect(22, -37, 12, 12);
  ctx.fillStyle = '#b8d7dd'; ctx.fillRect(-5, -68, 10, 9); ctx.fillStyle = '#5a3825'; ctx.fillRect(-45, 2, 90, 5); ctx.restore();
}

function drawOldTractor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  status: 'operational' | 'maintenance',
  operating: boolean,
  working: boolean,
  now: number,
  headingX = 1,
  headingY = 0,
  steer = 0,
  wheelPhase = 0,
  moving = false,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * 1.8, scale * 1.8);
  // The painter's forward axis is screen-right.  Leftward travel mirrors the
  // side silhouette, then folds its slope upright instead of paper-rotating
  // the cab and driver through 180 degrees.
  const pose = farmUprightPose({ x: headingX, y: headingY });
  ctx.rotate(pose.slope);
  if (pose.mirrored) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(40, 30, 20, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  drawTractorWheel(ctx, -20, -8, 12, 5, wheelPhase);
  ctx.save(); ctx.translate(22, -7); ctx.rotate(steer * .48); drawTractorWheel(ctx, 0, 0, 8, 3, wheelPhase * 1.35); ctx.restore();
  ctx.fillStyle = status === 'operational' ? '#b74832' : '#7d746b';
  ctx.fillRect(-16, -27, 37, 18);
  ctx.fillStyle = status === 'operational' ? '#d06442' : '#9a9285';
  ctx.fillRect(-20, -24, 8, 11);
  ctx.fillStyle = '#8f3027';
  ctx.fillRect(-10, -41, 17, 16);
  ctx.fillStyle = '#b9d7df';
  ctx.fillRect(-7, -38, 11, 10);
  if (operating) {
    const puff = Math.sin(now / 180) * 2;
    ctx.fillStyle = working ? 'rgba(214,191,154,.42)' : 'rgba(224,224,212,.34)';
    ctx.beginPath(); ctx.arc(18 + puff, -46 - Math.abs(puff), working ? 5 : moving ? 4.5 : 3.5, 0, Math.PI * 2); ctx.fill();
    if (working || moving) { ctx.fillStyle = `rgba(157,115,67,${working ? .22 : .14})`; ctx.beginPath(); ctx.ellipse(-28 - puff, 0, moving ? 13 : 15, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#f2c59f';
    ctx.beginPath();
    ctx.arc(-1.5, -34, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#33312f';
  ctx.fillRect(15, -36, 3, 10);
  ctx.fillStyle = '#ead9a8';
  ctx.fillRect(18, -24, 5, 4);
  if (operating) {
    ctx.strokeStyle = tractorToolbarPoseFromRenderState({ operating, moving, working }) === 'lowered' ? '#d9b44a' : '#8e6a3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, -9);
    ctx.lineTo(working ? 39 : 33, working ? 10 : -21);
    ctx.lineTo(working ? 55 : 47, working ? 10 : -21);
    ctx.stroke();
    ctx.strokeStyle = working ? '#f2c018' : '#fff1c9';
    ctx.lineWidth = 2;
    ctx.globalAlpha = working ? 0.72 + Math.sin(now / 120) * 0.2 : 0.72;
    ctx.beginPath();
    ctx.ellipse(0, -12, 38, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTractorWheel(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, hubRadius: number, phase: number): void {
  ctx.fillStyle = '#2c2c2a'; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, radius - 2, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#b8a98e'; ctx.lineWidth = 1.35;
  for (let spoke = 0; spoke < 4; spoke++) {
    const angle = phase + spoke * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * (radius - 3), y + Math.sin(angle) * (radius - 3)); ctx.stroke();
  }
  ctx.fillStyle = '#d6c6a8'; ctx.beginPath(); ctx.arc(x, y, hubRadius, 0, Math.PI * 2); ctx.fill();
}
