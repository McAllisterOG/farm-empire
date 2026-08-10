import type { ActionResult, GameState } from '../core/types';
import { cropView } from '../core/crops';
import { cropDef, farmCropDef } from '../core/registry';
import {
  NEIGHBOR_FIELD_TILES, advanceFarmClock, advanceFarmDays, buyFarmSeeds, farmOf,
  formatMoney, harvestFarmCrop, plantFarmCrop, purchaseNeighborParcel, selectFarmCrop,
  sellStoredCrop, syncCashMirror,
} from '../core/farmBusiness';
import { Renderer, sceneFromState, type RenderScene, type SceneActor } from '../render/renderer';
import { isoX, isoY } from '../render/iso';
import { FarmHud } from '../ui/farmHud';
import { hideActionMenu, isActionMenuOpen, showActionMenu } from '../ui/actionMenu';
import { closePanel, isPanelOpen } from '../ui/modal';
import { floatText, toast } from '../ui/toast';
import {
  openFarmEquipment, openFarmLand, openFarmMarket, openFarmSeedShop, type FarmPanelActions,
} from '../ui/panels/farmPanels';
import { saveToSlot } from '../save/save';

const AUTOSAVE_MS = 15_000;

export class FarmEmpireApp {
  state: GameState;
  private slot: number;
  private renderer: Renderer;
  private hud: FarmHud;
  private playerActor: SceneActor;
  private hover: { tx: number; ty: number } | null = null;
  private walkTarget: { x: number; y: number; cb: (() => void) | null } | null = null;
  private running = true;
  private raf = 0;
  private lastFrame = 0;
  private lastSave: number;
  private devTools: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement, state: GameState, slot: number, onBackToTitle: () => void) {
    if (!state.farm) throw new Error('Cannot start Farm Empire without farm state.');
    this.state = state;
    this.slot = slot;
    this.renderer = new Renderer(canvas);
    this.playerActor = {
      avatar: state.player.avatar,
      x: state.player.px,
      y: state.player.py,
      walking: false,
    };
    this.hud = new FarmHud({
      onSelectCrop: (cropId) => this.dispatch(selectFarmCrop(this.state, cropId)),
      onSeedShop: () => openFarmSeedShop(this.state, this.panelActions()),
      onMarket: () => openFarmMarket(this.state, this.panelActions()),
      onLand: () => openFarmLand(this.state, this.panelActions()),
      onEquipment: () => openFarmEquipment(this.state),
      onSave: () => {
        this.save();
        toast('Farm saved.', 'good');
      },
    });
    this.bindInput(canvas);
    this.renderer.centerOnIsland(sceneFromState(state));
    this.renderer.camera.zoomAt(1.22, window.innerWidth / 2, window.innerHeight / 2);
    this.lastSave = Date.now();
    window.addEventListener('beforeunload', this.save);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const debug = {
      state: () => this.state,
      tileToScreen: (x: number, y: number) => [
        this.renderer.camera.sx(isoX(x, y)),
        this.renderer.camera.sy(isoY(x, y)),
      ],
      matureAll: () => this.matureAll(),
      advanceDay: (days = 1) => advanceFarmDays(this.state, days),
      setCashCents: (cents: number) => {
        farmOf(this.state).cashCents = Math.max(0, Math.round(cents));
        syncCashMirror(this.state);
      },
      save: () => this.save(),
    };
    (window as unknown as Record<string, unknown>).__FE__ = debug;
    if (import.meta.env.DEV) this.devTools = this.createDevTools();
    this.loop();
  }

  private panelActions(): FarmPanelActions {
    return {
      buySeeds: (cropId, count) => buyFarmSeeds(this.state, cropId, count),
      sellCrop: (cropId, count) => sellStoredCrop(this.state, cropId, count),
      buyLand: () => purchaseNeighborParcel(this.state),
      dispatch: this.dispatch,
    };
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.hud.destroy();
    window.removeEventListener('beforeunload', this.save);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.devTools?.remove();
    delete (window as unknown as Record<string, unknown>).__FE__;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.save();
  };

  save = (): void => {
    this.state.player.px = this.playerActor.x;
    this.state.player.py = this.playerActor.y;
    saveToSlot(this.state, this.slot, Date.now());
  };

  dispatch = (result: ActionResult): void => {
    if (!result.ok) {
      toast(result.reason || 'That action cannot be completed.', 'bad');
      return;
    }
    for (const event of result.events ?? []) {
      if (event.type === 'plant') {
        toast(`${farmCropDef(String(event.target)).name} planted. Tractor efficiency applied.`, 'good');
      } else if (event.type === 'harvest') {
        toast(`Harvested ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} into the barn.`, 'good');
        floatText(this.playerScreenX(), this.playerScreenY() - 45, `+${event.amount ?? 0}`, 'float-good');
      } else if (event.type === 'sell') {
        toast(`Sold ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} for ${formatMoney(Number(event.data ?? 0))}.`, 'good');
      } else if (event.type === 'expand') {
        toast('Neighboring parcel purchased. Nine field tiles are now usable.', 'good');
      } else if (event.type === 'toast' && event.target) {
        toast(event.target, 'good');
      }
    }
    this.hud.update(this.state);
  };

  private playerScreenX(): number {
    return this.renderer.camera.sx(isoX(this.playerActor.x, this.playerActor.y));
  }

  private playerScreenY(): number {
    return this.renderer.camera.sy(isoY(this.playerActor.x, this.playerActor.y));
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    let downX = 0;
    let downY = 0;
    let dragging = false;
    let panning = false;
    canvas.addEventListener('pointerdown', (event) => {
      downX = event.clientX;
      downY = event.clientY;
      dragging = true;
      panning = false;
    });
    canvas.addEventListener('pointermove', (event) => {
      if (dragging) {
        const dx = event.clientX - downX;
        const dy = event.clientY - downY;
        if (panning || Math.hypot(dx, dy) > 6) {
          panning = true;
          this.renderer.camera.pan(event.movementX, event.movementY);
        }
      }
      this.hover = this.renderer.camera.tileAt(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerup', (event) => {
      dragging = false;
      if (panning) {
        panning = false;
        return;
      }
      this.onClick(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerleave', () => {
      dragging = false;
      this.hover = null;
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.renderer.camera.zoomAt(event.deltaY < 0 ? 1.12 : 0.9, event.clientX, event.clientY);
    }, { passive: false });
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (isActionMenuOpen()) hideActionMenu();
      else if (isPanelOpen()) closePanel();
    });
  }

  private onClick(sx: number, sy: number): void {
    if (isActionMenuOpen()) {
      hideActionMenu();
      return;
    }
    const { tx, ty } = this.renderer.camera.tileAt(sx, sy);
    const farm = farmOf(this.state);

    if (!farm.parcels.northOwned && NEIGHBOR_FIELD_TILES.some((tile) => tile.x === tx && tile.y === ty)) {
      openFarmLand(this.state, this.panelActions());
      return;
    }

    const tractor = farm.equipment.tractor;
    if (Math.abs(tractor.x - tx) <= 1 && Math.abs(tractor.y - ty) <= 1) {
      openFarmEquipment(this.state);
      return;
    }

    const barn = this.state.placements.find((placement) => placement.defId === 'bld_storage');
    if (barn && tx >= barn.x && tx < barn.x + 2 && ty >= barn.y && ty < barn.y + 2) {
      openFarmMarket(this.state, this.panelActions());
      return;
    }

    const plot = this.state.plots.find((candidate) => candidate.x === tx && candidate.y === ty);
    if (plot) {
      this.walkNear(tx, ty, () => this.openPlotMenu(plot.uid, sx, sy));
      return;
    }
    this.walkNear(tx, ty, null);
  }

  private openPlotMenu(plotUid: number, sx: number, sy: number): void {
    const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
    if (!plot) return;
    const farm = farmOf(this.state);
    if (!plot.crop) {
      const def = farmCropDef(farm.selectedCropId);
      const count = farm.seeds[def.id] ?? 0;
      showActionMenu(sx, sy, 'Empty field tile', [
        {
          label: `Plant ${def.name} (${count} seed${count === 1 ? '' : 's'})`,
          icon: `icon:seed_${def.id.replace('crop_', '')}`,
          onClick: () => this.dispatch(plantFarmCrop(this.state, plotUid, def.id, Date.now())),
        },
        { label: 'Open seed supplier', onClick: () => openFarmSeedShop(this.state, this.panelActions()) },
      ]);
      return;
    }
    const def = farmCropDef(plot.crop.defId);
    const view = cropView(plot.crop, Date.now());
    if (view.stage === 'ready') {
      showActionMenu(sx, sy, `${def.name} · Ready`, [{
        label: 'Harvest into barn', icon: 'fx:ready',
        onClick: () => this.dispatch(harvestFarmCrop(this.state, plotUid, Date.now())),
      }]);
    } else {
      showActionMenu(sx, sy, `${def.name} · ${view.stage}`, [{
        label: `Growing · ${Math.max(1, Math.ceil(view.etaMs / 1000))}s remaining`,
        disabled: true,
        onClick: () => {},
      }]);
    }
  }

  private walkNear(tx: number, ty: number, cb: (() => void) | null): void {
    const dist = Math.hypot(this.playerActor.x - tx, this.playerActor.y - ty);
    if (dist <= 1.45) {
      cb?.();
      return;
    }
    const dx = this.playerActor.x - tx;
    const dy = this.playerActor.y - ty;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    this.walkTarget = { x: tx + dx / len, y: ty + dy / len, cb };
  }

  private matureAll(): void {
    const now = Date.now();
    for (const plot of this.state.plots) {
      if (!plot.crop) continue;
      plot.crop.plantedAt = now - cropDef(plot.crop.defId).growMs - 1_000;
    }
  }

  private createDevTools(): HTMLElement {
    const root = document.createElement('div');
    root.className = 'fe-dev-tools';
    const addButton = (testId: string, label: string, action: () => void): void => {
      const button = document.createElement('button');
      button.dataset.testid = testId;
      button.textContent = label;
      button.addEventListener('click', action);
      root.append(button);
    };
    addButton('dev-mature-all', 'Mature crops', () => this.matureAll());
    addButton('dev-advance-day', 'Advance day', () => advanceFarmDays(this.state, 1));
    addButton('dev-fund-land', 'Fund land test', () => {
      farmOf(this.state).cashCents = 1_000_000;
      syncCashMirror(this.state);
    });
    addButton('dev-open-first-plot', 'Open first plot', () => {
      const plot = this.state.plots[0];
      if (!plot) return;
      const x = this.renderer.camera.sx(isoX(plot.x + 0.5, plot.y + 0.5));
      const y = this.renderer.camera.sy(isoY(plot.x + 0.5, plot.y + 0.5));
      this.openPlotMenu(plot.uid, x, y);
    });
    const plotPoint = document.createElement('span');
    plotPoint.dataset.testid = 'dev-first-plot-point';
    root.append(plotPoint);
    document.body.append(root);
    return root;
  }

  private updateDevTools(): void {
    if (!this.devTools || this.state.plots.length === 0) return;
    const plot = this.state.plots[0];
    const point = this.devTools.querySelector<HTMLElement>('[data-testid="dev-first-plot-point"]');
    if (!point) return;
    point.dataset.screenX = String(Math.round(this.renderer.camera.sx(isoX(plot.x + 0.5, plot.y + 0.5))));
    point.dataset.screenY = String(Math.round(this.renderer.camera.sy(isoY(plot.x + 0.5, plot.y + 0.5))));
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = Date.now();
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16;
    this.lastFrame = now;
    advanceFarmClock(this.state, now);

    if (this.walkTarget) {
      const speed = 5.2 / 1_000;
      const dx = this.walkTarget.x - this.playerActor.x;
      const dy = this.walkTarget.y - this.playerActor.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step) {
        this.playerActor.x = this.walkTarget.x;
        this.playerActor.y = this.walkTarget.y;
        const cb = this.walkTarget.cb;
        this.walkTarget = null;
        this.playerActor.walking = false;
        cb?.();
      } else {
        this.playerActor.x += dx / dist * step;
        this.playerActor.y += dy / dist * step;
        this.playerActor.walking = true;
      }
    }

    this.renderer.render(this.buildScene(), now);
    this.hud.update(this.state);
    this.updateDevTools();
    if (now - this.lastSave >= AUTOSAVE_MS) {
      this.lastSave = now;
      this.save();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private buildScene(): RenderScene {
    const scene = sceneFromState(this.state);
    scene.actors = [{ ...this.playerActor, name: this.state.player.name }];
    const farm = farmOf(this.state);
    scene.farm = {
      lockedTiles: farm.parcels.northOwned ? [] : NEIGHBOR_FIELD_TILES,
      parcelLabel: `${formatMoney(650_000)} · 9 field tiles`,
      tractor: farm.equipment.tractor,
    };
    if (this.hover) {
      scene.hover = { tx: this.hover.tx, ty: this.hover.ty, ok: true };
    }
    return scene;
  }
}
