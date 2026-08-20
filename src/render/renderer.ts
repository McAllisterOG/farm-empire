/**
 * 场景渲染器：地形 → 地块 → 按深度排序的实体 → 徽章 → 日夜色调。
 * 支持渲染玩家自己的岛、NPC 邻居岛、好友快照岛（三者都归一成 RenderScene）。
 */
import type {
  AnimalInstance, AvatarConfig, BeastInstance, FarmFieldCondition, FarmPlot, GameState, Placement, Terrain,
} from '../core/types';
import { buildTerrain } from '../core/island';
import { buildingDef } from '../core/registry';
import { cropView } from '../core/crops';
import { farmCropStage } from '../core/farmBusiness';
import type { ParcelWorkKind } from '../core/farmBusiness';
import { animalPhase } from '../core/animals';
import { WATER_COOLDOWN_MS } from '../core/balance';
import { FARM_TOWN_GATE } from '../core/townGateway';
import { Camera } from './camera';
import { diamondPath, isoX, isoY, TILE_H, TILE_W } from './iso';
import { charKey, drawSprite } from './sprites';
import { farmDriveLane, farmMainlandBounds, farmPlotFootprint, farmUprightPose, farmWorldPoint, farmLandmarks, type FarmhousePresentationTier } from './farmLayout';
import { farmGroundVariant } from './farmTerrain';
import { FARM_WALK_FRAME_COUNT, type FarmFacing } from './farmSprites';
import { FARM_DECOR_MANIFEST, FARM_FENCE_MANIFEST, FARM_FIREFLY_ANCHORS, farmWindbreakAnchors, type FarmDecor, type FarmFenceCue } from './farmDecor';
import { farmNightAlpha as farmClockNightAlpha, nightAlphaAtHour as clockNightAlpha } from './lighting';
import { renderTown, type TownRenderScene } from './townRenderer';
import { roadsideCustomerActors } from './countyLife';
import { drawCountyLifeActor } from './townSprites';
import { TOWN_CAMERA } from './townLayout';
import { MANUAL_FIELD_ACTION_LABELS, type ManualFieldActionKind } from '../core/farmManualAction';
import { clampCameraCenter, clampCameraZoom, cameraFitCenter, cameraFitZoom, farmCameraPolicy, townCameraPolicy } from './cameraPolicy';
import { drawOldPickup } from './pickupPainter';
import type { FarmWeatherKind } from '../core/farmWeather';
import { drawWeatherCast, drawWeatherPrecipitation } from './farmWeatherEffects';
import { frisbeeThrowProgress } from '../core/farmCompanion';
import { farmCropSpriteVariant, farmCropVisualFor, isFarmCropRipeStage, type FarmCropVisual } from './farmCropVisuals';
import { boundedRenderScale } from './renderResolution';

export interface SceneActor {
  avatar: AvatarConfig;
  x: number;   // 格坐标（浮点）
  y: number;
  walking: boolean;
  name?: string;
  facing?: FarmFacing;
  variant?: 'owner' | 'farmhand';
  carryingBasket?: boolean;
  basketFill?: number;
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
    fieldConditions: Record<string, FarmFieldCondition>;
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
      workKind?: ParcelWorkKind;
      harvestWagon?: { tier: 'basic' | 'county'; used: number; attached: boolean };
    };
    pickup: { name: string; x: number; y: number; operating: boolean; moving: boolean; trailerOwned: boolean; headingX?: number; headingY?: number; steer?: number; wheelPhase?: number };
    scout: { x: number; y: number; moving: boolean; mode: 'follow' | 'home'; facing: FarmFacing; scratching: boolean };
    frisbee?: { throwFrom: { x: number; y: number }; carrier: { x: number; y: number }; to: { x: number; y: number }; phase: 'outbound' | 'pickup' | 'returning'; phaseStartedAt: number };
    farmhouseTier: FarmhousePresentationTier;
    barnLoftOwned: boolean;
    grainSiloOwned: boolean;
    roadsideStand: { owned: boolean; completedToday: boolean };
    clockDay: number;
    clockMinute: number;
    weather: FarmWeatherKind;
    interactionHint?: { kind: string; label: string; x: number; y: number };
    destination?: { kind: 'walk' | 'pickup' | 'tractor'; x: number; y: number };
    manualAction?: { kind: ManualFieldActionKind; x: number; y: number; progress: number };
    manualSelection?: { x: number; y: number }[];
    starterGuideTarget?: { uid: number; x: number; y: number };
    farmhandAction?: { kind: ManualFieldActionKind; x: number; y: number; progress: number };
    farmhandSelection?: { x: number; y: number }[];
    harvestFeedback?: { x: number; y: number; cropId: string; startedAt: number };
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
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = boundedRenderScale(w, h, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
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
    const policy = farmCameraPolicy();
    const center = cameraFitCenter(policy);
    this.camera.cx = center.cx;
    this.camera.cy = center.cy;
    this.camera.zoom = cameraFitZoom(policy, this.camera.viewW, this.camera.viewH); this.clampFarmCamera();
  }

  centerOnTown(): void {
    this.camera.centerOnTile(TOWN_CAMERA.x, TOWN_CAMERA.y);
    this.camera.zoom = cameraFitZoom(townCameraPolicy(), this.camera.viewW, this.camera.viewH); this.clampTownCamera();
  }

  clampFarmCamera(): void { const policy = farmCameraPolicy(); this.camera.zoom = clampCameraZoom(this.camera.zoom, policy); const p = clampCameraCenter(this.camera.cx, this.camera.cy, this.camera.zoom, this.camera.viewW, this.camera.viewH, policy); this.camera.cx = p.cx; this.camera.cy = p.cy; }
  clampTownCamera(): void { const policy = townCameraPolicy(); this.camera.zoom = clampCameraZoom(this.camera.zoom, policy); const p = clampCameraCenter(this.camera.cx, this.camera.cy, this.camera.zoom, this.camera.viewW, this.camera.viewH, policy); this.camera.cx = p.cx; this.camera.cy = p.cy; }

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
    drawWeatherCast(ctx, camera, scene.farm!.weather, now);
    drawFarmyard(ctx, camera, zoom, now);
    for (const plot of scene.plots) drawFarmSection(
      ctx, camera, plot, now, zoom, false,
      scene.farm!.fieldConditions[String(plot.uid)] ?? { soil: plot.crop ? 'tilled' : 'rough' },
    );
    for (const plot of scene.farm!.lockedTiles) drawFarmSection(ctx, camera, { ...plot, uid: -1, crop: null }, now, zoom, true, { soil: 'rough' });
    drawLockedParcelLabel(ctx, camera, scene, zoom);

    for (const plot of scene.farm!.manualSelection ?? []) {
      farmFootprintPath(ctx, camera, farmPlotFootprint(plot));
      ctx.fillStyle = 'rgba(245, 223, 132, .13)'; ctx.fill();
      ctx.save();
      ctx.setLineDash([Math.max(4, 7 * zoom), Math.max(3, 5 * zoom)]);
      ctx.strokeStyle = 'rgba(245, 223, 132, .88)';
      ctx.lineWidth = Math.max(1.5, zoom * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const plot of scene.farm!.farmhandSelection ?? []) {
      farmFootprintPath(ctx, camera, farmPlotFootprint(plot));
      ctx.fillStyle = 'rgba(94, 145, 79, .12)'; ctx.fill();
      ctx.save(); ctx.setLineDash([Math.max(4, 7 * zoom), Math.max(3, 5 * zoom)]);
      ctx.strokeStyle = 'rgba(126, 184, 104, .9)'; ctx.lineWidth = Math.max(1.5, zoom * 2); ctx.stroke(); ctx.restore();
    }

    const guideTarget = scene.farm!.starterGuideTarget;
    if (guideTarget) {
      const pulse = .42 + (Math.sin(now / 240) + 1) * .18;
      farmFootprintPath(ctx, camera, farmPlotFootprint(guideTarget));
      ctx.fillStyle = `rgba(229, 166, 59, ${pulse * .16})`; ctx.fill();
      ctx.strokeStyle = `rgba(181, 111, 42, ${pulse})`; ctx.lineWidth = Math.max(2, zoom * 2.6); ctx.stroke();
    }
    if (scene.hover) {
      farmFootprintPath(ctx, camera, farmPlotFootprint({ x: scene.hover.tx, y: scene.hover.ty }));
      ctx.fillStyle = 'rgba(255, 239, 132, .18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255, 239, 132, .92)'; ctx.lineWidth = Math.max(1.5, zoom * 2); ctx.stroke();
    }
    if (scene.farm!.destination) drawFarmDestination(ctx, camera, zoom, now, scene.farm!.destination);

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
    if (scene.farm!.roadsideStand.owned) {
      const standPoint = farmWorldPoint(farmLandmarks().roadsideStand);
      items.push({ depth: standPoint.x + standPoint.y + .19, draw: () => drawFarmRoadsideStand(ctx, camera.sx(isoX(standPoint.x, standPoint.y)), camera.sy(isoY(standPoint.x, standPoint.y) + TILE_H / 2), zoom, scene.farm!.roadsideStand.completedToday, now) });
    }
    for (const customer of roadsideCustomerActors(
      scene.seed,
      scene.farm!.clockDay,
      scene.farm!.clockMinute,
      now,
      scene.farm!.roadsideStand.owned && !scene.farm!.roadsideStand.completedToday,
    )) {
      const point = farmWorldPoint(customer);
      items.push({ depth: point.x + point.y + .37, draw: () => drawCountyLifeActor(
        ctx,
        camera.sx(isoX(point.x, point.y)),
        camera.sy(isoY(point.x, point.y) + TILE_H / 2),
        zoom * 1.08,
        customer,
        now,
      ) });
    }
    const farmhousePoint = farmWorldPoint(farmLandmarks().farmhouse);
    items.push({ depth: farmhousePoint.x + farmhousePoint.y + .19, draw: () => drawFarmhouse(ctx, camera.sx(isoX(farmhousePoint.x, farmhousePoint.y)), camera.sy(isoY(farmhousePoint.x, farmhousePoint.y) + TILE_H / 2), zoom, now, scene.farm!.farmhouseTier) });
    for (const plot of scene.plots) if (plot.crop) {
      const point = farmWorldPoint(plot);
      const stage = farmCropStage(plot.crop, now);
      items.push({ depth: point.x + point.y, draw: () => drawFarmCropRows(ctx, camera, plot, stage, zoom, now, bob) });
    }
    for (const pl of scene.placements) {
      const def = buildingDef(pl.defId);
      // Farm Empire lays its own continuous gravel lane; legacy stone paths are
      // retained in save data but are not rendered as tiny leftover tiles.
      if (def.category === 'path') continue;
      const point = farmWorldPoint({ x: pl.x + (def.w - 1) / 2, y: pl.y + (def.h - 1) / 2 });
      items.push({ depth: point.x + point.y + 0.2, draw: () => pl.defId === 'bld_storage'
        ? drawFarmBarn(ctx, camera.sx(isoX(point.x, point.y)), camera.sy(isoY(point.x, point.y) + TILE_H / 2), zoom, scene.farm!.barnLoftOwned, scene.farm!.grainSiloOwned)
        : drawSprite(ctx, `bld:${pl.defId}`, camera.sx(isoX(point.x, point.y)), camera.sy(isoY(point.x, point.y) + TILE_H / 2), zoom * 1.16) });
    }
    const doghousePoint = farmWorldPoint(farmLandmarks().doghouse);
    items.push({ depth: doghousePoint.x + doghousePoint.y + 0.15, draw: () => drawFarmDoghouse(ctx, camera.sx(isoX(doghousePoint.x, doghousePoint.y)), camera.sy(isoY(doghousePoint.x, doghousePoint.y) + TILE_H / 2), zoom) });
    const tractor = scene.farm!.tractor;
    const tractorPoint = farmWorldPoint(tractor);
    items.push({ depth: tractorPoint.x + tractorPoint.y + 0.3, draw: () => drawOldTractor(ctx, camera.sx(isoX(tractorPoint.x, tractorPoint.y)), camera.sy(isoY(tractorPoint.x, tractorPoint.y) + TILE_H / 2), zoom, tractor.status, !!tractor.operating, !!tractor.working, now, tractor.headingX, tractor.headingY, tractor.steer, tractor.wheelPhase, !!tractor.moving, tractor.workKind, tractor.harvestWagon) });
    const pickup = scene.farm!.pickup;
    const pickupPoint = farmWorldPoint(pickup);
    items.push({ depth: pickupPoint.x + pickupPoint.y + 0.31, draw: () => drawOldPickup(ctx, camera.sx(isoX(pickupPoint.x, pickupPoint.y)), camera.sy(isoY(pickupPoint.x, pickupPoint.y) + TILE_H / 2), zoom, pickup.operating, pickup.moving, now, pickup.headingX, pickup.headingY, pickup.steer, pickup.wheelPhase, pickup.trailerOwned) });
    const scoutPoint = farmWorldPoint(scene.farm!.scout);
    items.push({ depth: scoutPoint.x + scoutPoint.y + 0.35, draw: () => drawScout(ctx, camera.sx(isoX(scoutPoint.x, scoutPoint.y)), camera.sy(isoY(scoutPoint.x, scoutPoint.y) + TILE_H / 2), zoom, now, scene.farm!.scout.moving, scene.farm!.scout.mode === 'home' && !scene.farm!.scout.moving, scene.farm!.scout.facing) });
    if (scene.farm!.frisbee) {
      const frisbee = scene.farm!.frisbee;
      const target = farmWorldPoint(frisbee.to);
      items.push({ depth: target.x + target.y + .34, draw: () => drawScoutFrisbee(ctx, camera, zoom, now, farmWorldPoint(frisbee.throwFrom), farmWorldPoint(frisbee.carrier), target, frisbee.phase, frisbee.phaseStartedAt) });
    }
    for (const actor of scene.actors) {
      const point = farmWorldPoint(actor);
      items.push({ depth: point.x + point.y + 0.4, draw: () => {
        const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y) + TILE_H / 2);
        if (actor.carryingBasket && actor.facing === 'north') drawFarmHarvestBasket(ctx, sx, sy, zoom, actor.facing, actor.basketFill ?? 0);
        drawFarmFarmer(ctx, sx, sy, zoom, actor.avatar, actor.facing ?? 'south', actor.walking ? Math.floor(now / 100) % FARM_WALK_FRAME_COUNT : 0, now, actor.variant ?? 'owner');
        if (actor.carryingBasket && actor.facing !== 'north') drawFarmHarvestBasket(ctx, sx, sy, zoom, actor.facing ?? 'south', actor.basketFill ?? 0);
        if (actor.name) drawFarmName(ctx, sx, sy, actor.name, zoom);
      } });
    }
    if (scene.farm!.manualAction) {
      const action = scene.farm!.manualAction;
      const point = farmWorldPoint(action);
      items.push({
        depth: point.x + point.y + .42,
        draw: () => drawManualFieldAction(
          ctx,
          camera.sx(isoX(point.x, point.y)),
          camera.sy(isoY(point.x, point.y) + TILE_H / 2),
          zoom,
          now,
          action.kind,
          action.progress,
        ),
      });
    }
    if (scene.farm!.farmhandAction) {
      const action = scene.farm!.farmhandAction;
      const point = farmWorldPoint(action);
      items.push({
        depth: point.x + point.y + .43,
        draw: () => drawManualFieldAction(
          ctx,
          camera.sx(isoX(point.x, point.y)),
          camera.sy(isoY(point.x, point.y) + TILE_H / 2),
          zoom,
          now,
          action.kind,
          action.progress,
        ),
      });
    }
    items.sort((a, b) => a.depth - b.depth); items.forEach((item) => item.draw());
    if (scene.farm!.harvestFeedback) drawFarmHarvestCompletion(ctx, camera, zoom, now, scene.farm!.harvestFeedback);
    const na = farmNightAlpha(scene.farm!.clockMinute);
    if (na > .01) {
      ctx.fillStyle = `rgba(24, 34, 76, ${na})`; ctx.fillRect(0, 0, camera.viewW, camera.viewH);
      drawFarmNightGlow(ctx, camera, zoom, na, now, doghousePoint, scene.placements);
    }
    drawWeatherPrecipitation(ctx, camera, scene.farm!.weather, now);
    if (scene.farm!.scout.scratching) drawScoutHeart(ctx, camera.sx(isoX(scoutPoint.x, scoutPoint.y)), camera.sy(isoY(scoutPoint.x, scoutPoint.y)) - 42 * zoom, zoom, now);
    if (scene.farm!.interactionHint) drawFarmInteractionHint(ctx, camera, zoom, scene.farm!.interactionHint);
  }

  focusOnFarmPoint(point: { x: number; y: number }): void {
    const world = farmWorldPoint(point);
    this.camera.centerOnTile(world.x, world.y);
    this.clampFarmCamera();
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

function drawFarmSection(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  plot: FarmPlot,
  now: number,
  zoom: number,
  locked: boolean,
  condition: FarmFieldCondition,
): void {
  const footprint = farmPlotFootprint(plot);
  // A low offset silhouette gives every large section a grounded, raised edge.
  ctx.save(); ctx.translate(0, 3.2 * zoom); farmFootprintPath(ctx, camera, footprint);
  ctx.fillStyle = locked ? 'rgba(75, 51, 34, .36)' : 'rgba(64, 43, 28, .3)'; ctx.fill(); ctx.restore();
  farmFootprintPath(ctx, camera, footprint);
  const wet = !!plot.crop && now - plot.crop.lastWateredAt < WATER_COOLDOWN_MS;
  ctx.fillStyle = locked
    ? 'rgba(119, 88, 57, .46)'
    : wet ? '#67452f'
      : condition.soil === 'rough' ? '#8c6947'
        : condition.soil === 'stubble' ? '#99774b'
          : '#95643f';
  ctx.fill();
  ctx.strokeStyle = locked ? '#6d452c' : '#593a27'; ctx.lineWidth = Math.max(1.2, zoom * 1.7); ctx.stroke();
  if (locked) return;
  const detailSeed = (plot.uid * 37 + plot.x * 19 + plot.y * 53) >>> 0;
  // Restrained deterministic soil texture; it is anchored in logical space so
  // camera movement never makes it shimmer or seam.
  ctx.fillStyle = condition.soil === 'rough' ? 'rgba(73, 48, 30, .36)' : 'rgba(65, 39, 23, .22)';
  for (let index = 0; index < 12; index++) {
    const px = footprint.minX + (.12 + ((detailSeed + index * 29) % 76) / 100) * (footprint.maxX - footprint.minX);
    const py = footprint.minY + (.12 + ((detailSeed * 3 + index * 17) % 76) / 100) * (footprint.maxY - footprint.minY);
    const x = camera.sx(isoX(px, py)); const y = camera.sy(isoY(px, py));
    ctx.beginPath(); ctx.ellipse(x, y, (1.2 + index % 3) * zoom, (0.65 + index % 2) * zoom, index * .43, 0, Math.PI * 2); ctx.fill();
  }
  if (condition.soil === 'rough' && !plot.crop) {
    ctx.fillStyle = 'rgba(91,62,38,.38)';
    for (let index = 0; index < 9; index++) {
      const px = footprint.minX + (index % 3 + .55) * (footprint.maxX - footprint.minX) / 3;
      const py = footprint.minY + (Math.floor(index / 3) + .5 + (index % 2) * .08) * (footprint.maxY - footprint.minY) / 3;
      const x = camera.sx(isoX(px, py)); const y = camera.sy(isoY(px, py));
      ctx.beginPath(); ctx.ellipse(x, y, 3.5 * zoom, 1.6 * zoom, 0, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  // Furrows use the actual large footprint, rather than duplicating old tile artwork.
  ctx.strokeStyle = wet ? 'rgba(56, 35, 21, .46)' : 'rgba(78, 46, 27, .42)'; ctx.lineWidth = Math.max(1, zoom * 1.25);
  for (let index = 1; index < 6; index++) {
    const t = index / 5; const x = footprint.minX + (footprint.maxX - footprint.minX) * t;
    const a = { x: camera.sx(isoX(x, footprint.minY)), y: camera.sy(isoY(x, footprint.minY)) };
    const b = { x: camera.sx(isoX(x, footprint.maxY)), y: camera.sy(isoY(x, footprint.maxY)) };
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  if (condition.soil === 'stubble' && !plot.crop) {
    ctx.strokeStyle = 'rgba(222,181,93,.72)'; ctx.lineWidth = Math.max(1.2, zoom * 1.8); ctx.lineCap = 'round';
    for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
      const px = footprint.minX + (col + .5) * (footprint.maxX - footprint.minX) / 5;
      const py = footprint.minY + (row + .5) * (footprint.maxY - footprint.minY) / 4;
      const x = camera.sx(isoX(px, py)); const y = camera.sy(isoY(px, py));
      ctx.beginPath(); ctx.moveTo(x, y + 1.5 * zoom); ctx.lineTo(x + ((row + col) % 2 ? 1.5 : -1.5) * zoom, y - 4 * zoom); ctx.stroke();
    }
  }
}

function drawManualFieldAction(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  now: number,
  kind: ManualFieldActionKind,
  progress: number,
): void {
  const p = Math.max(0, Math.min(1, progress));
  const phase = Math.sin(p * Math.PI * 3.5);
  ctx.save();
  ctx.translate(x, y - 8 * zoom);
  ctx.scale(zoom, zoom);

  ctx.fillStyle = 'rgba(41, 34, 24, .82)';
  ctx.beginPath(); ctx.roundRect(-61, -77, 122, 24, 7); ctx.fill();
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff8dc';
  ctx.fillText(MANUAL_FIELD_ACTION_LABELS[kind], 0, -65);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-51, -49, 102, 5);
  ctx.fillStyle = '#f0cf68'; ctx.fillRect(-51, -49, 102 * p, 5);

  if (kind === 'prepare' || kind === 'rework' || kind === 'clear') {
    ctx.save(); ctx.rotate(-.7 + phase * .24);
    ctx.strokeStyle = '#7a5436'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18, -31); ctx.lineTo(19, 20); ctx.stroke();
    ctx.strokeStyle = '#b8afa0'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(12, 22); ctx.lineTo(29, 12); ctx.stroke(); ctx.restore();
    ctx.fillStyle = kind === 'clear' ? '#d6ad57' : '#725038';
    for (let i = 0; i < 5; i++) {
      const spread = (p * 59 + i * 17) % 43;
      ctx.beginPath(); ctx.ellipse(-22 + spread, 25 - ((i * 7 + p * 23) % 18), 2.6, 1.5, i, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'plant') {
    ctx.fillStyle = '#c68f3e';
    for (let i = 0; i < 7; i++) {
      const t = Math.max(0, Math.min(1, p * 1.45 - i * .065));
      const sx = -28 + i * 9; const sy = 7 + Math.sin(t * Math.PI) * -22 + t * 17;
      ctx.beginPath(); ctx.ellipse(sx, sy, 2.8, 4.2, .55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(95,66,39,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-35, 27); ctx.lineTo(35, 27); ctx.stroke();
  } else if (kind === 'water') {
    ctx.save(); ctx.translate(-12, 5); ctx.rotate(-.2 + phase * .05);
    ctx.fillStyle = '#6d96a0'; ctx.strokeStyle = '#31545d'; ctx.lineWidth = 2;
    ctx.fillRect(-14, -13, 26, 23); ctx.strokeRect(-14, -13, 26, 23);
    ctx.beginPath(); ctx.arc(-1, -13, 9, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(31, -18); ctx.lineTo(34, -14); ctx.lineTo(14, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#72bdd5';
    for (let i = 0; i < 6; i++) {
      const drop = (p * 2.4 + i * .17) % 1;
      ctx.beginPath(); ctx.ellipse(19 + i * 5, -6 + drop * 36, 1.8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#d6d0bd'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(4, 4, 27, -.25, 2.1); ctx.stroke();
    ctx.strokeStyle = '#805231'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(20, 19); ctx.lineTo(35, 34); ctx.stroke();
    ctx.strokeStyle = '#d6ad57'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const sx = -32 + i * 12; const sway = Math.sin(now / 90 + i) * 2;
      ctx.beginPath(); ctx.moveTo(sx, 30); ctx.lineTo(sx + sway, 10); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawFarmCropRows(ctx: CanvasRenderingContext2D, camera: Camera, plot: FarmPlot, stage: string, zoom: number, now: number, bob: number): void {
  const footprint = farmPlotFootprint(plot);
  const visual = farmCropVisualFor(plot.crop!.defId);
  // Crop-specific spacing favors fewer, readable silhouettes over indistinct micro-detail.
  for (let row = 0; row < visual.rows; row++) for (let col = 0; col < visual.columns; col++) {
    const x = footprint.minX + (col + .5 + (row % 2 ? .08 : 0)) * (footprint.maxX - footprint.minX) / visual.columns;
    const y = footprint.minY + (row + .5) * (footprint.maxY - footprint.minY) / visual.rows;
    const sx = camera.sx(isoX(x, y)); const sy = camera.sy(isoY(x, y) + TILE_H / 2);
    // Separate row phases read as a breeze across the section, not a global bob.
    const cropStage = stage === 'needs-water' ? 'seedling' : stage;
    const sway = Math.sin(now / 720 + row * 1.17 + col * .34 + plot.x * .7 + plot.y) * (cropStage === 'seedling' ? .45 : 1.15) * zoom;
    drawFarmCropPlant(ctx, sx + sway, sy, zoom * .78, visual, cropStage, row * visual.columns + col);
  }
  const centre = farmWorldPoint(plot); const sx = camera.sx(isoX(centre.x, centre.y)); const sy = camera.sy(isoY(centre.x, centre.y) + TILE_H / 2);
  if (stage === 'ready') drawSprite(ctx, 'fx:ready', sx, sy - 67 * zoom + bob * zoom, zoom * 1.15);
  else if (stage === 'withered') drawSprite(ctx, 'fx:hungry', sx, sy - 56 * zoom + bob * zoom, zoom * 1.15);
  else if (stage === 'needs-water') {
    ctx.save(); ctx.translate(sx, sy - 56 * zoom + bob * zoom); ctx.scale(zoom, zoom);
    ctx.fillStyle = '#75b9d0'; ctx.strokeStyle = '#315c68'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.bezierCurveTo(-7, -2, -8, 3, 0, 7); ctx.bezierCurveTo(8, 3, 7, -2, 0, -10); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

const FARM_CROP_SPRITE_SIZE = 112;
const FARM_CROP_SPRITE_ANCHOR_X = 56;
const FARM_CROP_SPRITE_ANCHOR_Y = 94;
const farmCropPlantSpriteCache = new WeakMap<FarmCropVisual, Map<string, HTMLCanvasElement>>();

function farmCropPlantSprite(visual: FarmCropVisual, stage: string, index: number): HTMLCanvasElement {
  let cache = farmCropPlantSpriteCache.get(visual);
  if (!cache) { cache = new Map(); farmCropPlantSpriteCache.set(visual, cache); }
  const variant = farmCropSpriteVariant(index);
  const key = `${stage}:${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = FARM_CROP_SPRITE_SIZE;
  canvas.height = FARM_CROP_SPRITE_SIZE;
  const spriteCtx = canvas.getContext('2d');
  if (spriteCtx) drawFarmCropPlantVector(spriteCtx, FARM_CROP_SPRITE_ANCHOR_X, FARM_CROP_SPRITE_ANCHOR_Y, 1, visual, stage, variant);
  cache.set(key, canvas);
  return canvas;
}

function drawFarmCropPlant(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, visual: FarmCropVisual, stage: string, index: number): void {
  const sprite = farmCropPlantSprite(visual, stage, index);
  ctx.drawImage(
    sprite,
    x - FARM_CROP_SPRITE_ANCHOR_X * zoom,
    y - FARM_CROP_SPRITE_ANCHOR_Y * zoom,
    FARM_CROP_SPRITE_SIZE * zoom,
    FARM_CROP_SPRITE_SIZE * zoom,
  );
}

function drawFarmCropPlantVector(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, visual: FarmCropVisual, stage: string, index: number): void {
  const withered = stage === 'withered';
  const growth = stage === 'seedling' ? .34 : stage === 'growing' ? .7 : visual.matureScale * (withered ? .78 : 1);
  const ripe = isFarmCropRipeStage(stage);
  const h = visual.baseHeight * growth; const spread = 8.5 * growth;
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom, zoom); ctx.lineCap = 'round';
  if (withered) { ctx.filter = 'saturate(22%) brightness(68%)'; ctx.globalAlpha = .78; ctx.rotate((index % 3 - 1) * .12); }
  ctx.fillStyle = 'rgba(52,43,27,.16)'; ctx.beginPath(); ctx.ellipse(0, 1.5, Math.max(4, spread * .82), 2.4, 0, 0, Math.PI * 2); ctx.fill();
  const strokeStem = (fromX: number, fromY: number, toX: number, toY: number, width = 2.5): void => {
    ctx.strokeStyle = 'rgba(43,68,35,.75)'; ctx.lineWidth = width + 1.5; ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
    ctx.strokeStyle = visual.stem; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
  };
  const leaf = (cx: number, cy: number, rx: number, ry: number, rotation: number, color = visual.leaf): void => {
    ctx.fillStyle = color; ctx.strokeStyle = 'rgba(48,76,37,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1.2, rx), Math.max(1, ry), rotation, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  };
  if (visual.silhouette === 'corn') {
    strokeStem(0, 0, 0, -h, 3.2);
    const leafCount = stage === 'seedling' ? 2 : 4;
    for (let i = 0; i < leafCount; i++) {
      const side = i % 2 ? 1 : -1; const yy = -h * (.25 + i * .13);
      ctx.fillStyle = i % 2 ? visual.leaf : '#82ad4c'; ctx.strokeStyle = '#496b33'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, yy + 3); ctx.quadraticCurveTo(side * 7, yy - 2, side * (11 + i), yy - 8); ctx.quadraticCurveTo(side * 6, yy + 4, 0, yy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (stage !== 'seedling') {
      ctx.strokeStyle = ripe ? '#d6a83a' : '#6c8f3f'; ctx.lineWidth = 1.4;
      for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(dx, -h - 7 + Math.abs(dx) * .25); ctx.stroke(); }
    }
    if (ripe) {
      const earSide = index % 2 ? 1 : -1;
      ctx.fillStyle = visual.produce; ctx.strokeStyle = '#9c7625'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(earSide * 3.8, -h * .58, 3.8, 8.2, earSide * .18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6f953e'; ctx.beginPath(); ctx.moveTo(0, -h * .43); ctx.lineTo(earSide * 7, -h * .62); ctx.lineTo(earSide * 2, -h * .7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,238,126,.8)'; ctx.fillRect(earSide * 2.5 - 1, -h * .62, 1.4, 7);
    }
  } else if (visual.silhouette === 'wheat') {
    for (const offset of [-3.5, 0, 3.5]) {
      const height = h * (offset ? .84 : 1); strokeStem(offset, 0, offset * .5, -height, 1.5);
      if (stage !== 'seedling' && !withered) for (let grain = 0; grain < 4; grain++) leaf(offset * .5 + (grain % 2 ? 2 : -2), -height + 3 + grain * 3, 2.5, 1.2, grain % 2 ? .55 : -.55, ripe ? visual.produce : visual.leaf);
    }
  } else if (visual.silhouette === 'tomato') {
    ctx.strokeStyle = '#9b7a4d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 1); ctx.lineTo(-5, -h - 3); ctx.stroke(); strokeStem(0, 0, 0, -h * .9, 2.2);
    for (const side of [-1, 1]) { strokeStem(0, -h * .45, side * 7, -h * .61, 1.4); leaf(side * 7, -h * .61, 5, 2.6, side * .35); }
    if (ripe) for (const dx of [-5, 1, 5]) { ctx.fillStyle = visual.produce; ctx.strokeStyle = '#92352d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(dx, -h * (.28 + (Math.abs(dx) % 2) * .08), 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else if (visual.silhouette === 'carrot') {
    for (const dx of [-1.3, -.5, .5, 1.3]) { ctx.strokeStyle = visual.leaf; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(dx * 5, -h * .48, dx * 4, -h * (.72 + Math.abs(dx) * .08)); ctx.stroke(); }
    if (ripe) { ctx.fillStyle = visual.produce; ctx.strokeStyle = '#a94d27'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3.8, -1); ctx.quadraticCurveTo(0, -4, 3.8, -1); ctx.lineTo(0, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  } else if (visual.silhouette === 'cabbage') {
    for (let i = 0; i < 7; i++) leaf(Math.sin(i * .9) * spread * .48, -4 - Math.cos(i * .9) * 3, spread * .78, spread * .42, i * .55);
    if (ripe) { ctx.fillStyle = visual.produce; ctx.strokeStyle = '#587d45'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -6, spread * .72, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,220,.45)'; ctx.beginPath(); ctx.arc(-2, -8, spread * .35, Math.PI, Math.PI * 1.75); ctx.stroke(); }
  } else if (visual.silhouette === 'pumpkin') {
    ctx.strokeStyle = visual.stem; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-spread * 1.25, 0); ctx.quadraticCurveTo(0, -h * .42, spread * 1.25, 0); ctx.stroke();
    for (const dx of [-spread, spread]) leaf(dx, -h * .2, 6, 3.6, dx * .09);
    if (ripe) { ctx.fillStyle = visual.produce; ctx.strokeStyle = '#a95628'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 6.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); for (const dx of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(dx, -5); ctx.quadraticCurveTo(dx * .65, 0, dx, 5); ctx.stroke(); } }
  } else {
    const low = visual.silhouette === 'potato'; const bushH = low ? h * .54 : h * .82; strokeStem(0, 0, 0, -bushH, 2);
    for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1; const level = Math.floor(i / 2); leaf(side * (4 + level * 1.2), -bushH * (.25 + level * .18), spread * .6, bushH * .12, side * .42); }
    if (visual.silhouette === 'soybean' && ripe) for (const side of [-1, 1]) { ctx.fillStyle = visual.produce; ctx.strokeStyle = '#76813f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(side * 3.5, -bushH * .38, 2.2, 5, side * .22, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    if (visual.silhouette === 'potato' && ripe) for (const dx of [-3, 3]) { ctx.fillStyle = '#f4e6d5'; ctx.strokeStyle = '#8d6b8e'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(dx, -bushH * .7, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  if (stage === 'ready' && index % 3 === 0) { ctx.strokeStyle = 'rgba(255, 241, 159, .62)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3, -h - 4); ctx.lineTo(3, -h - 4); ctx.stroke(); }
  ctx.restore();
}

function drawFarmHarvestCompletion(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, now: number, feedback: NonNullable<NonNullable<RenderScene['farm']>['harvestFeedback']>): void {
  const elapsed = now - feedback.startedAt; if (elapsed < 0 || elapsed > 760) return;
  const progress = elapsed / 760; const point = farmWorldPoint(feedback); const x = camera.sx(isoX(point.x, point.y)); const y = camera.sy(isoY(point.x, point.y) + TILE_H / 2);
  const color = farmCropVisualFor(feedback.cropId).produce;
  ctx.save(); ctx.globalAlpha = 1 - progress; ctx.fillStyle = color;
  for (let index = 0; index < 8; index++) { const angle = index * Math.PI / 4 + .18; const distance = (10 + progress * 31) * zoom; ctx.beginPath(); ctx.ellipse(x + Math.cos(angle) * distance, y - 24 * zoom + Math.sin(angle) * distance * .55 - progress * 16 * zoom, 2.6 * zoom, 1.8 * zoom, angle, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawFarmyard(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, now: number): void {
  // A restrained gravel lane connects the barn, field entrances, and town road.
  const lane = farmDriveLane();
  ctx.lineCap = 'round'; ctx.strokeStyle = '#806344'; ctx.lineWidth = 25 * zoom; ctx.beginPath();
  lane.forEach((point, index) => { const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y)); index ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke();
  ctx.beginPath(); lane.forEach((point, index) => { const sx = camera.sx(isoX(point.x, point.y)); const sy = camera.sy(isoY(point.x, point.y)); index ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  ctx.strokeStyle = '#c4ad7d'; ctx.lineWidth = 16 * zoom; ctx.stroke();
  const pad = farmWorldPoint(farmLandmarks().cargoPad);
  const px = camera.sx(isoX(pad.x, pad.y)); const py = camera.sy(isoY(pad.x, pad.y));
  ctx.fillStyle = 'rgba(164,137,91,.78)'; ctx.beginPath(); ctx.ellipse(px, py, 58 * zoom, 21 * zoom, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(91,68,42,.45)'; ctx.lineWidth = 2 * zoom; ctx.stroke();
  ctx.save(); ctx.font = `800 ${Math.max(8, 10 * zoom)}px Segoe UI, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(83,61,37,.72)'; ctx.fillText('CARGO PAD', px, py + 2 * zoom); ctx.restore();
  drawHomesteadLandscape(ctx, camera, zoom, now);
}

function drawHomesteadLandscape(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, now: number): void {
  const pond = farmWorldPoint({ x: 1.05, y: 5.15 });
  const pondX = camera.sx(isoX(pond.x, pond.y)); const pondY = camera.sy(isoY(pond.x, pond.y));
  ctx.fillStyle = '#557f64'; ctx.beginPath(); ctx.ellipse(pondX, pondY, 54 * zoom, 22 * zoom, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5d9ba0'; ctx.beginPath(); ctx.ellipse(pondX, pondY, 44 * zoom, 17 * zoom, -.08, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(218,239,220,.42)'; ctx.lineWidth = Math.max(1, zoom * 1.5);
  for (let line = -1; line <= 1; line++) { ctx.beginPath(); ctx.ellipse(pondX + line * 11 * zoom, pondY + Math.sin(now / 900 + line) * zoom, 13 * zoom, 3 * zoom, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = '#476a35'; ctx.lineWidth = Math.max(1.5, 2 * zoom); ctx.lineCap = 'round';
  for (const offset of [-42, -33, 31, 42]) { const sway = Math.sin(now / 1100 + offset) * 2 * zoom; ctx.beginPath(); ctx.moveTo(pondX + offset * zoom, pondY + 6 * zoom); ctx.lineTo(pondX + (offset + 2) * zoom + sway, pondY - 12 * zoom); ctx.stroke(); }

  const garden = farmWorldPoint({ x: 3.75, y: 3.65 });
  for (let row = 0; row < 3; row++) {
    const a = { x: camera.sx(isoX(garden.x + row * .52, garden.y)), y: camera.sy(isoY(garden.x + row * .52, garden.y)) };
    const b = { x: camera.sx(isoX(garden.x + row * .52, garden.y + 2.1)), y: camera.sy(isoY(garden.x + row * .52, garden.y + 2.1)) };
    ctx.strokeStyle = '#7e5b37'; ctx.lineWidth = 6 * zoom; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = row === 1 ? '#d9a641' : '#5e873d'; ctx.lineWidth = 2.5 * zoom; ctx.setLineDash([3 * zoom, 6 * zoom]); ctx.beginPath(); ctx.moveTo(a.x, a.y - 2 * zoom); ctx.lineTo(b.x, b.y - 2 * zoom); ctx.stroke(); ctx.setLineDash([]);
  }
  const flowers = [
    { x: 3.45, y: 3.25, color: '#f3cf58' }, { x: 3.7, y: 3.1, color: '#e98a9a' },
    { x: 6.55, y: 4.55, color: '#f4df7f' }, { x: 6.8, y: 4.7, color: '#d9a1d8' },
  ];
  for (const flower of flowers) {
    const point = farmWorldPoint(flower); const x = camera.sx(isoX(point.x, point.y)); const y = camera.sy(isoY(point.x, point.y));
    ctx.fillStyle = flower.color; ctx.beginPath(); ctx.arc(x, y - 4 * zoom, Math.max(1.3, 2.2 * zoom), 0, Math.PI * 2); ctx.fill();
  }
}

function drawFarmhouse(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number, tier: FarmhousePresentationTier): void {
  if (tier === 'expanded') {
    drawExpandedFarmhouse(ctx, x, y, zoom, now);
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.85, zoom * 1.85);
  ctx.fillStyle = 'rgba(48,35,24,.24)'; ctx.beginPath(); ctx.ellipse(0, 6, 47, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#876142'; ctx.fillRect(-38, -3, 76, 6);
  ctx.fillStyle = '#d1b789'; ctx.fillRect(-34, -43, 68, 42);
  ctx.fillStyle = '#b99a70'; for (let line = -38; line < -3; line += 7) ctx.fillRect(-34, line, 68, 1);
  ctx.fillStyle = '#694a38'; ctx.beginPath(); ctx.moveTo(-42, -42); ctx.lineTo(0, -72); ctx.lineTo(42, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8b674b'; ctx.fillRect(-43, -43, 86, 6);
  ctx.fillStyle = '#70503b'; ctx.fillRect(18, -71, 9, 23); ctx.fillStyle = '#907057'; ctx.fillRect(16, -74, 13, 5);
  const smoke = Math.sin(now / 1000) * 2;
  ctx.fillStyle = 'rgba(235,231,215,.48)'; ctx.beginPath(); ctx.arc(25 + smoke, -82, 4, 0, Math.PI * 2); ctx.arc(29 - smoke, -90, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b4334'; ctx.fillRect(-8, -28, 16, 27); ctx.fillStyle = '#c79e4d'; ctx.beginPath(); ctx.arc(4, -14, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a7c5be'; ctx.fillRect(-28, -31, 13, 13); ctx.fillRect(15, -31, 13, 13);
  ctx.strokeStyle = 'rgba(78,53,38,.55)'; ctx.lineWidth = 2; for (const wx of [-21.5, 21.5]) { ctx.beginPath(); ctx.moveTo(wx, -32); ctx.lineTo(wx, -17); ctx.moveTo(wx - 7, -24.5); ctx.lineTo(wx + 7, -24.5); ctx.stroke(); }
  ctx.fillStyle = '#eee2bf'; ctx.fillRect(-40, -5, 80, 4); for (const post of [-32, 32]) ctx.fillRect(post - 2, -20, 4, 19);
  ctx.fillStyle = '#8b674b'; ctx.fillRect(-42, -2, 84, 5); ctx.restore();
}

function drawExpandedFarmhouse(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, now: number): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.92, zoom * 1.92);
  ctx.fillStyle = 'rgba(48,35,24,.25)'; ctx.beginPath(); ctx.ellipse(0, 7, 61, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#76523a'; ctx.fillRect(-52, -3, 104, 7);
  ctx.fillStyle = '#d7c49d'; ctx.fillRect(-48, -58, 96, 57);
  ctx.fillStyle = '#bca57f'; for (let line = -52; line < -3; line += 7) ctx.fillRect(-48, line, 96, 1);
  ctx.fillStyle = '#674636'; ctx.beginPath(); ctx.moveTo(-59, -57); ctx.lineTo(0, -96); ctx.lineTo(59, -57); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#866047'; ctx.fillRect(-60, -58, 120, 7);
  // A second front gable and wider porch make the acreage milestone visible
  // at normal camera scale without pretending to add another usable room.
  ctx.fillStyle = '#72503b'; ctx.beginPath(); ctx.moveTo(-47, -56); ctx.lineTo(-25, -77); ctx.lineTo(-3, -56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d7c49d'; ctx.beginPath(); ctx.moveTo(-41, -56); ctx.lineTo(-25, -71); ctx.lineTo(-9, -56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6f4d38'; ctx.fillRect(26, -91, 10, 28); ctx.fillStyle = '#927158'; ctx.fillRect(24, -95, 14, 5);
  const smoke = Math.sin(now / 1000) * 2;
  ctx.fillStyle = 'rgba(235,231,215,.48)'; ctx.beginPath(); ctx.arc(33 + smoke, -103, 4, 0, Math.PI * 2); ctx.arc(37 - smoke, -111, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a4032'; ctx.fillRect(-8, -31, 17, 30); ctx.fillStyle = '#c79e4d'; ctx.beginPath(); ctx.arc(5, -15, 1.5, 0, Math.PI * 2); ctx.fill();
  const windows = [-37, -20, 19, 36];
  ctx.fillStyle = '#a6c9c4'; for (const windowX of windows) ctx.fillRect(windowX - 6, -44, 12, 15);
  ctx.strokeStyle = 'rgba(78,53,38,.55)'; ctx.lineWidth = 1.7;
  for (const windowX of windows) { ctx.beginPath(); ctx.moveTo(windowX, -45); ctx.lineTo(windowX, -28); ctx.moveTo(windowX - 7, -36.5); ctx.lineTo(windowX + 7, -36.5); ctx.stroke(); }
  ctx.fillStyle = '#efe4c5'; ctx.fillRect(-55, -7, 110, 5); for (const post of [-45, -15, 15, 45]) ctx.fillRect(post - 2, -26, 4, 24);
  ctx.strokeStyle = '#9d7652'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-51, -18); ctx.lineTo(-12, -18); ctx.moveTo(12, -18); ctx.lineTo(51, -18); ctx.stroke();
  ctx.fillStyle = '#8b674b'; ctx.fillRect(-58, -3, 116, 6);
  ctx.fillStyle = '#d3b06c'; ctx.fillRect(12, -5, 22, 3);
  ctx.restore();
}

function drawFarmDestination(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, now: number, destination: NonNullable<NonNullable<RenderScene['farm']>['destination']>): void {
  // Tractor movement is already readable from the machine itself.  Avoid the
  // oversized selection ring that used to travel underneath it.
  if (destination.kind === 'tractor') return;
  const point = farmWorldPoint(destination); const x = camera.sx(isoX(point.x, point.y)); const y = camera.sy(isoY(point.x, point.y));
  const pulse = 1 + Math.sin(now / 180) * .12;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.strokeStyle = destination.kind === 'walk' ? '#f5df84' : '#d8f0c1'; ctx.lineWidth = Math.max(1.5, 2.2 * zoom); ctx.globalAlpha = .8; ctx.beginPath(); ctx.ellipse(0, 0, 21 * zoom, 9 * zoom, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

function drawFarmInteractionHint(ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, hint: NonNullable<NonNullable<RenderScene['farm']>['interactionHint']>): void {
  const point = farmWorldPoint(hint); const x = camera.sx(isoX(point.x, point.y)); const y = camera.sy(isoY(point.x, point.y)) - 52 * zoom;
  ctx.save(); ctx.font = `700 ${Math.max(11, 12 * zoom)}px Segoe UI, sans-serif`; const width = ctx.measureText(hint.label).width + 24;
  ctx.fillStyle = 'rgba(31,48,34,.9)'; ctx.beginPath(); ctx.roundRect(x - width / 2, y - 18, width, 26, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(244,226,167,.78)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff8dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(hint.label, x, y - 5); ctx.restore();
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

function drawFarmRoadsideStand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  completedToday: boolean,
  now: number,
): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.32, zoom * 1.32);
  ctx.fillStyle = 'rgba(44,32,22,.24)'; ctx.beginPath(); ctx.ellipse(0, 5, 48, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#805431'; ctx.fillRect(-39, -8, 78, 10); ctx.fillStyle = '#aa7540'; ctx.fillRect(-35, -18, 70, 12);
  for (const px of [-34, 30]) { ctx.fillStyle = '#6f492e'; ctx.fillRect(px, -18, 5, 22); }
  ctx.fillStyle = '#6d4a31'; ctx.fillRect(-38, -65, 5, 49); ctx.fillRect(33, -65, 5, 49);
  ctx.fillStyle = '#3f7042'; ctx.beginPath(); ctx.moveTo(-48, -62); ctx.lineTo(-37, -88); ctx.lineTo(37, -88); ctx.lineTo(48, -62); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0dc9d'; ctx.fillRect(-43, -76, 86, 13);
  ctx.fillStyle = '#315d3a'; ctx.font = '900 9px Segoe UI, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MCALLISTER FARM STAND', 0, -67);
  const awning = ['#f3dfaa', '#b95b3f', '#f3dfaa', '#b95b3f', '#f3dfaa'];
  awning.forEach((color, index) => { ctx.fillStyle = color; ctx.fillRect(-45 + index * 18, -63, 18, 13); });
  ctx.fillStyle = '#956339';
  for (const bx of [-25, 0, 25]) { ctx.fillRect(bx - 11, -29, 22, 13); ctx.strokeStyle = '#6b4328'; ctx.strokeRect(bx - 11, -29, 22, 13); }
  if (!completedToday) {
    const produce = ['#e6c34d', '#d95f49', '#6e9d49'];
    for (let basket = 0; basket < 3; basket++) for (let item = 0; item < 5; item++) {
      const bob = Math.sin(now / 900 + basket * 2 + item) * .35;
      ctx.fillStyle = produce[basket]; ctx.beginPath(); ctx.arc(-31 + basket * 25 + (item % 3) * 6, -31 - Math.floor(item / 3) * 5 + bob, 3.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#d7c28e'; ctx.fillRect(19, -48, 17, 17); ctx.strokeStyle = '#704b2e'; ctx.lineWidth = 1.5; ctx.strokeRect(19, -48, 17, 17);
  ctx.fillStyle = '#704b2e'; ctx.fillRect(23, -44, 9, 2);
  if (completedToday) {
    ctx.save(); ctx.rotate(-.06); ctx.fillStyle = '#f0dc9d'; ctx.fillRect(-29, -43, 47, 16); ctx.strokeStyle = '#704b2e'; ctx.strokeRect(-29, -43, 47, 16);
    ctx.fillStyle = '#8b4936'; ctx.font = '900 8px Segoe UI, sans-serif'; ctx.fillText('SOLD TODAY', -5, -32); ctx.restore();
  }
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

function drawFarmFarmer(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, avatar: AvatarConfig, facing: FarmFacing, frame: number, now: number, variant: 'owner' | 'farmhand' = 'owner'): void {
  const walk = frame % FARM_WALK_FRAME_COUNT; const bob = walk ? (walk === 1 ? -2 : walk === 3 ? 1 : 0) : Math.sin(now / 700) * .8;
  const skin = avatar.skin.includes('deep') ? '#7a4d38' : avatar.skin.includes('tan') ? '#bd8056' : '#f0c29b';
  const hair = avatar.hair.includes('black') ? '#25201e' : '#70422c';
  ctx.save(); ctx.translate(x, y + bob * zoom); ctx.scale(zoom * 2, zoom * 2);
  ctx.fillStyle = 'rgba(38,30,24,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  const swing = walk ? (walk % 2 ? 4 : -4) : 0;
  ctx.strokeStyle = variant === 'farmhand' ? '#48633f' : '#365b9a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(-7 + swing, -8); ctx.moveTo(5, -20); ctx.lineTo(7 - swing, -8); ctx.stroke();
  ctx.strokeStyle = '#5a3825'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-5 - swing, 0); ctx.moveTo(4, -9); ctx.lineTo(5 + swing, 0); ctx.stroke();
  ctx.fillStyle = variant === 'farmhand' ? '#c98f35' : '#3e78a8'; ctx.fillRect(-9, -29, 18, 21); ctx.fillStyle = '#f0dfb5'; ctx.fillRect(-5, -29, 10, 13); ctx.fillStyle = variant === 'farmhand' ? '#577044' : '#d99b3d'; ctx.fillRect(-9, -29, 18, 4);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -38, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, -42, 9, Math.PI, 0); ctx.fill();
  ctx.fillStyle = variant === 'farmhand' ? '#4f6c43' : '#c58a2e'; ctx.fillRect(-11, -49, 22, 4); ctx.fillRect(-6, -54, 12, 7);
  if (facing !== 'north') { ctx.fillStyle = '#fff'; const eyeX = facing === 'east' ? 3 : facing === 'west' ? -3 : 0; ctx.fillRect(eyeX - 2, -39, 2, 2); }
  if (facing === 'south') { ctx.fillStyle = '#fff'; ctx.fillRect(2, -39, 2, 2); ctx.strokeStyle = '#9f5d4e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -35, 3, 0, Math.PI); ctx.stroke(); }
  if (facing === 'north') { ctx.fillStyle = hair; ctx.fillRect(-8, -43, 16, 10); ctx.strokeStyle = '#f0dfb5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, -28); ctx.lineTo(-5, -18); ctx.moveTo(5, -28); ctx.lineTo(5, -18); ctx.stroke(); }
  if (facing === 'east' || facing === 'west') { ctx.fillStyle = skin; ctx.fillRect(facing === 'east' ? 8 : -10, -38, 3, 3); }
  ctx.restore();
}

function drawFarmHarvestBasket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zoom: number,
  facing: FarmFacing,
  fill: number,
): void {
  const side = facing === 'west' ? -1 : facing === 'north' ? -0.75 : 1;
  const lift = facing === 'north' ? -18 : -13;
  ctx.save();
  ctx.translate(x + side * 19 * zoom, y + lift * zoom);
  ctx.scale(zoom * 1.45, zoom * 1.45);
  ctx.strokeStyle = '#6f4527'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -3, 7, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#b9803d';
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(8, -2); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7b542e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(6, 1); ctx.moveTo(-5, 4); ctx.lineTo(5, 4); ctx.stroke();
  if (fill > 0) {
    const visible = Math.max(2, Math.min(5, Math.ceil(fill * 5)));
    const colors = ['#e7bd3d', '#8eac4e', '#d86b43', '#e1a240', '#759e45'];
    for (let i = 0; i < visible; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.arc(-5 + i * 2.5, -2.5 - (i % 2), 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }
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

function drawScoutFrisbee(
  ctx: CanvasRenderingContext2D, camera: Camera, zoom: number, now: number,
  throwFrom: { x: number; y: number }, carrier: { x: number; y: number }, to: { x: number; y: number }, phase: 'outbound' | 'pickup' | 'returning', phaseStartedAt: number,
): void {
  const start = { x: camera.sx(isoX(throwFrom.x, throwFrom.y)), y: camera.sy(isoY(throwFrom.x, throwFrom.y) + TILE_H / 2) };
  const end = { x: camera.sx(isoX(to.x, to.y)), y: camera.sy(isoY(to.x, to.y) + TILE_H / 2) };
  const carrierPoint = { x: camera.sx(isoX(carrier.x, carrier.y)), y: camera.sy(isoY(carrier.x, carrier.y) + TILE_H / 2) };
  ctx.save();
  if (phase === 'outbound') {
    ctx.strokeStyle = 'rgba(245, 193, 64, .72)'; ctx.lineWidth = Math.max(1, 1.5 * zoom); ctx.setLineDash([4 * zoom, 4 * zoom]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y - 20 * zoom); ctx.quadraticCurveTo((start.x + end.x) / 2, Math.min(start.y, end.y) - 58 * zoom, end.x, end.y - 10 * zoom); ctx.stroke(); ctx.setLineDash([]);
  }
  const progress = frisbeeThrowProgress(phase, phaseStartedAt, now);
  const curve = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - 58 * zoom };
  const thrownPoint = {
    x: (1 - progress) * (1 - progress) * start.x + 2 * (1 - progress) * progress * curve.x + progress * progress * end.x,
    y: (1 - progress) * (1 - progress) * (start.y - 20 * zoom) + 2 * (1 - progress) * progress * curve.y + progress * progress * (end.y - 10 * zoom),
  };
  const frisbeePoint = phase === 'returning' ? carrierPoint : thrownPoint;
  const bob = phase === 'outbound' ? 10 + Math.sin(now / 80) * 4 : phase === 'pickup' ? 3 : 8 + Math.sin(now / 100) * 2;
  ctx.translate(frisbeePoint.x, frisbeePoint.y - bob * zoom); ctx.rotate(now / 230);
  ctx.fillStyle = '#ef7d35'; ctx.beginPath(); ctx.ellipse(0, 0, 7 * zoom, 2.8 * zoom, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff0bc'; ctx.lineWidth = Math.max(1, zoom); ctx.beginPath(); ctx.moveTo(-4 * zoom, 0); ctx.lineTo(4 * zoom, 0); ctx.stroke(); ctx.restore();
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

function drawFarmBarn(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number, loftOwned = false, grainSiloOwned = false): void {
  ctx.save(); ctx.translate(x, y); ctx.scale(zoom * 1.75, zoom * 1.75);
  if (grainSiloOwned) {
    ctx.save();
    ctx.translate(62, -2);
    ctx.fillStyle = 'rgba(40,30,20,.2)'; ctx.beginPath(); ctx.ellipse(0, 8, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
    const metal = ctx.createLinearGradient(-19, 0, 19, 0);
    metal.addColorStop(0, '#77888a'); metal.addColorStop(.28, '#bdc7c3'); metal.addColorStop(.55, '#eef0df'); metal.addColorStop(.82, '#9caeaa'); metal.addColorStop(1, '#667778');
    ctx.fillStyle = metal; ctx.fillRect(-19, -58, 38, 63);
    ctx.beginPath(); ctx.ellipse(0, -58, 19, 7, 0, Math.PI, Math.PI * 2); ctx.lineTo(19, -48); ctx.lineTo(-19, -48); ctx.closePath(); ctx.fillStyle = '#c8d1cc'; ctx.fill();
    ctx.strokeStyle = 'rgba(79,94,94,.65)'; ctx.lineWidth = 1;
    for (let ringY = -46; ringY < 4; ringY += 11) { ctx.beginPath(); ctx.moveTo(-19, ringY); ctx.quadraticCurveTo(0, ringY + 4, 19, ringY); ctx.stroke(); }
    ctx.strokeStyle = '#5b6766'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -51); ctx.lineTo(12, 2); ctx.stroke();
    for (let rungY = -43; rungY < 0; rungY += 8) { ctx.beginPath(); ctx.moveTo(8, rungY); ctx.lineTo(16, rungY); ctx.stroke(); }
    ctx.fillStyle = '#ae4d37'; ctx.fillRect(-5, -70, 10, 8); ctx.fillStyle = '#e5c788'; ctx.fillRect(-7, -63, 14, 3);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(40,30,20,.22)'; ctx.beginPath(); ctx.ellipse(0, 5, 58, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a84634'; ctx.fillRect(-42, -53, 84, 55);
  ctx.strokeStyle = '#7b392d'; ctx.lineWidth = 2; for (let bx = -35; bx < 40; bx += 10) { ctx.beginPath(); ctx.moveTo(bx, -50); ctx.lineTo(bx, -2); ctx.stroke(); }
  ctx.fillStyle = '#f2d8a5'; ctx.fillRect(-45, -54, 90, 6);
  ctx.beginPath(); ctx.moveTo(-50, -53); ctx.lineTo(0, -85); ctx.lineTo(50, -53); ctx.closePath(); ctx.fillStyle = '#70372d'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-44, -54); ctx.lineTo(0, -80); ctx.lineTo(44, -54); ctx.closePath(); ctx.fillStyle = '#bd5840'; ctx.fill();
  if (loftOwned) {
    ctx.fillStyle = '#8b5a35'; ctx.fillRect(32, -43, 24, 35); ctx.fillStyle = '#b87b42'; ctx.fillRect(29, -47, 30, 5);
    ctx.fillStyle = '#ead39a'; ctx.fillRect(35, -40, 18, 4);
  }
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
  workKind?: ParcelWorkKind,
  harvestWagon?: { tier: 'basic' | 'county'; used: number; attached: boolean },
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
  if (working && workKind) drawTractorImplement(ctx, workKind, now);
  else if (harvestWagon?.attached) drawPersistentHarvestWagon(ctx, harvestWagon.tier, harvestWagon.used, now);
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
  if (status === 'maintenance') {
    // An open hood, exposed engine, and wheel chock make the starting repair
    // state readable without adding another gameplay object or hit target.
    ctx.fillStyle = '#4b4a43';
    ctx.fillRect(8, -25, 9, 13);
    ctx.fillStyle = '#d7b96f';
    for (const engineX of [10, 13, 16]) ctx.fillRect(engineX, -23, 1.4, 9);
    ctx.save();
    ctx.translate(17, -29);
    ctx.rotate(-.38);
    ctx.fillStyle = '#8f867b';
    ctx.fillRect(-8, -3, 19, 5);
    ctx.restore();
    ctx.fillStyle = '#c88a38';
    ctx.fillRect(-32, -3, 9, 5);
    ctx.fillStyle = '#5e432a';
    ctx.fillRect(-31, -4, 7, 2);
  }
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
  ctx.restore();
}

function drawPersistentHarvestWagon(ctx: CanvasRenderingContext2D, tier: 'basic' | 'county', used: number, now: number): void {
  const county = tier === 'county';
  ctx.strokeStyle = '#6b5237'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -11); ctx.lineTo(-42, -10); ctx.stroke();
  ctx.fillStyle = county ? '#315f76' : '#8b5938'; ctx.fillRect(-78, -29, county ? 45 : 37, 20);
  ctx.fillStyle = county ? '#5d99ad' : '#b67a42'; ctx.beginPath(); ctx.moveTo(-81, -31); ctx.lineTo(county ? -29 : -39, -31); ctx.lineTo(county ? -34 : -43, -8); ctx.lineTo(-76, -8); ctx.closePath(); ctx.fill();
  if (used > 0) { ctx.fillStyle = '#d8ad4b'; for (const cargoX of [-72, -62, -52, -42]) { ctx.beginPath(); ctx.ellipse(cargoX, -31, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); } }
  drawTractorWheel(ctx, -69, -6, 7, 2.6, now / 130);
}

function drawTractorImplement(ctx: CanvasRenderingContext2D, workKind: ParcelWorkKind, now: number): void {
  const bounce = Math.sin(now / 115) * .8;
  ctx.save(); ctx.translate(0, bounce);
  ctx.strokeStyle = '#6b5237'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -11); ctx.lineTo(-42, -10); ctx.stroke();
  if (workKind === 'plant') {
    // Compact row-crop planter: hopper, toolbar, gauge wheel, and three openers.
    ctx.fillStyle = '#486f3b'; ctx.fillRect(-67, -26, 29, 15);
    ctx.fillStyle = '#d8b950'; ctx.beginPath(); ctx.moveTo(-65, -26); ctx.lineTo(-42, -26); ctx.lineTo(-47, -34); ctx.lineTo(-60, -34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#76532f'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-72, -8); ctx.lineTo(-35, -8); ctx.stroke();
    ctx.fillStyle = '#3b3b36'; for (const opener of [-66, -54, -42]) { ctx.beginPath(); ctx.arc(opener, -3, 4.2, 0, Math.PI * 2); ctx.fill(); }
  } else {
    // Harvest wagon follows the tractor and visibly carries the collected crop.
    ctx.fillStyle = '#8b5938'; ctx.fillRect(-78, -29, 37, 20);
    ctx.fillStyle = '#b67a42'; ctx.beginPath(); ctx.moveTo(-81, -31); ctx.lineTo(-39, -31); ctx.lineTo(-43, -8); ctx.lineTo(-76, -8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#654128'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#d8ad4b'; for (const cargoX of [-72, -62, -52, -44]) { ctx.beginPath(); ctx.ellipse(cargoX, -31, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
    drawTractorWheel(ctx, -69, -6, 7, 2.6, now / 130);
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
