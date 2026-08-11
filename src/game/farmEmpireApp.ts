import type { ActionResult, GameState } from '../core/types';
import { farmCropDef } from '../core/registry';
import {
  NEIGHBOR_FIELD_TILES, advanceFarmClock, advanceFarmDays, farmOf,
  formatMoney, harvestFarmCrop, plantFarmCrop, purchaseBarnLoftExpansion, purchaseCountyRowCropFieldKit, purchaseNeighborParcel, selectFarmCrop,
  issueCountyReliefSeed, clearWitheredFarmCrop, isFarmCropWithered, farmCropStage, farmCropUnlockInfo, isFarmCropUnlocked,
  syncCashMirror, ownedFarmParcelAt, planParcelWork,
  placePlayerAtTractorDismount, type FarmParcelId, type ParcelWorkKind,
} from '../core/farmBusiness';
import { buyTownSeedsIntoPickup, loadBarnCropToPickup, loadFarmSeedsToPickup, sellPickupCrop, unloadPickupCropToBarn, unloadPickupSeedsToFarm } from '../core/farmPickup';
import { Renderer, sceneFromState, type RenderScene, type SceneActor } from '../render/renderer';
import { isoX, isoY } from '../render/iso';
import { farmLogicalPoint, farmPlotAtWorldPoint, farmWorldPoint } from '../render/farmLayout';
import { farmLandmarks } from '../render/farmLayout';
import { updateFarmCompanion, type FarmCompanionState } from '../core/farmCompanion';
import { advanceTractorMotion, createTractorMotion, resetTractorMotion, type TractorMotion } from '../core/farmTractorMotion';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder } from '../core/farmTownContact';
import { FARM_TOWN_GATE, placePlayerAtTownReturn, townTravelBlockReason } from '../core/townGateway';
import type { TownNpcDef, TownServiceId } from '../data/town.data';
import type { FarmFacing } from '../render/farmSprites';
import {
  TOWN_EXIT, TOWN_SPAWN, cancelTownMovement, townInteractionAt, type TownMoveTarget,
} from '../render/townLayout';
import { FarmHud } from '../ui/farmHud';
import { hideActionMenu, isActionMenuOpen, showActionMenu } from '../ui/actionMenu';
import { closePanel, isPanelOpen } from '../ui/modal';
import { floatText, toast } from '../ui/toast';
import {
  openCountyWorkOrder, openFarmEquipment, openFarmLand, openFarmMarket, openFarmSeedShop, type FarmPanelActions,
} from '../ui/panels/farmPanels';
import { saveToSlot } from '../save/save';

const AUTOSAVE_MS = 15_000;
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

type FarmEmpireMode = 'farm' | 'town';

interface CameraSnapshot { cx: number; cy: number; zoom: number }

function failFarmSidePurchase(): ActionResult { return { ok: false, reason: 'Buy seeds in town with the pickup; farm inventory is not a shop.' }; }
function failFarmSideSale(): ActionResult { return { ok: false, reason: 'Load produce into the pickup and bring it to the County Grain Exchange.' }; }

export class FarmEmpireApp {
  state: GameState;
  private slot: number;
  private renderer: Renderer;
  private hud: FarmHud;
  private playerActor: SceneActor;
  private playerFacing: FarmFacing = 'south';
  private mode: FarmEmpireMode = 'farm';
  private townActor: SceneActor;
  private townFacing: FarmFacing = 'north';
  private townTarget: TownMoveTarget | null = null;
  private townGesture: { npcId: TownNpcDef['id']; until: number } | null = null;
  private farmCamera: CameraSnapshot | null = null;
  private scout: FarmCompanionState;
  private scoutScratchUntil = 0;
  private scoutWaitingForScratch = false;
  private scoutFacing: FarmFacing = 'south';
  private hover: { tx: number; ty: number } | null = null;
  private walkTarget: { x: number; y: number; cb: (() => void) | null } | null = null;
  private operatingTractor = false;
  private operatingPickup = false;
  private pickupAtTown = false;
  private pickupTarget: TractorMoveTarget | null = null;
  private pickupMotion: TractorMotion = createTractorMotion();
  private tractorTarget: TractorMoveTarget | null = null;
  private tractorMotion: TractorMotion = createTractorMotion();
  private tractorJob: TractorJob | null = null;
  private equipmentPanelOpen = false;
  private running = true;
  private raf = 0;
  private lastFrame = 0;
  private lastSave: number;
  private devTools: HTMLElement | null = null;
  private readonly onResize = (): void => { this.renderer.resize(); };

  constructor(canvas: HTMLCanvasElement, state: GameState, slot: number, onBackToTitle: () => void) {
    if (!state.farm) throw new Error('Cannot start Farm Empire without farm state.');
    this.state = state;
    this.slot = slot;
    this.renderer = new Renderer(canvas);
    window.addEventListener('resize', this.onResize);
    this.playerActor = {
      avatar: state.player.avatar,
      x: state.player.px,
      y: state.player.py,
      walking: false,
    };
    this.townActor = { avatar: state.player.avatar, ...TOWN_SPAWN, walking: false };
    const scoutHome = farmLandmarks().scoutHome;
    this.scout = { ...scoutHome, mode: 'home', moving: false };
    this.hud = new FarmHud({
      onSelectCrop: (cropId) => this.dispatch(selectFarmCrop(this.state, cropId)),
      onSeedShop: () => { this.cancelScoutApproach(); openFarmSeedShop(this.state, this.panelActions()); },
      onMarket: () => { this.cancelScoutApproach(); openFarmMarket(this.state, this.panelActions(), 'farm'); },
      onLand: () => { this.cancelScoutApproach(); openFarmLand(this.state, this.panelActions()); },
      onEquipment: () => this.openEquipmentPanel(),
      onReturnFarm: () => this.requestReturnToFarm(),
      onSave: () => {
        this.save();
        toast(this.mode === 'town' ? 'Farm business saved from town.' : 'Farm saved.', 'good');
      },
    });
    this.bindInput(canvas);
    this.renderer.centerOnFarm();
    this.renderer.camera.zoomAt(0.76, window.innerWidth / 2, window.innerHeight / 2);
    this.lastSave = Date.now();
    window.addEventListener('beforeunload', this.save);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    const debug = {
      state: () => this.state,
      mode: () => this.mode,
      tileToScreen: (x: number, y: number) => [
        this.renderer.camera.sx(isoX(farmWorldPoint({ x, y }).x, farmWorldPoint({ x, y }).y)),
        this.renderer.camera.sy(isoY(farmWorldPoint({ x, y }).x, farmWorldPoint({ x, y }).y)),
      ],
      tractorScreen: () => {
        const tractor = farmOf(this.state).equipment.tractor;
        return [
          this.renderer.camera.sx(isoX(farmWorldPoint(tractor).x, farmWorldPoint(tractor).y)),
          this.renderer.camera.sy(isoY(farmWorldPoint(tractor).x, farmWorldPoint(tractor).y)),
        ];
      },
      townTileToScreen: (x: number, y: number) => [
        this.renderer.camera.sx(isoX(x, y)),
        this.renderer.camera.sy(isoY(x, y)),
      ],
      gatewayScreen: () => {
        const gate = farmWorldPoint(FARM_TOWN_GATE);
        return [this.renderer.camera.sx(isoX(gate.x, gate.y)), this.renderer.camera.sy(isoY(gate.x, gate.y))];
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
      enterTown: () => this.enterTown(),
      returnFarm: () => this.returnToFarm(),
    });
    (window as unknown as Record<string, unknown>).__FE__ = debug;
    if (import.meta.env.DEV) this.devTools = this.createDevTools();
    this.loop();
  }

  private panelActions(): FarmPanelActions {
    return {
      context: this.mode,
      pickupPresent: this.mode === 'farm' || this.pickupAtTown,
      buySeeds: (cropId, count) => this.mode === 'town'
        ? buyTownSeedsIntoPickup(this.state, cropId, count, this.pickupAtTown)
        : failFarmSidePurchase(),
      sellCrop: (cropId, count) => this.mode === 'town'
        ? sellPickupCrop(this.state, cropId, count, this.pickupAtTown)
        : failFarmSideSale(),
      loadCrop: (cropId, count) => loadBarnCropToPickup(this.state, cropId, count),
      unloadCrop: (cropId, count) => unloadPickupCropToBarn(this.state, cropId, count),
      loadSeeds: (cropId, count) => loadFarmSeedsToPickup(this.state, cropId, count),
      unloadSeeds: (cropId, count) => unloadPickupSeedsToFarm(this.state, cropId, count),
      buyLand: () => purchaseNeighborParcel(this.state),
      acceptCountyWorkOrder: () => acceptCountyWorkOrder(this.state),
      fulfillCountyWorkOrder: () => fulfillCountyWorkOrder(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' }),
      issueCountyReliefSeed: () => issueCountyReliefSeed(this.state, Date.now()),
      purchaseBarnLoft: () => purchaseBarnLoftExpansion(this.state),
      dispatch: this.dispatch,
    };
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.hud.destroy();
    window.removeEventListener('beforeunload', this.save);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.devTools?.remove();
    delete (window as unknown as Record<string, unknown>).__FE__;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.save();
  };

  save = (): void => {
    if (this.mode === 'town') {
      placePlayerAtTownReturn(this.state);
    } else if (this.operatingTractor) {
      placePlayerAtTractorDismount(this.state);
    } else if (this.operatingPickup) {
      const pickup = farmOf(this.state).pickup;
      this.state.player.px = pickup.x + .7;
      this.state.player.py = pickup.y + .25;
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
        toast(`${farmCropDef(String(event.target)).name} planted.`, 'good');
      } else if (event.type === 'harvest') {
        toast(`Harvested ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} into the barn.`, 'good');
        floatText(this.playerScreenX(), this.playerScreenY() - 45, `+${event.amount ?? 0}`, 'float-good');
      } else if (event.type === 'sell') {
        toast(`Sold ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} for ${formatMoney(Number(event.data ?? 0))}.`, 'good');
      } else if (event.type === 'expand') {
        toast('Neighboring parcel purchased. Nine field sections are now usable.', 'good');
      } else if (event.type === 'toast' && event.target) {
        toast(event.target, 'good');
      }
    }
    this.hud.update(this.state, this.tractorHudRuntime());
  };

  private playerScreenX(): number {
    const tractor = farmOf(this.state).equipment.tractor;
    const pickup = farmOf(this.state).pickup;
    const x = this.operatingTractor ? tractor.x : this.operatingPickup ? pickup.x : this.playerActor.x;
    const y = this.operatingTractor ? tractor.y : this.operatingPickup ? pickup.y : this.playerActor.y;
    const point = farmWorldPoint({ x, y });
    return this.renderer.camera.sx(isoX(point.x, point.y));
  }

  private playerScreenY(): number {
    const tractor = farmOf(this.state).equipment.tractor;
    const pickup = farmOf(this.state).pickup;
    const x = this.operatingTractor ? tractor.x : this.operatingPickup ? pickup.x : this.playerActor.x;
    const y = this.operatingTractor ? tractor.y : this.operatingPickup ? pickup.y : this.playerActor.y;
    const point = farmWorldPoint({ x, y });
    return this.renderer.camera.sy(isoY(point.x, point.y));
  }

  /** Canvas -> fractional world -> authoritative Farm Layout inverse -> logical field. */
  private farmTargetAtScreen(sx: number, sy: number): { tx: number; ty: number } {
    const world = this.renderer.camera.tilePointAt(sx, sy);
    const plot = farmPlotAtWorldPoint(this.state.plots, world)
      ?? farmPlotAtWorldPoint(NEIGHBOR_FIELD_TILES.map((point) => ({ ...point, uid: -1, crop: null })), world);
    if (plot) return { tx: plot.x, ty: plot.y };
    const logical = farmLogicalPoint(world);
    return { tx: Math.round(logical.x), ty: Math.round(logical.y) };
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
      this.hover = this.mode === 'farm' ? this.farmTargetAtScreen(event.clientX, event.clientY) : null;
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
      if (this.mode === 'town') {
        if (isActionMenuOpen()) hideActionMenu();
        else if (isPanelOpen()) closePanel();
        this.cancelTownWalk();
        return;
      }
      if (this.scoutWaitingForScratch) this.cancelScoutApproach();
      else if (this.tractorJob) this.cancelTractorJob();
      else if (this.tractorTarget) {
        this.tractorTarget = null;
        this.tractorMotion = resetTractorMotion(this.tractorMotion);
        toast('Tractor drive cancelled.', 'good');
      } else if (this.pickupTarget) {
        this.pickupTarget = null;
        this.pickupMotion = resetTractorMotion(this.pickupMotion);
        toast('Pickup drive cancelled.', 'good');
      } else if (isActionMenuOpen()) hideActionMenu();
      else if (isPanelOpen()) closePanel();
    });
  }

  private onClick(sx: number, sy: number): void {
    if (isActionMenuOpen()) {
      hideActionMenu();
      return;
    }
    if (this.mode === 'town') {
      this.onClickTown(sx, sy);
      return;
    }
    if (this.tractorJob) {
      toast('A tractor field job is already active. Press Escape to cancel it.', 'bad');
      return;
    }
    // Any new world click replaces an in-progress approach to Scout. A fresh
    // Scout hit below immediately restores the hold for that new approach.
    this.cancelScoutApproach();
    const clickLogical = farmLogicalPoint(this.renderer.camera.tilePointAt(sx, sy));
    if (Math.hypot(clickLogical.x - FARM_TOWN_GATE.x, clickLogical.y - FARM_TOWN_GATE.y) <= 0.75) {
      const blocked = townTravelBlockReason({
        operatingTractor: this.operatingTractor,
        tractorMoving: !!this.tractorTarget,
        tractorJobActive: !!this.tractorJob,
      });
      if (blocked) toast(blocked, 'bad');
      else if (this.operatingPickup) {
        this.drivePickupTo(FARM_TOWN_GATE.x, FARM_TOWN_GATE.y, () => {
          this.operatingPickup = false;
          this.pickupAtTown = true;
          this.enterTown();
        });
      } else this.walkNear(FARM_TOWN_GATE.x, FARM_TOWN_GATE.y, () => this.enterTown());
      return;
    }
    if (!this.operatingTractor && Math.hypot(clickLogical.x - this.scout.x, clickLogical.y - this.scout.y) <= 0.72) {
      this.scoutWaitingForScratch = true;
      this.walkNear(this.scout.x, this.scout.y, () => { this.scoutWaitingForScratch = false; this.openScoutMenu(); });
      return;
    }
    const { tx, ty } = this.farmTargetAtScreen(sx, sy);
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
    const pickup = farm.pickup;
    if (Math.hypot(pickup.x - clickLogical.x, pickup.y - clickLogical.y) <= 0.9) {
      this.togglePickupOperating();
      return;
    }
    if (Math.hypot(tractor.x - tx, tractor.y - ty) <= 0.8) {
      this.openEquipmentPanel();
      return;
    }

    const barn = this.state.placements.find((placement) => placement.defId === 'bld_storage');
    if (barn && tx >= barn.x && tx < barn.x + 2 && ty >= barn.y && ty < barn.y + 2) {
      openFarmMarket(this.state, this.panelActions(), 'farm');
      return;
    }

    if (plot) {
      this.walkNear(tx, ty, () => this.openPlotMenu(plot.uid, sx, sy));
      return;
    }
    if (this.operatingTractor) this.driveTractorTo(tx, ty);
    else if (this.operatingPickup) this.drivePickupTo(tx, ty);
    else this.walkNear(tx, ty, null);
  }

  private onClickTown(sx: number, sy: number): void {
    const point = this.renderer.camera.tilePointAt(sx, sy);
    const interaction = townInteractionAt(point);
    if (interaction.kind === 'npc') {
      this.walkTownNear(interaction.npc.x, interaction.npc.y, () => {
        this.townGesture = { npcId: interaction.npc.id, until: Date.now() + 1_200 };
        if (interaction.npc.id === 'mae-carter') this.openCountyWorkOrder();
        else this.openTownService(interaction.service, interaction.npc.name, interaction.npc.x, interaction.npc.y);
      });
    } else if (interaction.kind === 'building') {
      this.walkTownNear(interaction.building.door.x, interaction.building.door.y, () => {
        this.openTownService(interaction.service, interaction.building.name, interaction.building.door.x, interaction.building.door.y);
      });
    } else if (interaction.kind === 'exit') {
      this.requestReturnToFarm();
    } else if (interaction.kind === 'ground') {
      this.townTarget = { ...interaction.point, cb: null };
    }
  }

  private openTownService(service: TownServiceId, title: string, x: number, y: number): void {
    if (service === 'seed-supplier') {
      openFarmSeedShop(this.state, this.panelActions());
      return;
    }
    if (service === 'commodity-market') {
      openFarmMarket(this.state, this.panelActions(), 'town');
      return;
    }
    const screenX = this.renderer.camera.sx(isoX(x, y));
    const screenY = this.renderer.camera.sy(isoY(x, y));
    showActionMenu(screenX, screenY, title, [
      { label: 'Land Records', onClick: () => openFarmLand(this.state, this.panelActions()) },
      {
        label: 'Equipment Desk',
        onClick: () => openFarmEquipment(this.state, { context: 'town', onPurchaseKit: () => purchaseCountyRowCropFieldKit(this.state), dispatch: this.dispatch, onClose: () => {} }),
      },
      { label: 'County Work Order', onClick: () => this.openCountyWorkOrder() },
    ]);
  }

  private openCountyWorkOrder(): void {
    this.dispatch(offerCountyWorkOrder(this.state));
    openCountyWorkOrder(this.state, this.panelActions());
  }

  private enterTown(): void {
    if (this.mode === 'town') return;
    const blocked = townTravelBlockReason({
      operatingTractor: this.operatingTractor,
      tractorMoving: !!this.tractorTarget,
      tractorJobActive: !!this.tractorJob,
    });
    if (blocked) { toast(blocked, 'bad'); return; }
    const returnPoint = placePlayerAtTownReturn(this.state);
    this.playerActor.x = returnPoint.x; this.playerActor.y = returnPoint.y; this.playerActor.walking = false;
    this.walkTarget = null; this.hover = null; this.cancelScoutApproach();
    this.farmCamera = { cx: this.renderer.camera.cx, cy: this.renderer.camera.cy, zoom: this.renderer.camera.zoom };
    this.townActor = { avatar: this.state.player.avatar, ...TOWN_SPAWN, walking: false };
    this.townFacing = 'north'; this.townTarget = null; this.townGesture = null; this.mode = 'town';
    this.renderer.centerOnTown(); this.hud.setMode('town');
    toast('Welcome to the County Service Center.', 'good');
  }

  private requestReturnToFarm(): void {
    if (this.mode !== 'town') return;
    this.walkTownNear(TOWN_EXIT.x, TOWN_EXIT.y, () => this.returnToFarm());
  }

  private cancelTownWalk(): boolean {
    const cancellation = cancelTownMovement(this.townTarget);
    if (!cancellation.cancelled) return false;
    this.townTarget = cancellation.target;
    this.townActor.walking = cancellation.walking;
    toast('Town walk cancelled.', 'good');
    return true;
  }

  private returnToFarm(): void {
    if (this.mode !== 'town') return;
    hideActionMenu(); if (isPanelOpen()) closePanel();
    this.townTarget = null; this.townActor.walking = false; this.townGesture = null; this.mode = 'farm';
    const returnPoint = placePlayerAtTownReturn(this.state);
    this.playerActor.x = returnPoint.x; this.playerActor.y = returnPoint.y; this.playerActor.walking = false;
    if (this.farmCamera) {
      this.renderer.camera.cx = this.farmCamera.cx; this.renderer.camera.cy = this.farmCamera.cy; this.renderer.camera.zoom = this.farmCamera.zoom;
    } else this.renderer.centerOnFarm();
    this.farmCamera = null; this.hud.setMode('farm');
    if (this.pickupAtTown) {
      const pickup = farmOf(this.state).pickup;
      pickup.x = FARM_TOWN_GATE.x; pickup.y = FARM_TOWN_GATE.y;
      this.pickupAtTown = false;
    }
    toast('Back at the farm.', 'good');
  }

  private openEquipmentPanel(): void {
    this.cancelScoutApproach();
    this.equipmentPanelOpen = true;
    openFarmEquipment(this.state, {
      context: 'farm',
      operating: this.operatingTractor,
      jobActive: !!this.tractorJob || !!this.tractorTarget,
      onToggleOperating: () => this.toggleTractorOperating(),
      pickupOperating: this.operatingPickup,
      onTogglePickup: () => this.togglePickupOperating(),
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

  private cancelScoutApproach(): void {
    if (!this.scoutWaitingForScratch) return;
    this.scoutWaitingForScratch = false;
    this.walkTarget = null;
    this.playerActor.walking = false;
  }

  private toggleTractorOperating(): void {
    const tractor = farmOf(this.state).equipment.tractor;
    if (!this.operatingTractor && this.operatingPickup) {
      toast('Exit the pickup before operating the tractor.', 'bad');
      return;
    }
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
      this.tractorMotion = resetTractorMotion(this.tractorMotion);
      this.playerActor.x = dismount.x;
      this.playerActor.y = dismount.y;
      this.playerActor.walking = false;
      toast('Exited the old tractor.', 'good');
    } else {
      this.walkTarget = null;
      this.playerActor.walking = false;
      this.cancelScoutApproach();
      this.operatingTractor = true;
      this.tractorMotion = resetTractorMotion(this.tractorMotion);
      toast('Operating the old tractor. Click ground to drive or a field parcel for batch work.', 'good');
    }
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private togglePickupOperating(): void {
    if (this.operatingTractor || this.tractorJob || this.tractorTarget) {
      toast('Exit the tractor before operating the pickup.', 'bad');
      return;
    }
    const pickup = farmOf(this.state).pickup;
    if (this.operatingPickup) {
      this.operatingPickup = false;
      this.pickupTarget = null;
      this.pickupMotion = resetTractorMotion(this.pickupMotion);
      this.playerActor.x = pickup.x + .7;
      this.playerActor.y = pickup.y + .25;
      toast('Exited the old pickup.', 'good');
    } else {
      this.operatingPickup = true;
      this.walkTarget = null;
      this.playerActor.walking = false;
      toast('Operating the old pickup. Drive to the farm gate for County services.', 'good');
    }
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private openScoutMenu(): void {
    const point = farmWorldPoint(this.scout);
    const sx = this.renderer.camera.sx(isoX(point.x, point.y));
    const sy = this.renderer.camera.sy(isoY(point.x, point.y));
    showActionMenu(sx, sy, 'Scout · farm dog', [{
      label: 'Give Scout scratches',
      onClick: () => {
        this.scoutScratchUntil = Date.now() + 1_200;
        toast('Scout wags and leans into the scratches.', 'good');
      },
    }]);
  }

  private driveTractorTo(x: number, y: number): void {
    if (!this.operatingTractor || this.tractorJob) return;
    this.tractorTarget = {
      x,
      y,
      cb: () => toast('Tractor parked.', 'good'),
    };
  }

  private drivePickupTo(x: number, y: number, cb: (() => void) | null = () => toast('Pickup parked.', 'good')): void {
    if (!this.operatingPickup || this.pickupAtTown) return;
    this.pickupTarget = { x, y, cb };
  }

  private openTractorParcelMenu(parcelId: FarmParcelId, tx: number, ty: number, sx: number, sy: number): void {
    const plan = planParcelWork(this.state, parcelId, Date.now(), farmOf(this.state).selectedCropId);
    const farm = farmOf(this.state);
    const crop = farmCropDef(farm.selectedCropId);
    const cropUnlock = farmCropUnlockInfo(this.state, crop.id);
    const seedCount = farm.seeds[crop.id] ?? 0;
    const parcelName = parcelId === 'starter' ? 'Starter parcel' : 'Neighboring parcel';
    showActionMenu(sx, sy, `${parcelName} · 3×3 tractor work`, [
      {
        label: cropUnlock.unlocked
          ? `Plant ${crop.name} on ${plan.plantPlotUids.length} empty field section${plan.plantPlotUids.length === 1 ? '' : 's'} (${seedCount} seeds)`
          : `${crop.name} locked: ${cropUnlock.requirement}`,
        icon: `icon:seed_${crop.id.replace('crop_', '')}`,
        disabled: !cropUnlock.unlocked || plan.plantPlotUids.length === 0,
        onClick: () => this.startTractorJob('plant', parcelId, plan.plantPlotUids, crop.id),
      },
      {
        label: `Harvest ${plan.harvestPlotUids.length} ready field section${plan.harvestPlotUids.length === 1 ? '' : 's'} into barn`,
        icon: 'fx:ready',
        disabled: plan.harvestPlotUids.length === 0,
        onClick: () => this.startTractorJob('harvest', parcelId, plan.harvestPlotUids),
      },
      {
        label: 'Drive to selected field section',
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
      showActionMenu(sx, sy, 'Empty field section', [
        {
          label: `Plant ${def.name} (${count} seed${count === 1 ? '' : 's'})`,
          icon: `icon:seed_${def.id.replace('crop_', '')}`,
          onClick: () => this.dispatch(plantFarmCrop(this.state, plotUid, def.id, Date.now(), 'manual')),
        },
        { label: 'Open seed supplier', onClick: () => openFarmSeedShop(this.state, this.panelActions()) },
      ]);
      return;
    }
    const def = farmCropDef(plot.crop.defId);
    const now = Date.now();
    const stage = farmCropStage(plot.crop, now);
    if (isFarmCropWithered(plot.crop, now)) {
      showActionMenu(sx, sy, `${def.name} · Withered`, [{
        label: 'Clear withered section (no refund)', icon: 'fx:hungry',
        onClick: () => this.dispatch(clearWitheredFarmCrop(this.state, plotUid, Date.now())),
      }]);
      return;
    }
    if (stage === 'ready') {
      showActionMenu(sx, sy, `${def.name} · Ready`, [{
        label: 'Harvest into barn', icon: 'fx:ready',
        onClick: () => this.dispatch(harvestFarmCrop(this.state, plotUid, Date.now(), 'manual')),
      }]);
    } else {
      showActionMenu(sx, sy, `${def.name} · ${stage}`, [{
        label: `Growing · ${Math.max(1, Math.ceil((plot.crop.plantedAt + def.growMs - plot.crop.wateredBonusMs - now) / 1000))}s remaining`,
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
      toast(`No eligible field sections for tractor ${kind}ing.`, 'bad');
      return;
    }
    if (kind === 'plant' && cropId && !isFarmCropUnlocked(this.state, cropId)) {
      toast(farmCropUnlockInfo(this.state, cropId).requirement, 'bad');
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
    toast(`${label} across ${targetPlotUids.length} field section${targetPlotUids.length === 1 ? '' : 's'}.`, 'good');
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
      job.lastFailure = 'A planned field section was unavailable.';
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
      ? plantFarmCrop(this.state, plotUid, String(job.cropId), Date.now(), 'operatedTractor')
      : harvestFarmCrop(this.state, plotUid, Date.now(), 'operatedTractor');
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
      job.lastFailure = result.reason || 'The field section was no longer eligible.';
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
    this.tractorMotion = resetTractorMotion(this.tractorMotion);
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
    this.tractorMotion = resetTractorMotion(this.tractorMotion);
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
        statusText: `${job.kind === 'plant' ? 'Planting' : 'Harvesting'}${cropLabel} · ${job.completed}/${total} completed${job.skipped ? ` · ${job.skipped} skipped` : ''} · section ${current}/${total}`,
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

  private walkTownNear(tx: number, ty: number, cb: (() => void) | null): void {
    const dist = Math.hypot(this.townActor.x - tx, this.townActor.y - ty);
    if (dist <= 1.05) { cb?.(); return; }
    const dx = this.townActor.x - tx; const dy = this.townActor.y - ty;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    this.townTarget = { x: tx + dx / len * .85, y: ty + dy / len * .85, cb };
  }

  private matureAll(): void {
    const now = Date.now();
    for (const plot of this.state.plots) {
      if (!plot.crop) continue;
      plot.crop.plantedAt = now - farmCropDef(plot.crop.defId).growMs - 1_000;
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
      const projected = farmWorldPoint(plot);
      const x = this.renderer.camera.sx(isoX(projected.x, projected.y));
      const y = this.renderer.camera.sy(isoY(projected.x, projected.y));
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
    const projected = farmWorldPoint(plot);
    point.dataset.screenX = String(Math.round(this.renderer.camera.sx(isoX(projected.x, projected.y))));
    point.dataset.screenY = String(Math.round(this.renderer.camera.sy(isoY(projected.x, projected.y))));
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = Date.now();
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16;
    this.lastFrame = now;
    advanceFarmClock(this.state, now);

    if (this.mode === 'farm' && this.tractorTarget) {
      const tractor = farmOf(this.state).equipment.tractor;
      const motionStep = advanceTractorMotion(tractor, this.tractorTarget, this.tractorMotion, dt);
      tractor.x = motionStep.position.x;
      tractor.y = motionStep.position.y;
      this.tractorMotion = motionStep.motion;
      if (motionStep.arrived) {
        const cb = this.tractorTarget.cb;
        this.tractorTarget = null;
        cb?.();
      }
    }
    if (this.mode === 'farm' && this.pickupTarget) {
      const pickup = farmOf(this.state).pickup;
      const motionStep = advanceTractorMotion(pickup, this.pickupTarget, this.pickupMotion, dt);
      pickup.x = motionStep.position.x; pickup.y = motionStep.position.y;
      this.pickupMotion = motionStep.motion;
      if (motionStep.arrived) {
        const cb = this.pickupTarget.cb; this.pickupTarget = null; cb?.();
      }
    }

    if (this.mode === 'farm') this.updateTractorJob(now);

    if (this.mode === 'farm' && this.walkTarget) {
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
        this.playerFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      }
    }

    if (this.mode === 'town' && this.townTarget) {
      const speed = 4.4 / 1_000;
      const dx = this.townTarget.x - this.townActor.x;
      const dy = this.townTarget.y - this.townActor.y;
      const dist = Math.hypot(dx, dy);
      const step = speed * dt;
      if (dist <= step) {
        this.townActor.x = this.townTarget.x; this.townActor.y = this.townTarget.y;
        const cb = this.townTarget.cb; this.townTarget = null; this.townActor.walking = false; cb?.();
      } else {
        this.townActor.x += dx / dist * step; this.townActor.y += dy / dist * step; this.townActor.walking = true;
        this.townFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      }
    }

    const scoutHome = farmLandmarks().scoutHome;
    const scoutBefore = this.scout;
    this.scout = this.scoutWaitingForScratch && !this.operatingTractor && !this.operatingPickup && this.mode === 'farm'
      ? { ...this.scout, moving: false }
      : updateFarmCompanion(this.scout, this.playerActor, scoutHome, dt, this.mode === 'town' || this.operatingTractor || this.operatingPickup || !!this.tractorJob);
    const scoutDx = this.scout.x - scoutBefore.x; const scoutDy = this.scout.y - scoutBefore.y;
    if (Math.hypot(scoutDx, scoutDy) > 0.0001) this.scoutFacing = Math.abs(scoutDx) >= Math.abs(scoutDy) ? (scoutDx > 0 ? 'east' : 'west') : (scoutDy > 0 ? 'south' : 'north');

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
    const farm = farmOf(this.state);
    if (this.mode === 'town') {
      scene.town = {
        actor: {
          avatar: this.state.player.avatar,
          x: this.townActor.x,
          y: this.townActor.y,
          walking: this.townActor.walking,
          facing: this.townFacing,
          name: this.state.player.name,
        },
        clockMinute: farm.clock.minute,
        gesturingNpcId: this.townGesture?.npcId ?? null,
        gestureUntil: this.townGesture?.until ?? 0,
        pickup: this.pickupAtTown ? { x: 14, y: 12 } : undefined,
      };
      return scene;
    }
    scene.actors = this.operatingTractor || this.operatingPickup ? [] : [{ ...this.playerActor, name: this.state.player.name, facing: this.playerFacing }];
    scene.farm = {
      lockedTiles: farm.parcels.northOwned ? [] : NEIGHBOR_FIELD_TILES,
      parcelLabel: `${formatMoney(650_000)} · 9 field sections`,
      tractor: {
        ...farm.equipment.tractor,
        operating: this.operatingTractor,
        working: !!this.tractorJob,
        moving: !!this.tractorTarget,
        headingX: this.tractorMotion.headingX,
        headingY: this.tractorMotion.headingY,
        steer: this.tractorMotion.steer,
        wheelPhase: this.tractorMotion.wheelPhase,
      },
      pickup: {
        name: farm.pickup.name,
        x: farm.pickup.x,
        y: farm.pickup.y,
        operating: this.operatingPickup,
        moving: !!this.pickupTarget,
        headingX: this.pickupMotion.headingX,
        headingY: this.pickupMotion.headingY,
        steer: this.pickupMotion.steer,
        wheelPhase: this.pickupMotion.wheelPhase,
      },
      scout: { ...this.scout, facing: this.scoutFacing, scratching: Date.now() < this.scoutScratchUntil },
      barnLoftOwned: farm.equipment.barnLoftExpansionOwned,
      clockMinute: farm.clock.minute,
    };
    if (this.hover) {
      scene.hover = { tx: this.hover.tx, ty: this.hover.ty, ok: true };
    }
    return scene;
  }
}
