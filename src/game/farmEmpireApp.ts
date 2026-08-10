import type { ActionResult, GameState } from '../core/types';
import { cropView } from '../core/crops';
import { cropDef, farmCropDef } from '../core/registry';
import {
  NEIGHBOR_FIELD_TILES, advanceFarmClock, advanceFarmDays, buyFarmSeeds, farmOf,
  formatMoney, harvestFarmCrop, plantFarmCrop, purchaseNeighborParcel, selectFarmCrop,
  sellStoredCrop, syncCashMirror, ownedFarmParcelAt, planParcelWork,
  placePlayerAtTractorDismount, type FarmParcelId, type ParcelWorkKind,
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
const TRACTOR_SPEED_TILES_PER_MS = 3.6 / 1_000;
const FIELD_ACTION_PAUSE_MS = 260;

interface TractorMoveTarget {
  x: number;
  y: number;
  cb: (() => void) | null;
}

interface TractorJob {
  kind: ParcelWorkKind;
  parcelId: FarmParcelId;
  cropId?: string;
  targetPlotUids: number[];
  nextIndex: number;
  completed: number;
  skipped: number;
  lastFailure?: string;
  waitUntil: number;
}

export class FarmEmpireApp {
  state: GameState;
  private slot: number;
  private renderer: Renderer;
  private hud: FarmHud;
  private playerActor: SceneActor;
  private hover: { tx: number; ty: number } | null = null;
  private walkTarget: { x: number; y: number; cb: (() => void) | null } | null = null;
  private operatingTractor = false;
  private tractorTarget: TractorMoveTarget | null = null;
  private tractorJob: TractorJob | null = null;
  private equipmentPanelOpen = false;
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
      onEquipment: () => this.openEquipmentPanel(),
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
      tractorScreen: () => {
        const tractor = farmOf(this.state).equipment.tractor;
        return [
          this.renderer.camera.sx(isoX(tractor.x, tractor.y)),
          this.renderer.camera.sy(isoY(tractor.x, tractor.y)),
        ];
      },
    };
    if (import.meta.env.DEV) Object.assign(debug, {
      matureAll: () => this.matureAll(),
      advanceDay: (days = 1) => advanceFarmDays(this.state, days),
      setCashCents: (cents: number) => {
        farmOf(this.state).cashCents = Math.max(0, Math.round(cents));
        syncCashMirror(this.state);
      },
      save: () => this.save(),
    });
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
    if (this.operatingTractor) {
      placePlayerAtTractorDismount(this.state);
    } else {
      this.state.player.px = this.playerActor.x;
      this.state.player.py = this.playerActor.y;
    }
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
    this.hud.update(this.state, this.tractorHudRuntime());
  };

  private playerScreenX(): number {
    const tractor = farmOf(this.state).equipment.tractor;
    const x = this.operatingTractor ? tractor.x : this.playerActor.x;
    const y = this.operatingTractor ? tractor.y : this.playerActor.y;
    return this.renderer.camera.sx(isoX(x, y));
  }

  private playerScreenY(): number {
    const tractor = farmOf(this.state).equipment.tractor;
    const x = this.operatingTractor ? tractor.x : this.playerActor.x;
    const y = this.operatingTractor ? tractor.y : this.playerActor.y;
    return this.renderer.camera.sy(isoY(x, y));
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
      if (this.tractorJob) this.cancelTractorJob();
      else if (this.tractorTarget) {
        this.tractorTarget = null;
        toast('Tractor drive cancelled.', 'good');
      } else if (isActionMenuOpen()) hideActionMenu();
      else if (isPanelOpen()) closePanel();
    });
  }

  private onClick(sx: number, sy: number): void {
    if (isActionMenuOpen()) {
      hideActionMenu();
      return;
    }
    if (this.tractorJob) {
      toast('A tractor field job is already active. Press Escape to cancel it.', 'bad');
      return;
    }
    const { tx, ty } = this.renderer.camera.tileAt(sx, sy);
    const farm = farmOf(this.state);

    if (!farm.parcels.northOwned && NEIGHBOR_FIELD_TILES.some((tile) => tile.x === tx && tile.y === ty)) {
      openFarmLand(this.state, this.panelActions());
      return;
    }

    const plot = this.state.plots.find((candidate) => candidate.x === tx && candidate.y === ty);
    if (plot && this.operatingTractor) {
      const parcelId = ownedFarmParcelAt(this.state, tx, ty);
      if (parcelId) this.openTractorParcelMenu(parcelId, tx, ty, sx, sy);
      return;
    }

    const tractor = farm.equipment.tractor;
    if (Math.hypot(tractor.x - tx, tractor.y - ty) <= 0.8) {
      this.openEquipmentPanel();
      return;
    }

    const barn = this.state.placements.find((placement) => placement.defId === 'bld_storage');
    if (barn && tx >= barn.x && tx < barn.x + 2 && ty >= barn.y && ty < barn.y + 2) {
      openFarmMarket(this.state, this.panelActions());
      return;
    }

    if (plot) {
      this.walkNear(tx, ty, () => this.openPlotMenu(plot.uid, sx, sy));
      return;
    }
    if (this.operatingTractor) this.driveTractorTo(tx, ty);
    else this.walkNear(tx, ty, null);
  }

  private openEquipmentPanel(): void {
    this.equipmentPanelOpen = true;
    openFarmEquipment(this.state, {
      operating: this.operatingTractor,
      jobActive: !!this.tractorJob || !!this.tractorTarget,
      onToggleOperating: () => this.toggleTractorOperating(),
      onClose: () => {
        this.equipmentPanelOpen = false;
      },
    });
  }

  private closeEquipmentPanelIfOpen(): void {
    if (!this.equipmentPanelOpen) return;
    if (isPanelOpen()) closePanel();
    this.equipmentPanelOpen = false;
  }

  private toggleTractorOperating(): void {
    const tractor = farmOf(this.state).equipment.tractor;
    if (this.tractorJob || this.tractorTarget) {
      toast('Finish or cancel the current tractor movement before exiting.', 'bad');
      return;
    }
    if (!this.operatingTractor && tractor.status !== 'operational') {
      toast('The tractor is in maintenance and cannot be operated.', 'bad');
      return;
    }
    if (this.operatingTractor) {
      const dismount = placePlayerAtTractorDismount(this.state);
      this.operatingTractor = false;
      this.playerActor.x = dismount.x;
      this.playerActor.y = dismount.y;
      this.playerActor.walking = false;
      toast('Exited the old tractor.', 'good');
    } else {
      this.walkTarget = null;
      this.playerActor.walking = false;
      this.operatingTractor = true;
      toast('Operating the old tractor. Click ground to drive or a field parcel for batch work.', 'good');
    }
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private driveTractorTo(x: number, y: number): void {
    if (!this.operatingTractor || this.tractorJob) return;
    this.tractorTarget = {
      x,
      y,
      cb: () => toast('Tractor parked.', 'good'),
    };
  }

  private openTractorParcelMenu(parcelId: FarmParcelId, tx: number, ty: number, sx: number, sy: number): void {
    const plan = planParcelWork(this.state, parcelId, Date.now());
    const farm = farmOf(this.state);
    const crop = farmCropDef(farm.selectedCropId);
    const seedCount = farm.seeds[crop.id] ?? 0;
    const parcelName = parcelId === 'starter' ? 'Starter parcel' : 'Neighboring parcel';
    showActionMenu(sx, sy, `${parcelName} · 3×3 tractor work`, [
      {
        label: `Plant ${crop.name} on ${plan.plantPlotUids.length} empty tile${plan.plantPlotUids.length === 1 ? '' : 's'} (${seedCount} seeds)`,
        icon: `icon:seed_${crop.id.replace('crop_', '')}`,
        disabled: plan.plantPlotUids.length === 0,
        onClick: () => this.startTractorJob('plant', parcelId, plan.plantPlotUids, crop.id),
      },
      {
        label: `Harvest ${plan.harvestPlotUids.length} ready tile${plan.harvestPlotUids.length === 1 ? '' : 's'} into barn`,
        icon: 'fx:ready',
        disabled: plan.harvestPlotUids.length === 0,
        onClick: () => this.startTractorJob('harvest', parcelId, plan.harvestPlotUids),
      },
      {
        label: 'Drive to selected tile',
        onClick: () => this.driveTractorTo(tx, ty),
      },
    ]);
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

  private startTractorJob(
    kind: ParcelWorkKind,
    parcelId: FarmParcelId,
    targetPlotUids: number[],
    cropId?: string,
  ): void {
    if (!this.operatingTractor || this.tractorJob) return;
    if (this.tractorTarget) {
      toast('Cancel or finish the current drive before starting field work.', 'bad');
      return;
    }
    if (targetPlotUids.length === 0) {
      toast(`No eligible tiles for tractor ${kind}ing.`, 'bad');
      return;
    }
    this.tractorJob = {
      kind,
      parcelId,
      cropId,
      targetPlotUids: [...targetPlotUids],
      nextIndex: 0,
      completed: 0,
      skipped: 0,
      waitUntil: Date.now(),
    };
    const label = kind === 'plant' ? `Planting ${farmCropDef(String(cropId)).name}` : 'Harvesting ready crops';
    toast(`${label} across ${targetPlotUids.length} tile${targetPlotUids.length === 1 ? '' : 's'}.`, 'good');
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private updateTractorJob(now: number): void {
    const job = this.tractorJob;
    if (!job || this.tractorTarget || now < job.waitUntil) return;
    if (job.nextIndex >= job.targetPlotUids.length) {
      this.finishTractorJob();
      return;
    }

    const plotUid = job.targetPlotUids[job.nextIndex];
    const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
    if (!plot) {
      job.skipped += 1;
      job.lastFailure = 'A planned field tile was unavailable.';
      job.nextIndex += 1;
      job.waitUntil = now + FIELD_ACTION_PAUSE_MS;
      return;
    }
    this.tractorTarget = {
      x: plot.x,
      y: plot.y,
      cb: () => this.applyTractorJobStep(plotUid),
    };
  }

  private applyTractorJobStep(plotUid: number): void {
    const job = this.tractorJob;
    if (!job || job.targetPlotUids[job.nextIndex] !== plotUid) return;
    const result = job.kind === 'plant'
      ? plantFarmCrop(this.state, plotUid, String(job.cropId), Date.now())
      : harvestFarmCrop(this.state, plotUid, Date.now());
    if (result.ok) {
      job.completed += 1;
      const harvest = result.events?.find((event) => event.type === 'harvest');
      floatText(
        this.playerScreenX(),
        this.playerScreenY() - 45,
        job.kind === 'plant' ? 'PLANTED' : `+${harvest?.amount ?? 0}`,
        'float-good',
      );
    } else {
      job.skipped += 1;
      job.lastFailure = result.reason || 'The tile was no longer eligible.';
    }
    job.nextIndex += 1;
    job.waitUntil = Date.now() + FIELD_ACTION_PAUSE_MS;
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private finishTractorJob(): void {
    const job = this.tractorJob;
    if (!job) return;
    const verb = job.kind === 'plant' ? 'Planting' : 'Harvest';
    const summary = `${verb} complete: ${job.completed} completed${job.skipped ? `, ${job.skipped} skipped` : ''}.`;
    const detail = job.skipped && job.lastFailure ? ` ${job.lastFailure}` : '';
    this.tractorJob = null;
    this.tractorTarget = null;
    this.closeEquipmentPanelIfOpen();
    toast(summary + detail, job.completed > 0 ? 'good' : 'bad');
    this.save();
  }

  private cancelTractorJob(): void {
    const job = this.tractorJob;
    if (!job) return;
    const untouched = Math.max(0, job.targetPlotUids.length - job.completed - job.skipped);
    const verb = job.kind === 'plant' ? 'Planting' : 'Harvest';
    this.tractorJob = null;
    this.tractorTarget = null;
    this.closeEquipmentPanelIfOpen();
    toast(`${verb} cancelled: ${job.completed} completed, ${job.skipped} skipped, ${untouched} not attempted.`, 'bad');
    this.save();
  }

  private tractorHudRuntime(): { operating: boolean; working: boolean; statusText: string } {
    const job = this.tractorJob;
    if (job) {
      const total = job.targetPlotUids.length;
      const cropLabel = job.kind === 'plant' ? ` ${farmCropDef(String(job.cropId)).name}` : '';
      const current = Math.min(total, job.nextIndex + 1);
      return {
        operating: true,
        working: true,
        statusText: `${job.kind === 'plant' ? 'Planting' : 'Harvesting'}${cropLabel} · ${job.completed}/${total} completed${job.skipped ? ` · ${job.skipped} skipped` : ''} · tile ${current}/${total}`,
      };
    }
    if (this.operatingTractor && this.tractorTarget) {
      return { operating: true, working: false, statusText: 'Driving tractor · press Escape to stop' };
    }
    return {
      operating: this.operatingTractor,
      working: false,
      statusText: this.operatingTractor ? 'Operating old tractor · ready to drive or work a 3×3 parcel' : '',
    };
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

    if (this.tractorTarget) {
      const tractor = farmOf(this.state).equipment.tractor;
      const dx = this.tractorTarget.x - tractor.x;
      const dy = this.tractorTarget.y - tractor.y;
      const dist = Math.hypot(dx, dy);
      const step = TRACTOR_SPEED_TILES_PER_MS * dt;
      if (dist <= step) {
        tractor.x = this.tractorTarget.x;
        tractor.y = this.tractorTarget.y;
        const cb = this.tractorTarget.cb;
        this.tractorTarget = null;
        cb?.();
      } else {
        tractor.x += dx / dist * step;
        tractor.y += dy / dist * step;
      }
    }

    this.updateTractorJob(now);

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
    this.hud.update(this.state, this.tractorHudRuntime());
    this.updateDevTools();
    if (now - this.lastSave >= AUTOSAVE_MS) {
      this.lastSave = now;
      this.save();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private buildScene(): RenderScene {
    const scene = sceneFromState(this.state);
    scene.actors = this.operatingTractor ? [] : [{ ...this.playerActor, name: this.state.player.name }];
    const farm = farmOf(this.state);
    scene.farm = {
      lockedTiles: farm.parcels.northOwned ? [] : NEIGHBOR_FIELD_TILES,
      parcelLabel: `${formatMoney(650_000)} · 9 field tiles`,
      tractor: {
        ...farm.equipment.tractor,
        operating: this.operatingTractor,
        working: !!this.tractorJob,
      },
    };
    if (this.hover) {
      scene.hover = { tx: this.hover.tx, ty: this.hover.ty, ok: true };
    }
    return scene;
  }
}
