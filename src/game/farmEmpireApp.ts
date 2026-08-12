import type { ActionResult, GameState } from '../core/types';
import { farmCropDef } from '../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, NEIGHBOR_FIELD_TILES, advanceFarmClock, advanceFarmDays, farmOf,
  formatMoney, harvestFarmCrop, plantFarmCrop, purchaseBarnLoftExpansion, purchaseCountyRowCropFieldKit, purchaseNeighborParcel, selectFarmCrop,
  issueCountyReliefSeed, clearWitheredFarmCrop, isFarmCropWithered, farmCropStage, farmCropUnlockInfo, isFarmCropUnlocked,
  syncCashMirror, ownedFarmParcelAt, planParcelWork, farmFieldCondition, tillFarmField, waterFarmCrop,
  placePlayerAtTractorDismount, restoreOldTractor, storageUsed, type FarmParcelId, type ParcelWorkKind,
} from '../core/farmBusiness';
import { farmParcelDef, farmParcelSectionCount } from '../core/farmParcels';
import { buyTownSeedsIntoPickup, loadBarnCropToPickup, loadFarmSeedsToPickup, pickupCargoUsed, pickupIsAtCargoPad, sellPickupCrop, unloadPickupCropToBarn, unloadPickupSeedsToFarm } from '../core/farmPickup';
import { pickupPositionForSave } from '../core/farmPickupData';
import { Renderer, sceneFromState, type RenderScene, type SceneActor } from '../render/renderer';
import { isoX, isoY } from '../render/iso';
import { farmhousePresentationTier, farmLogicalPoint, farmPlotAtWorldPoint, farmWorldPoint, farmLandmarks, pointInFarmBounds } from '../render/farmLayout';
import { updateFarmCompanion, type FarmCompanionState } from '../core/farmCompanion';
import { recordFarmStat } from '../core/farmKnowledge';
import { FarmSoundscape, type FarmAudioSettings } from '../audio/farmSoundscape';
import {
  MANUAL_FIELD_ACTION_LABELS, createManualFieldAction, manualFieldActionComplete, manualFieldActionProgress,
  manualFieldSelectionPlotUids,
  type ManualFieldAction, type ManualFieldActionKind, type ManualFieldSelectionScope,
} from '../core/farmManualAction';
import { advanceTractorMotion, createTractorMotion, resetTractorMotion, type TractorMotion } from '../core/farmTractorMotion';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder } from '../core/farmTownContact';
import { acceptCountyFreightOffer, countyFreightBoardState, countyFreightProgress, fulfillCountyFreightContract } from '../core/farmCountyFreight';
import { FARM_TOWN_GATE, farmTownRoadRouteFrom, placePlayerAtTownReturn, townTravelBlockReason } from '../core/townGateway';
import type { TownNpcDef, TownServiceId } from '../data/town.data';
import type { FarmFacing } from '../render/farmSprites';
import { farmInteractionAtWorldPoint, type FarmInteractionTarget } from '../render/farmInteractions';
import {
  TOWN_EXIT, TOWN_PICKUP_PARKING, TOWN_SPAWN, cancelTownMovement, townInteractionAt, townPickupHit, type TownMoveTarget,
} from '../render/townLayout';
import { FarmHud } from '../ui/farmHud';
import { hideActionMenu, isActionMenuOpen, showActionMenu } from '../ui/actionMenu';
import { closePanel, isPanelOpen, openPanel } from '../ui/modal';
import { floatText, toast } from '../ui/toast';
import {
  openCountyWorkOrder, openFarmEquipment, openFarmLand, openFarmMarket, openFarmSeedShop, type FarmPanelActions,
} from '../ui/panels/farmPanels';
import { openFarmOffice } from '../ui/panels/farmOffice';
import { saveToSlot } from '../save/save';
import { h } from '../ui/dom';

const AUTOSAVE_MS = 15_000;
const FIELD_ACTION_PAUSE_MS = 260;
const MANUAL_ACTION_VERBS: Readonly<Record<ManualFieldActionKind, string>> = {
  prepare: 'Prepare',
  rework: 'Rework',
  plant: 'Plant',
  water: 'Water',
  harvest: 'Harvest',
  clear: 'Clear',
};

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

interface RunningManualFieldAction extends ManualFieldAction {
  apply: () => ActionResult;
}

interface ManualFieldJob {
  kind: ManualFieldActionKind;
  scope: Exclude<ManualFieldSelectionScope, 'section'>;
  cropId?: string;
  targetPlotUids: number[];
  nextIndex: number;
  completed: number;
  skipped: number;
  lastFailure?: string;
}

type FarmEmpireMode = 'farm' | 'town';

interface CameraSnapshot { cx: number; cy: number; zoom: number; viewW: number; viewH: number }

function failFarmSidePurchase(): ActionResult { return { ok: false, reason: 'Buy seeds in town with the pickup; farm inventory is not a shop.' }; }
function failFarmSideSale(): ActionResult { return { ok: false, reason: 'Load produce into the pickup and bring it to the County Grain Exchange.' }; }

export class FarmEmpireApp {
  state: GameState;
  private slot: number;
  private renderer: Renderer;
  private hud: FarmHud;
  private farmAudio: FarmSoundscape;
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
  private hover: FarmInteractionTarget | null = null;
  private townHover: { label: string; x: number; y: number } | null = null;
  private walkTarget: { x: number; y: number; cb: (() => void) | null } | null = null;
  private operatingTractor = false;
  private operatingPickup = false;
  private pickupAtTown = false;
  private pickupTarget: TractorMoveTarget | null = null;
  private pickupMotion: TractorMotion = createTractorMotion();
  private tractorTarget: TractorMoveTarget | null = null;
  private tractorMotion: TractorMotion = createTractorMotion();
  private tractorJob: TractorJob | null = null;
  private manualFieldAction: RunningManualFieldAction | null = null;
  private manualFieldJob: ManualFieldJob | null = null;
  private equipmentPanelOpen = false;
  private running = true;
  private raf = 0;
  private lastFrame = 0;
  private lastSave: number;
  private simulationOffsetMs = 0;
  private devTools: HTMLElement | null = null;
  private inputCleanup: (() => void) | null = null;
  private readonly onResize = (): void => {
    this.renderer.resize();
    // A live resize changes the active scene's fit, so discard stale viewport
    // framing instead of merely clamping a desktop zoom into a compact view.
    if (this.mode === 'town') this.renderer.centerOnTown(); else this.renderer.centerOnFarm();
  };

  constructor(canvas: HTMLCanvasElement, state: GameState, slot: number, onBackToTitle: () => void) {
    if (!state.farm) throw new Error('Cannot start Farm Empire without farm state.');
    this.state = state;
    this.slot = slot;
    this.renderer = new Renderer(canvas);
    let audioStorage: Storage | null = null;
    try { audioStorage = window.localStorage; } catch { /* preferences stay in memory */ }
    this.farmAudio = new FarmSoundscape(audioStorage);
    this.farmAudio.ensureStarted();
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
      onMarket: () => { if (this.manualActionBlocksUi()) return; this.cancelScoutApproach(); openFarmMarket(this.state, this.panelActions(), 'farm'); },
      onFarmbook: () => { if (!this.manualActionBlocksUi()) this.openFarmhouseOffice(); },
      onEquipment: () => { if (!this.manualActionBlocksUi()) this.openEquipmentPanel(); },
      onReturnFarm: () => this.requestReturnToFarm(),
      onSave: () => {
        this.save();
        toast(this.mode === 'town' ? 'Farm business saved from town.' : 'Farm saved.', 'good');
      },
      onMenu: () => { if (!this.manualActionBlocksUi()) this.openGameMenu(onBackToTitle); },
    });
    this.bindInput(canvas);
    this.renderer.centerOnFarm();
    this.renderer.clampFarmCamera();
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
    const browserHooks = window as unknown as Record<string, unknown>;
    browserHooks.render_game_to_text = () => this.renderGameToText();
    browserHooks.advanceTime = (ms: number) => this.advanceTestTime(ms);
    if (import.meta.env.DEV) this.devTools = this.createDevTools();
    this.loop();
  }

  private panelActions(): FarmPanelActions {
    return {
      context: this.mode,
      pickupPresent: this.mode === 'farm' || this.pickupAtTown,
      cargoAtPad: this.mode === 'farm' && pickupIsAtCargoPad(this.state),
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
      acceptCountyFreight: (offerId) => acceptCountyFreightOffer(this.state, offerId),
      fulfillCountyFreight: () => fulfillCountyFreightContract(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' }),
      issueCountyReliefSeed: () => issueCountyReliefSeed(this.state, this.gameNow()),
      purchaseBarnLoft: () => purchaseBarnLoftExpansion(this.state),
      dispatch: this.dispatch,
    };
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.hud.destroy();
    this.farmAudio.destroy();
    window.removeEventListener('beforeunload', this.save);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.inputCleanup?.(); this.inputCleanup = null;
    this.devTools?.remove();
    const browserHooks = window as unknown as Record<string, unknown>;
    delete browserHooks.__FE__;
    delete browserHooks.render_game_to_text;
    delete browserHooks.advanceTime;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) this.save();
  };

  save = (): void => {
    if (this.mode === 'town') {
      placePlayerAtTownReturn(this.state);
      const position = pickupPositionForSave(this.pickupAtTown, farmOf(this.state).pickup);
      farmOf(this.state).pickup.x = position.x; farmOf(this.state).pickup.y = position.y;
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
      this.farmAudio.playTransaction('error');
      toast(result.reason || 'That action cannot be completed.', 'bad');
      return;
    }
    for (const event of result.events ?? []) {
      if (event.type === 'plant') {
        const crop = farmCropDef(String(event.target)).name;
        const established = !!(event.data as { established?: boolean } | undefined)?.established;
        toast(established ? `${crop} planted and established.` : `${crop} planted. Water this section to start growth.`, 'good');
      } else if (event.type === 'water') {
        toast(`${farmCropDef(String(event.target)).name} watered. Growth has started.`, 'good');
      } else if (event.type === 'harvest') {
        toast(`Harvested ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} into the barn.`, 'good');
        floatText(this.playerScreenX(), this.playerScreenY() - 45, `+${event.amount ?? 0}`, 'float-good');
      } else if (event.type === 'sell') {
        this.farmAudio.playTransaction('sell');
        toast(`Sold ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} for ${formatMoney(Number(event.data ?? 0))}.`, 'good');
      } else if (event.type === 'expand') {
        this.farmAudio.playTransaction('expand');
        toast(`Neighboring acreage purchased. ${event.amount ?? farmParcelSectionCount('north')} field sections are usable, and the farmhouse has expanded.`, 'good');
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
  private farmTargetAtScreen(sx: number, sy: number): { tx: number; ty: number } | null {
    const world = this.renderer.camera.tilePointAt(sx, sy);
    if (!pointInFarmBounds(world)) return null;
    const plot = farmPlotAtWorldPoint(this.state.plots, world)
      ?? farmPlotAtWorldPoint(NEIGHBOR_FIELD_TILES.map((point) => ({ ...point, uid: -1, crop: null })), world);
    if (plot) return { tx: plot.x, ty: plot.y };
    const logical = farmLogicalPoint(world);
    return { tx: Math.round(logical.x), ty: Math.round(logical.y) };
  }

  private farmInteractionAtScreen(sx: number, sy: number): FarmInteractionTarget | null {
    const world = this.renderer.camera.tilePointAt(sx, sy);
    if (!pointInFarmBounds(world)) return null;
    const farm = farmOf(this.state);
    return farmInteractionAtWorldPoint(this.state, world, {
      pickup: farm.pickup,
      tractor: farm.equipment.tractor,
      scout: this.scout,
      now: this.gameNow(),
    });
  }

  private townInteractionHintAtScreen(sx: number, sy: number): { label: string; x: number; y: number } | null {
    const point = this.renderer.camera.tilePointAt(sx, sy);
    if (townPickupHit(point, this.pickupAtTown)) return { label: `Old Pickup · Cargo ${pickupCargoUsed(this.state)} / 72`, ...TOWN_PICKUP_PARKING };
    const interaction = townInteractionAt(point);
    if (interaction.kind === 'npc') return { label: `${interaction.npc.name} · ${interaction.npc.role}`, x: interaction.npc.x, y: interaction.npc.y };
    if (interaction.kind === 'building') return { label: interaction.building.name, ...interaction.building.door };
    if (interaction.kind === 'exit') return { label: 'Return to Farm', ...TOWN_EXIT };
    return null;
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    let downX = 0;
    let downY = 0;
    let dragging = false;
    let panning = false;
    const onPointerDown = (event: PointerEvent): void => {
      this.farmAudio.ensureStarted();
      downX = event.clientX;
      downY = event.clientY;
      dragging = true;
      panning = false;
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (dragging) {
        const dx = event.clientX - downX;
        const dy = event.clientY - downY;
        if (panning || Math.hypot(dx, dy) > 6) {
          panning = true;
          this.renderer.camera.pan(event.movementX, event.movementY);
          if (this.mode === 'town') this.renderer.clampTownCamera(); else this.renderer.clampFarmCamera();
        }
      }
      this.hover = this.mode === 'farm' ? this.farmInteractionAtScreen(event.clientX, event.clientY) : null;
      this.townHover = this.mode === 'town' ? this.townInteractionHintAtScreen(event.clientX, event.clientY) : null;
    };
    const onPointerUp = (event: PointerEvent): void => {
      dragging = false;
      if (panning) {
        panning = false;
        return;
      }
      this.onClick(event.clientX, event.clientY);
    };
    const onPointerLeave = (): void => {
      dragging = false;
      this.hover = null;
      this.townHover = null;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      this.renderer.camera.zoomAt(event.deltaY < 0 ? 1.12 : 0.9, event.clientX, event.clientY);
      if (this.mode === 'town') this.renderer.clampTownCamera(); else this.renderer.clampFarmCamera();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (this.mode === 'town') {
        if (isActionMenuOpen()) hideActionMenu();
        else if (isPanelOpen()) closePanel();
        this.cancelTownWalk();
        return;
      }
      if (this.manualFieldJob) this.cancelManualFieldJob();
      else if (this.manualFieldAction) this.cancelManualFieldAction();
      else if (this.scoutWaitingForScratch) this.cancelScoutApproach();
      else if (this.tractorJob) this.cancelTractorJob();
      else if (this.tractorTarget) {
        this.tractorTarget = null;
        this.tractorMotion = resetTractorMotion(this.tractorMotion);
        toast('Tractor drive cancelled.', 'good');
      } else if (this.pickupTarget) {
        this.pickupTarget = null;
        this.pickupMotion = resetTractorMotion(this.pickupMotion);
        toast('Pickup drive cancelled.', 'good');
      } else if (this.walkTarget) {
        this.walkTarget = null;
        this.playerActor.walking = false;
        toast('Walk cancelled.', 'good');
      } else if (isActionMenuOpen()) hideActionMenu();
      else if (isPanelOpen()) closePanel();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    this.inputCleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
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
    if (this.manualFieldJob || this.manualFieldAction) {
      const kind = this.manualFieldJob?.kind ?? this.manualFieldAction!.kind;
      toast(`${MANUAL_FIELD_ACTION_LABELS[kind]} in progress. Press Escape to cancel.`, 'bad');
      return;
    }
    if (this.tractorJob) {
      toast('A tractor field job is already active. Press Escape to cancel it.', 'bad');
      return;
    }
    // Any new world click replaces an in-progress approach to Scout. A fresh
    // Scout hit below immediately restores the hold for that new approach.
    this.cancelScoutApproach();
    const worldPoint = this.renderer.camera.tilePointAt(sx, sy);
    if (!pointInFarmBounds(worldPoint)) return;
    const farm = farmOf(this.state);
    const interaction = farmInteractionAtWorldPoint(this.state, worldPoint, {
      pickup: farm.pickup,
      tractor: farm.equipment.tractor,
      scout: this.scout,
      now: this.gameNow(),
    });
    if (interaction?.kind === 'pickup') {
      if (this.operatingPickup) this.togglePickupOperating(); else this.openPickupPanel();
      return;
    }
    if (interaction?.kind === 'tractor') { this.openEquipmentPanel(); return; }
    if (interaction?.kind === 'scout' || interaction?.kind === 'doghouse') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to visit Scout.', 'bad'); return; }
      this.scoutWaitingForScratch = true;
      this.walkNear(this.scout.x, this.scout.y, () => { this.scoutWaitingForScratch = false; this.openScoutMenu(); });
      return;
    }
    if (interaction?.kind === 'farmhouse') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to use the farmhouse office.', 'bad'); return; }
      this.walkNear(interaction.point.x, interaction.point.y, () => this.openFarmhouseOffice());
      return;
    }
    if (interaction?.kind === 'pump') {
      showActionMenu(sx, sy, 'Hand Pump', [
        { label: 'Water new seedlings from their field menu', disabled: true, onClick: () => {} },
        { label: 'Open Farmbook', onClick: () => this.openFarmhouseOffice() },
      ]);
      return;
    }
    if (interaction?.kind === 'town-gate') { this.openFarmGateMenu(sx, sy); return; }
    if (interaction?.kind === 'locked-acreage') { openFarmLand(this.state, this.panelActions()); return; }
    if (interaction?.kind === 'barn') {
      if (this.operatingTractor) { toast('Exit the tractor to manage barn cargo.', 'bad'); return; }
      if (this.operatingPickup) {
        const pad = farmLandmarks().cargoPad;
        this.drivePickupTo(pad.x, pad.y, () => { toast('Pickup parked at the cargo pad.', 'good'); this.openPickupPanel(); });
      } else this.walkNear(interaction.point.x, interaction.point.y, () => openFarmMarket(this.state, this.panelActions(), 'farm'));
      return;
    }
    if (interaction?.kind === 'field' && interaction.plotUid !== undefined) {
      if (this.operatingTractor) {
        const parcelId = ownedFarmParcelAt(this.state, interaction.point.x, interaction.point.y);
        if (parcelId) this.openTractorParcelMenu(parcelId, interaction.point.x, interaction.point.y, sx, sy);
      } else if (this.operatingPickup) this.drivePickupTo(interaction.point.x, interaction.point.y);
      else this.walkNear(interaction.point.x, interaction.point.y, () => this.openPlotMenu(interaction.plotUid!, sx, sy));
      return;
    }
    const target = this.farmTargetAtScreen(sx, sy);
    if (!target) return;
    const { tx, ty } = target;
    if (this.operatingTractor) this.driveTractorTo(tx, ty);
    else if (this.operatingPickup) this.drivePickupTo(tx, ty);
    else this.walkNear(tx, ty, null);
  }

  private openFarmGateMenu(sx: number, sy: number): void {
    const farm = farmOf(this.state);
    const blocked = townTravelBlockReason({
      operatingTractor: this.operatingTractor,
      tractorMoving: !!this.tractorTarget,
      tractorJobActive: !!this.tractorJob,
    });
    const travel = (): void => {
      if (blocked) { toast(blocked, 'bad'); return; }
      if (this.operatingPickup) {
        this.drivePickupRoute(farmTownRoadRouteFrom(farm.pickup), () => {
          this.operatingPickup = false;
          this.pickupAtTown = true;
          this.enterTown();
        });
      } else this.walkFarmRoute(farmTownRoadRouteFrom(this.playerActor), () => this.enterTown());
    };
    showActionMenu(sx, sy, 'County Road · 2 miles', [{
      label: blocked ? blocked : this.operatingPickup ? 'Drive to County Service Center' : 'Go to County Service Center',
      disabled: !!blocked,
      onClick: travel,
    }]);
  }

  private onClickTown(sx: number, sy: number): void {
    const point = this.renderer.camera.tilePointAt(sx, sy);
    if (townPickupHit(point, this.pickupAtTown)) { this.openPickupPanel(); return; }
    const interaction = townInteractionAt(point);
    if (interaction.kind === 'npc') {
      this.walkTownNear(interaction.npc.x, interaction.npc.y, () => {
        this.townGesture = { npcId: interaction.npc.id, until: this.gameNow() + 1_200 };
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
        onClick: () => openFarmEquipment(this.state, {
          context: 'town',
          onRestoreTractor: () => restoreOldTractor(this.state),
          onPurchaseKit: () => purchaseCountyRowCropFieldKit(this.state),
          dispatch: this.dispatch,
          onClose: () => {},
        }),
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
    this.walkTarget = null; this.hover = null; this.townHover = null; this.cancelScoutApproach();
    this.farmCamera = { cx: this.renderer.camera.cx, cy: this.renderer.camera.cy, zoom: this.renderer.camera.zoom, viewW: this.renderer.camera.viewW, viewH: this.renderer.camera.viewH };
    this.townActor = { avatar: this.state.player.avatar, ...TOWN_SPAWN, walking: false };
    this.townFacing = 'north'; this.townTarget = null; this.townGesture = null; this.mode = 'town';
    recordFarmStat(this.state, 'farmTownVisits');
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
    if (this.farmCamera && this.farmCamera.viewW === this.renderer.camera.viewW && this.farmCamera.viewH === this.renderer.camera.viewH) {
      this.renderer.camera.cx = this.farmCamera.cx; this.renderer.camera.cy = this.farmCamera.cy; this.renderer.camera.zoom = this.farmCamera.zoom;
      this.renderer.clampFarmCamera();
    } else this.renderer.centerOnFarm();
    this.farmCamera = null; this.hud.setMode('farm');
    if (this.pickupAtTown) {
      const pickup = farmOf(this.state).pickup;
      const pad = farmLandmarks().cargoPad;
      pickup.x = pad.x; pickup.y = pad.y;
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
      toast('Restore the inherited tractor at the County Equipment Desk before operating it.', 'bad');
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
    this.farmAudio.playTransaction('success');
  }

  private openPickupPanel(): void {
    if (this.mode === 'town') {
      openPanel({
        title: 'Old Pickup · County Parking',
        body: (body) => body.append(
          h('div', { class: 'equipment-card', 'data-testid': 'town-pickup-panel' },
            h('div', { class: 'pickup-panel-illustration' }, 'OLD PICKUP'),
            h('div', { class: 'farm-card-title' }, `Cargo · ${pickupCargoUsed(this.state)} / 72`),
            h('div', { class: 'farm-panel-summary' }, 'County services use cargo in this pickup.'),
            h('button', { class: 'btn btn-primary', onclick: () => openFarmSeedShop(this.state, this.panelActions()) }, 'Feed & Seed'),
            h('button', { class: 'btn', onclick: () => openFarmMarket(this.state, this.panelActions(), 'town') }, 'Grain Exchange'),
            h('button', { class: 'btn', onclick: () => { closePanel(); this.requestReturnToFarm(); } }, 'Return to Farm'),
          ),
        ),
      });
      return;
    }
    const atPad = pickupIsAtCargoPad(this.state);
    openPanel({
      title: 'Old Pickup',
      body: (body) => body.append(
        h('div', { class: 'equipment-card', 'data-testid': 'pickup-panel' },
          h('div', { class: 'pickup-panel-illustration' }, 'OLD PICKUP'),
          h('div', { class: 'farm-card-title' }, `Cargo · ${pickupCargoUsed(this.state)} / 72`),
          h('div', { class: 'farm-panel-summary' }, `Cargo: ${pickupCargoUsed(this.state)} / 72 units`, atPad ? 'Parked at the barn cargo pad.' : 'Park at the barn cargo pad to manage cargo.'),
          h('button', { class: 'btn btn-primary', 'data-testid': this.operatingPickup ? 'exit-pickup' : 'operate-pickup', onclick: () => { closePanel(); this.togglePickupOperating(); } }, this.operatingPickup ? 'Exit Pickup' : 'Operate Pickup'),
          h('button', { class: 'btn', 'data-testid': 'manage-pickup-cargo', onclick: () => { closePanel(); openFarmMarket(this.state, this.panelActions(), 'farm'); } }, atPad ? 'Produce Cargo' : 'Produce Cargo · park at pad'),
          h('button', { class: 'btn', 'data-testid': 'manage-pickup-seeds', onclick: () => { closePanel(); openFarmSeedShop(this.state, this.panelActions()); } }, atPad ? 'Seed Bags' : 'Seed Bags · park at pad'),
        ),
      ),
    });
  }

  private openGameMenu(onBackToTitle: () => void): void {
    this.farmAudio.ensureStarted();
    openPanel({ title: 'Farm Empire Menu', className: 'panel-menu', body: (body) => {
      body.append(
        h('p', {}, this.mode === 'town' ? 'County Service Center · farm business services are nearby.' : 'Park your pickup at the barn cargo pad to manage cargo.'),
        this.farmAudioControls(),
        h('button', { class: 'btn btn-primary', onclick: () => closePanel() }, 'Resume'),
        ...(this.mode === 'farm' ? [h('button', { class: 'btn', onclick: () => this.openFarmhouseOffice() }, 'Farmbook')] : []),
        h('button', { class: 'btn', onclick: () => { this.save(); toast('Farm saved.', 'good'); } }, 'Save'),
        h('button', { class: 'btn', onclick: () => { closePanel(); if (this.mode === 'town') this.renderer.centerOnTown(); else this.renderer.centerOnFarm(); } }, 'Recenter Camera'),
        h('button', { class: 'btn', onclick: () => openPanel({ title: 'How to Play', body: (help) => help.append(h('p', {}, 'Prepare rough soil, plant a crop, then water the new seedlings to start growth. Harvest ready crops into the barn and rework the stubble before planting again. Use row or three-row actions to repeat compatible work.'), h('p', {}, 'Park the pickup at the barn cargo pad, load produce, drive to town, then buy seeds, sell crops, or deliver County corn. Completing the first Pantry delivery unlocks tractor restoration and one paid Freight Board haul per farm day at Eli\'s Grain Exchange. Save and Recenter are always available.')) }) }, 'How to Play'),
        h('button', { class: 'btn btn-primary', onclick: () => { this.save(); closePanel(); onBackToTitle(); } }, 'Save & Return to Farms'),
      );
    } });
  }

  private farmAudioControls(): HTMLElement {
    const snapshot = this.farmAudio.snapshot();
    const muteButton = h('button', {
      class: `btn btn-sm ${snapshot.muted ? '' : 'btn-primary'}`,
      'data-testid': 'farm-audio-mute',
    }, snapshot.muted ? 'Muted' : 'On') as HTMLButtonElement;
    muteButton.addEventListener('click', () => {
      const settings = this.updateFarmAudioSettings({ muted: !this.farmAudio.snapshot().muted });
      muteButton.textContent = settings.muted ? 'Muted' : 'On';
      muteButton.classList.toggle('btn-primary', !settings.muted);
    });
    const slider = (label: string, key: 'ambience' | 'effects', testId: string): HTMLElement => {
      const valueText = h('strong', { class: 'farm-audio-value' }, `${Math.round(snapshot[key] * 100)}%`);
      const input = h('input', {
        type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(snapshot[key] * 100)),
        'aria-label': `${label} volume`, 'data-testid': testId,
      }) as HTMLInputElement;
      input.addEventListener('input', () => {
        const value = Math.max(0, Math.min(100, Number(input.value))) / 100;
        const settings = this.updateFarmAudioSettings({ [key]: value });
        valueText.textContent = `${Math.round(settings[key] * 100)}%`;
      });
      return h('label', { class: 'farm-audio-row' }, h('span', {}, label), input, valueText);
    };
    return h('div', { class: 'farm-audio-controls', 'data-testid': 'farm-audio-controls' },
      h('div', { class: 'farm-audio-heading' }, h('strong', {}, 'Farm Sound'), muteButton),
      slider('Ambience', 'ambience', 'farm-audio-ambience'),
      slider('Effects', 'effects', 'farm-audio-effects'),
    );
  }

  private updateFarmAudioSettings(next: Partial<FarmAudioSettings>): FarmAudioSettings {
    const settings = this.farmAudio.updateSettings(next);
    this.state.settings.sound = !settings.muted && settings.effects > 0;
    this.state.settings.music = !settings.muted && settings.ambience > 0;
    return settings;
  }

  private openFarmhouseOffice(): void {
    this.cancelScoutApproach();
    openFarmOffice(this.state, {
      onSave: () => { this.save(); toast('Farm saved.', 'good'); },
      onRecenter: () => {
        closePanel();
        if (this.mode === 'town') this.renderer.centerOnTown(); else this.renderer.centerOnFarm();
      },
      onLand: () => openFarmLand(this.state, this.panelActions()),
      onCargo: () => openFarmMarket(this.state, this.panelActions(), 'farm'),
      onTownRoad: () => { closePanel(); this.renderer.focusOnFarmPoint(FARM_TOWN_GATE); },
    });
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
    this.farmAudio.playTransaction('success');
  }

  private openScoutMenu(): void {
    const point = farmWorldPoint(this.scout);
    const sx = this.renderer.camera.sx(isoX(point.x, point.y));
    const sy = this.renderer.camera.sy(isoY(point.x, point.y));
    showActionMenu(sx, sy, 'Scout · farm dog', [{
      label: 'Give Scout scratches',
      onClick: () => {
        this.scoutScratchUntil = this.gameNow() + 1_200;
        this.farmAudio.playTransaction('scout');
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

  private drivePickupRoute(points: readonly { x: number; y: number }[], finalCb: () => void): void {
    if (!this.operatingPickup || this.pickupAtTown) return;
    const remaining = points.map((point) => ({ ...point }));
    const driveNext = (): void => {
      const next = remaining.shift();
      if (!next) { finalCb(); return; }
      this.drivePickupTo(next.x, next.y, driveNext);
    };
    driveNext();
  }

  private walkFarmRoute(points: readonly { x: number; y: number }[], finalCb: () => void): void {
    const remaining = points.map((point) => ({ ...point }));
    const walkNext = (): void => {
      const next = remaining.shift();
      if (!next) { finalCb(); return; }
      this.walkNear(next.x, next.y, walkNext);
    };
    walkNext();
  }

  private openTractorParcelMenu(parcelId: FarmParcelId, tx: number, ty: number, sx: number, sy: number): void {
    const plan = planParcelWork(this.state, parcelId, this.gameNow(), farmOf(this.state).selectedCropId);
    const farm = farmOf(this.state);
    const crop = farmCropDef(farm.selectedCropId);
    const cropUnlock = farmCropUnlockInfo(this.state, crop.id);
    const seedCount = farm.seeds[crop.id] ?? 0;
    const parcel = farmParcelDef(parcelId);
    showActionMenu(sx, sy, `${parcel.name} · ${parcel.columns}×${parcel.rows} tractor work`, [
      {
        label: cropUnlock.unlocked
          ? `Prepare & plant ${crop.name} on ${plan.plantPlotUids.length} field section${plan.plantPlotUids.length === 1 ? '' : 's'} (${seedCount} seeds)`
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
      const condition = farmFieldCondition(this.state, plotUid);
      if (condition.soil !== 'tilled') {
        const stubble = condition.soil === 'stubble';
        this.showManualScopeMenu(
          sx, sy, stubble ? 'Harvest stubble' : 'Rough field section',
          stubble ? 'rework' : 'prepare', plotUid,
        );
        return;
      }
      const def = farmCropDef(farm.selectedCropId);
      const count = farm.seeds[def.id] ?? 0;
      this.showManualScopeMenu(
        sx, sy, `Prepared soil · ${def.name} · ${count} seed${count === 1 ? '' : 's'}`,
        'plant', plotUid, def.id, [{
          label: count > 0 ? 'More seeds are sold in town' : 'No seeds · see the Farmbook route',
          disabled: count > 0,
          onClick: () => this.openFarmhouseOffice(),
        }],
      );
      return;
    }
    const def = farmCropDef(plot.crop.defId);
    const now = this.gameNow();
    const stage = farmCropStage(plot.crop, now);
    if (isFarmCropWithered(plot.crop, now)) {
      this.showManualScopeMenu(sx, sy, `${def.name} · Withered · no refund`, 'clear', plotUid, undefined, undefined, 'fx:hungry');
      return;
    }
    if (stage === 'needs-water') {
      this.showManualScopeMenu(sx, sy, `${def.name} · Needs water`, 'water', plotUid, undefined, undefined, 'fx:drop');
      return;
    }
    if (stage === 'ready') {
      this.showManualScopeMenu(sx, sy, `${def.name} · Ready`, 'harvest', plotUid, undefined, undefined, 'fx:ready');
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
      waitUntil: this.gameNow(),
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
      ? plantFarmCrop(this.state, plotUid, String(job.cropId), this.gameNow(), 'operatedTractor')
      : harvestFarmCrop(this.state, plotUid, this.gameNow(), 'operatedTractor');
    if (result.ok) {
      this.farmAudio.playManualAction(job.kind === 'plant' ? 'plant' : 'harvest');
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
    job.waitUntil = this.gameNow() + FIELD_ACTION_PAUSE_MS;
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

  private tractorHudRuntime(): { operating: boolean; working: boolean; statusText: string; manualWorking?: boolean } {
    const manualJob = this.manualFieldJob;
    if (manualJob) {
      const total = manualJob.targetPlotUids.length;
      const current = Math.min(total, manualJob.nextIndex + 1);
      const action = this.manualFieldAction;
      const progress = action ? Math.round(manualFieldActionProgress(action, this.gameNow()) * 100) : 0;
      return {
        operating: false,
        working: false,
        manualWorking: true,
        statusText: `${MANUAL_FIELD_ACTION_LABELS[manualJob.kind]} · ${manualJob.completed}/${total} complete${manualJob.skipped ? ` · ${manualJob.skipped} skipped` : ''} · section ${current}/${total}${action ? ` · ${progress}%` : ''} · Escape cancels`,
      };
    }
    const manual = this.manualFieldAction;
    if (manual) {
      const progress = Math.round(manualFieldActionProgress(manual, this.gameNow()) * 100);
      return {
        operating: false,
        working: false,
        manualWorking: true,
        statusText: `${MANUAL_FIELD_ACTION_LABELS[manual.kind]} | ${progress}% | Escape cancels safely`,
      };
    }
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
      statusText: this.operatingTractor ? 'Operating old tractor · click a field for acreage work' : '',
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
    const now = this.gameNow();
    for (const plot of this.state.plots) {
      if (!plot.crop) continue;
      plot.crop.awaitingWater = false;
      plot.crop.plantedAt = now - farmCropDef(plot.crop.defId).growMs - 1_000;
    }
  }

  private showManualScopeMenu(
    sx: number,
    sy: number,
    title: string,
    kind: ManualFieldActionKind,
    anchorPlotUid: number,
    cropId?: string,
    extraActions: { label: string; disabled?: boolean; icon?: string; onClick: () => void }[] = [],
    icon?: string,
  ): void {
    const verb = kind === 'plant' && cropId ? `Plant ${farmCropDef(cropId).name} on` : MANUAL_ACTION_VERBS[kind];
    const actionIcon = icon ?? (kind === 'plant' && cropId ? `icon:seed_${cropId.replace('crop_', '')}` : undefined);
    const scopes: { scope: ManualFieldSelectionScope; label: string }[] = [
      { scope: 'section', label: 'this section' },
      { scope: 'row', label: 'this row' },
      { scope: 'three-rows', label: '3-row block' },
    ];
    showActionMenu(sx, sy, title, [
      ...scopes.map(({ scope, label }) => {
        const targets = this.manualTargetsFor(kind, anchorPlotUid, scope, cropId);
        return {
          label: `${verb} ${label}${scope === 'section' ? '' : ` · ${targets.length} eligible`}`,
          icon: actionIcon,
          disabled: targets.length === 0,
          onClick: () => this.startManualSelection(kind, anchorPlotUid, scope, cropId),
        };
      }),
      ...extraActions,
    ]);
  }

  private manualTargetsFor(
    kind: ManualFieldActionKind,
    anchorPlotUid: number,
    scope: ManualFieldSelectionScope,
    cropId?: string,
  ): number[] {
    const now = this.gameNow();
    const targets = manualFieldSelectionPlotUids(this.state, anchorPlotUid, scope).filter((plotUid) => {
      const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
      if (!plot) return false;
      const condition = farmFieldCondition(this.state, plotUid);
      if (kind === 'prepare') return !plot.crop && condition.soil === 'rough';
      if (kind === 'rework') return !plot.crop && condition.soil === 'stubble';
      if (kind === 'plant') return !!cropId && isFarmCropUnlocked(this.state, cropId) && !plot.crop && condition.soil === 'tilled';
      if (kind === 'water') return farmCropStage(plot.crop, now) === 'needs-water';
      if (kind === 'harvest') return farmCropStage(plot.crop, now) === 'ready';
      return !!plot.crop && isFarmCropWithered(plot.crop, now);
    });
    if (kind !== 'plant' || !cropId) return targets;
    return targets.slice(0, Math.max(0, farmOf(this.state).seeds[cropId] ?? 0));
  }

  private startManualSelection(
    kind: ManualFieldActionKind,
    anchorPlotUid: number,
    scope: ManualFieldSelectionScope,
    cropId?: string,
  ): void {
    if (this.manualFieldAction || this.manualFieldJob || this.operatingTractor || this.operatingPickup) return;
    const targets = this.manualTargetsFor(kind, anchorPlotUid, scope, cropId);
    if (targets.length === 0) {
      toast('No eligible field sections remain in that selection.', 'bad');
      return;
    }
    if (scope === 'section') {
      this.startManualFieldAction(kind, targets[0], () => this.applyManualFieldAction(kind, targets[0], cropId));
      return;
    }
    this.manualFieldJob = {
      kind,
      scope,
      cropId,
      targetPlotUids: targets,
      nextIndex: 0,
      completed: 0,
      skipped: 0,
    };
    toast(`${scope === 'row' ? 'Row' : 'Three-row block'} selected · ${targets.length} eligible section${targets.length === 1 ? '' : 's'} · Escape stops unfinished work.`, 'good');
    this.beginManualFieldJobStep();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private applyManualFieldAction(kind: ManualFieldActionKind, plotUid: number, cropId?: string): ActionResult {
    if (kind === 'prepare' || kind === 'rework') return tillFarmField(this.state, plotUid);
    if (kind === 'plant') return plantFarmCrop(this.state, plotUid, String(cropId), this.gameNow(), 'manual');
    if (kind === 'water') return waterFarmCrop(this.state, plotUid, this.gameNow());
    if (kind === 'harvest') return harvestFarmCrop(this.state, plotUid, this.gameNow(), 'manual');
    return clearWitheredFarmCrop(this.state, plotUid, this.gameNow());
  }

  private beginManualFieldJobStep(): void {
    const job = this.manualFieldJob;
    if (!job || this.manualFieldAction || this.walkTarget) return;
    while (job.nextIndex < job.targetPlotUids.length) {
      const plotUid = job.targetPlotUids[job.nextIndex];
      const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
      if (!plot) {
        job.skipped += 1;
        job.lastFailure = 'A selected field section was unavailable.';
        job.nextIndex += 1;
        continue;
      }
      this.walkNear(plot.x, plot.y, () => this.startManualFieldAction(
        job.kind,
        plotUid,
        () => this.applyManualFieldAction(job.kind, plotUid, job.cropId),
      ));
      return;
    }
    this.finishManualFieldJob();
  }

  private startManualFieldAction(kind: ManualFieldActionKind, plotUid: number, apply: () => ActionResult): void {
    if (this.mode !== 'farm' || this.operatingTractor || this.operatingPickup || this.manualFieldAction) return;
    const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
    if (!plot) return;
    this.walkTarget = null;
    this.playerActor.walking = false;
    const dx = plot.x - this.playerActor.x;
    const dy = plot.y - this.playerActor.y;
    this.playerFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
    this.manualFieldAction = { ...createManualFieldAction(kind, plotUid, plot, this.gameNow()), apply };
    this.farmAudio.playManualAction(kind);
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private cancelManualFieldAction(): void {
    const action = this.manualFieldAction;
    if (!action) return;
    this.manualFieldAction = null;
    toast(`${MANUAL_FIELD_ACTION_LABELS[action.kind]} cancelled. Nothing changed.`, 'good');
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private finishManualFieldJob(): void {
    const job = this.manualFieldJob;
    if (!job) return;
    const label = job.scope === 'row' ? 'Row' : 'Three-row block';
    const summary = `${label} complete: ${job.completed} completed${job.skipped ? `, ${job.skipped} skipped` : ''}.`;
    const detail = job.skipped && job.lastFailure ? ` ${job.lastFailure}` : '';
    this.manualFieldJob = null;
    this.manualFieldAction = null;
    this.walkTarget = null;
    this.playerActor.walking = false;
    toast(summary + detail, job.completed > 0 ? 'good' : 'bad');
    this.save();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private cancelManualFieldJob(): void {
    const job = this.manualFieldJob;
    if (!job) return;
    const untouched = Math.max(0, job.targetPlotUids.length - job.completed - job.skipped);
    const label = job.scope === 'row' ? 'Row work' : 'Three-row work';
    this.manualFieldJob = null;
    this.manualFieldAction = null;
    this.walkTarget = null;
    this.playerActor.walking = false;
    toast(`${label} cancelled: ${job.completed} completed, ${job.skipped} skipped, ${untouched} not attempted.`, 'good');
    if (job.completed > 0) this.save();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private manualActionBlocksUi(): boolean {
    const kind = this.manualFieldJob?.kind ?? this.manualFieldAction?.kind;
    if (!kind) return false;
    toast(`${MANUAL_FIELD_ACTION_LABELS[kind]} in progress. Finish it or press Escape to cancel.`, 'bad');
    return true;
  }

  private updateManualFieldAction(now: number): void {
    const action = this.manualFieldAction;
    if (!action) {
      if (this.manualFieldJob && !this.walkTarget) this.beginManualFieldJobStep();
      return;
    }
    if (!manualFieldActionComplete(action, now)) return;
    this.manualFieldAction = null;
    const result = action.apply();
    const job = this.manualFieldJob;
    if (!job) {
      this.dispatch(result);
      return;
    }
    if (result.ok) job.completed += 1;
    else {
      job.skipped += 1;
      job.lastFailure = result.reason || 'A selected field section could not be completed.';
      this.farmAudio.playTransaction('error');
    }
    job.nextIndex += 1;
    this.hud.update(this.state, this.tractorHudRuntime());
    this.beginManualFieldJobStep();
  }

  private gameNow(): number {
    return Date.now() + this.simulationOffsetMs;
  }

  private advanceTestTime(ms: number): string {
    if (Number.isFinite(ms) && ms > 0) this.simulationOffsetMs += Math.floor(ms);
    const now = this.gameNow();
    advanceFarmClock(this.state, now);
    this.updateManualFieldAction(now);
    this.renderer.render(this.buildScene(), now);
    this.hud.update(this.state, this.tractorHudRuntime());
    return this.renderGameToText();
  }

  private renderGameToText(): string {
    const farm = farmOf(this.state);
    const now = this.gameNow();
    const fields = this.state.plots.map((plot) => ({
      uid: plot.uid,
      x: plot.x,
      y: plot.y,
      soil: farmFieldCondition(this.state, plot.uid).soil,
      crop: plot.crop?.defId ?? null,
      stage: farmCropStage(plot.crop, now),
    }));
    return JSON.stringify({
      coordinateSystem: 'Farm logical grid; x increases southeast, y increases southwest.',
      mode: this.mode,
      player: this.mode === 'town'
        ? { x: this.townActor.x, y: this.townActor.y, walking: this.townActor.walking }
        : { x: this.playerActor.x, y: this.playerActor.y, walking: this.playerActor.walking },
      selectedCrop: farm.selectedCropId,
      cashCents: farm.cashCents,
      barn: { used: storageUsed(this.state), capacity: farm.storageCapacity },
      pickup: { x: farm.pickup.x, y: farm.pickup.y, operating: this.operatingPickup, atTown: this.pickupAtTown },
      tractor: { x: farm.equipment.tractor.x, y: farm.equipment.tractor.y, operating: this.operatingTractor, working: !!this.tractorJob },
      countyFreight: (() => {
        const board = countyFreightBoardState(this.state);
        const progress = countyFreightProgress(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' });
        return {
          unlocked: board.unlocked,
          offer: board.offer,
          active: board.active,
          completedToday: board.completedToday,
          pickupProgress: progress,
        };
      })(),
      manualFieldAction: this.manualFieldAction ? {
        kind: this.manualFieldAction.kind,
        plotUid: this.manualFieldAction.plotUid,
        progress: manualFieldActionProgress(this.manualFieldAction, this.gameNow()),
      } : null,
      manualFieldJob: this.manualFieldJob ? {
        kind: this.manualFieldJob.kind,
        scope: this.manualFieldJob.scope,
        completed: this.manualFieldJob.completed,
        skipped: this.manualFieldJob.skipped,
        total: this.manualFieldJob.targetPlotUids.length,
        nextIndex: this.manualFieldJob.nextIndex,
      } : null,
      audio: this.farmAudio.snapshot(),
      fields,
      overlay: { actionMenu: isActionMenuOpen(), panel: isPanelOpen() },
    });
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
    const realNow = Date.now();
    const now = this.gameNow();
    const dt = this.lastFrame ? Math.min(100, realNow - this.lastFrame) : 16;
    this.lastFrame = realNow;
    advanceFarmClock(this.state, now);
    if (this.mode === 'farm') this.updateManualFieldAction(now);

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

    const activeVehicle = this.operatingTractor ? 'tractor' : this.operatingPickup ? 'pickup' : null;
    const vehicleMoving = this.operatingTractor ? !!this.tractorTarget : this.operatingPickup ? !!this.pickupTarget : false;
    this.farmAudio.update(activeVehicle, vehicleMoving);

    this.renderer.render(this.buildScene(), now);
    this.hud.update(this.state, this.tractorHudRuntime());
    this.updateDevTools();
    if (realNow - this.lastSave >= AUTOSAVE_MS) {
      this.lastSave = realNow;
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
        pickup: this.pickupAtTown ? { ...TOWN_PICKUP_PARKING } : undefined,
        interactionHint: this.townHover ?? undefined,
      };
      return scene;
    }
    scene.actors = this.operatingTractor || this.operatingPickup ? [] : [{ ...this.playerActor, name: this.state.player.name, facing: this.playerFacing }];
    scene.farm = {
      lockedTiles: farm.parcels.northOwned ? [] : NEIGHBOR_FIELD_TILES,
      fieldConditions: farm.fieldConditions,
      parcelLabel: `${formatMoney(FIRST_PARCEL_PRICE_CENTS)} · ${farmParcelSectionCount('north')} field sections`,
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
      scout: { ...this.scout, facing: this.scoutFacing, scratching: this.gameNow() < this.scoutScratchUntil },
      farmhouseTier: farmhousePresentationTier(farm.parcels.northOwned),
      barnLoftOwned: farm.equipment.barnLoftExpansionOwned,
      clockMinute: farm.clock.minute,
      interactionHint: this.hover ? { kind: this.hover.kind, label: this.hover.label, ...this.hover.point } : undefined,
      manualAction: this.manualFieldAction ? {
        kind: this.manualFieldAction.kind,
        x: this.manualFieldAction.x,
        y: this.manualFieldAction.y,
        progress: manualFieldActionProgress(this.manualFieldAction, this.gameNow()),
      } : undefined,
      manualSelection: this.manualFieldJob
        ? this.manualFieldJob.targetPlotUids.slice(this.manualFieldJob.nextIndex).flatMap((plotUid) => {
          const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
          return plot ? [{ x: plot.x, y: plot.y }] : [];
        })
        : undefined,
      destination: this.tractorTarget
        ? { x: this.tractorTarget.x, y: this.tractorTarget.y, kind: 'tractor' }
        : this.pickupTarget
          ? { x: this.pickupTarget.x, y: this.pickupTarget.y, kind: 'pickup' }
          : this.walkTarget
            ? { x: this.walkTarget.x, y: this.walkTarget.y, kind: 'walk' }
            : undefined,
    };
    if (this.hover && (this.hover.kind === 'field' || this.hover.kind === 'locked-acreage') && this.hover.plotX !== undefined && this.hover.plotY !== undefined) {
      scene.hover = { tx: this.hover.plotX, ty: this.hover.plotY, ok: this.hover.kind === 'field' };
    }
    return scene;
  }
}
