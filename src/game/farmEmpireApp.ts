import type { ActionResult, FarmHarvestDestination, FarmWorkerId, GameState } from '../core/types';
import { allFarmCrops, farmCropDef } from '../core/registry';
import {
  FIRST_PARCEL_PRICE_CENTS, NEIGHBOR_FIELD_TILES, advanceFarmClock, advanceFarmDays, farmOf,
  formatMoney, harvestFarmCrop, plantFarmCrop, purchaseBarnLoftExpansion, purchaseCountyGrainSilo, purchaseCountyHarvestWagon, purchaseCountyRowCropFieldKit, purchaseCountyUtilityTrailer, purchaseNeighborParcel, selectFarmCrop, unloadHarvestWagonToBarn,
  issueCountyReliefSeed, clearWitheredFarmCrop, isFarmCropWithered, farmCropStage, farmCropUnlockInfo, isFarmCropUnlocked,
  syncCashMirror, ownedFarmParcelAt, planParcelWork, farmFieldCondition, tillFarmField, waterFarmCrop,
  placePlayerAtTractorDismount, restoreOldTractor, storageUsed, type FarmParcelId, type ParcelWorkKind, type ParcelWorkPlan,
} from '../core/farmBusiness';
import { ensureOwnedFarmParcelPlots, farmParcelDef, farmParcelSectionCount } from '../core/farmParcels';
import { buyTownSeedsIntoPickup, commitLoadBarnBatch, loadBarnCropToPickup, loadFarmSeedsToPickup, pickupCargoCapacity, pickupCargoUsed, pickupIsAtCargoPad, preflightLoadBarnBatch, sellPickupCrop, sellPickupCropBatch, unloadPickupCropToBarn, unloadPickupSeedsToFarm } from '../core/farmPickup';
import { pickupHomeArrival, pickupPositionForSave, TRACTOR_HOME_PARKING } from '../core/farmPickupData';
import { farmDirectionalInputRoute, farmVehicleControlTarget, isMoveOnlyFarmGround, isMoveOnlyPointerButton, shouldCompleteMoveOnlyGesture } from '../core/farmVehicleControls';
import {
  HAND_BASKET_CAPACITY, basketInteractionBlockReason, handBasketHasCargo, handBasketRemaining, handBasketUsed, harvestFarmCropToBasket,
  inspectBasketHarvest, setHarvestDestination, unloadHandBasket,
} from '../core/farmHarvestBasket';
import { Renderer, sceneFromState, type RenderScene, type SceneActor } from '../render/renderer';
import { isoX, isoY, TILE_H } from '../render/iso';
import { measurePinchGesture, pinchCameraTransform, type PinchGestureFrame, type ScreenPoint } from '../core/pinchGesture';
import { farmhousePresentationTier, farmLogicalPoint, farmPlotAtWorldPoint, farmWorldPoint, farmLandmarks, pointInFarmBounds } from '../render/farmLayout';
import { advanceFarmCompanionFetch, canAdvanceFarmCompanionFetch, updateFarmCompanion, type FarmCompanionFetchState, type FarmCompanionState } from '../core/farmCompanion';
import { recordFarmStat } from '../core/farmKnowledge';
import { farmGrowthReadyAt, rotationPreview } from '../core/farmRotation';
import { firstFarmMorningGuide, shouldPresentStarterGuideTarget } from '../core/firstFarmMorning';
import { FarmSoundscape, type FarmAudioSettings } from '../audio/farmSoundscape';
import {
  MANUAL_FIELD_ACTION_LABELS, createManualFieldAction, manualFieldActionComplete, manualFieldActionProgress,
  manualFieldAcreagePlotUids, manualFieldRectanglePlotUids, manualFieldSelectionPlotUids,
  type ManualFieldAction, type ManualFieldActionKind, type ManualFieldSelectionScope,
} from '../core/farmManualAction';
import { advanceTractorMotion, createTractorMotion, resetTractorMotion, type TractorMotion } from '../core/farmTractorMotion';
import { acceptCountyWorkOrder, fulfillCountyWorkOrder, offerCountyWorkOrder } from '../core/farmTownContact';
import { acceptCountyKitchenDelivery, fulfillCountyKitchenDelivery, offerCountyKitchenDelivery } from '../core/farmCountyKitchen';
import { acceptCountyFreightOffer, countyFreightBoardState, countyFreightProgress, fulfillCountyFreightContract } from '../core/farmCountyFreight';
import { approveWorkforceDispatch, hireEliotReyes, hireFarmManager, hireFirstFarmhand, planFarmManagerDispatch, planFarmhandWork, reviewWorkforceDispatch, startWorkerShift, updateFarmManagerPlan, updateWorkerPlanSlot, workerDefinition, workerDispatchAvailable, type FarmhandWorkKind } from '../core/farmWorkforce';
import { purchaseFarmsteadOfficeQuarters } from '../core/farmstead';
import { applyCurrentFarmRain, currentFarmWeather, farmWeatherForDay } from '../core/farmWeather';
import { fulfillRoadsideStandOrder, purchaseRoadsideStand, roadsideStandOrder, roadsideStandView } from '../core/farmRoadsideStand';
import { FARM_TOWN_GATE, farmTownRoadRouteFrom, placePlayerAtTownReturn, townTravelBlockReason } from '../core/townGateway';
import { TOWN_NPCS, type TownNpcDef, type TownServiceId } from '../data/town.data';
import { ELIOT_REYES, FIRST_FARMHAND } from '../data/farmWorkforce.data';
import type { FarmFacing } from '../render/farmSprites';
import { farmInteractionAtWorldPoint, farmScoutHitAtWorldPoint, farmVehicleHitsAtWorldPoint, type FarmInteractionTarget } from '../render/farmInteractions';
import {
  TOWN_EXIT, TOWN_PICKUP_PARKING, TOWN_SPAWN, cancelTownMovement, pointInTownNpcScreenHitbox,
  pointInTownPickupScreenHitbox, townInteractionAt, townPickupHit, type TownMoveTarget,
} from '../render/townLayout';
import { FarmHud } from '../ui/farmHud';
import { hideActionMenu, isActionMenuOpen, showActionMenu } from '../ui/actionMenu';
import { closePanel, isPanelOpen, openPanel } from '../ui/modal';
import { floatText, toast } from '../ui/toast';
import {
  openCountyKitchen, openCountyWorkOrder, openFarmEquipment, openFarmLand, openFarmMarket, openFarmSeedShop, type FarmPanelActions,
} from '../ui/panels/farmPanels';
import { openFarmOffice } from '../ui/panels/farmOffice';
import { openFarmWorkforce } from '../ui/panels/farmWorkforce';
import { openFarmRoadsideStand } from '../ui/panels/farmRoadsideStand';
import { saveToSlot } from '../save/save';
import { h, spriteImg } from '../ui/dom';
import { shouldTriggerFarmHarvestFeedback } from './farmHarvestFeedback';
import { resumeFarmSession } from '../core/farmOfflineSafety';
import { shouldRenderFarmFrame } from '../render/renderResolution';
import { formatFarmCapacity } from '../core/farmCargoScale';
import { FarmWorkforceReservationLedger } from '../core/farmWorkforceReservations';
import { pickupReminderSignature, pickupReminderText, reminderWindow } from '../core/farmPickupReminder';

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

interface RunningManualFieldAction extends ManualFieldAction {
  apply: () => ActionResult;
}

interface ManualFieldJob {
  kind: ManualFieldActionKind;
  scope: Exclude<ManualFieldSelectionScope, 'section'> | 'selection';
  cropId?: string;
  targetPlotUids: number[];
  nextIndex: number;
  completed: number;
  skipped: number;
  lastFailure?: string;
}

interface BasketUnload {
  destination: FarmHarvestDestination;
  afterSuccess: (() => void) | null;
  onFailure: ((reason: string) => void) | null;
}

interface HarvestFeedback { x: number; y: number; cropId: string; startedAt: number }

const HUD_REFRESH_MS = 100;

interface FarmhandJob {
  workerId: FarmWorkerId;
  kind: FarmhandWorkKind;
  parcelId: FarmParcelId;
  cropId?: string;
  targetPlotUids: number[];
  nextIndex: number;
  completed: number;
  skipped: number;
  lastFailure?: string;
}

interface WorkerRuntime { actor: SceneActor; facing: FarmFacing; target: { x: number; y: number; plotUid?: number } | null; action: RunningManualFieldAction | null; job: FarmhandJob | null; }


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
  private scoutFetch: FarmCompanionFetchState | null = null;
  private scoutOverlapToastAt = 0;
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
  private basketUnload: BasketUnload | null = null;
  private harvestFeedback: HarvestFeedback | null = null;
  private fieldDragSelection: number[] = [];
  private farmhandActor: SceneActor;
  private eliotActor: SceneActor;
  private farmhandFacing: FarmFacing = 'south';
  private farmhandTarget: { x: number; y: number; plotUid?: number } | null = null;
  private farmhandAction: RunningManualFieldAction | null = null;
  private farmhandJob: FarmhandJob | null = null;
  private workerRuntime: Record<FarmWorkerId, WorkerRuntime>;
  private workerReservations = new FarmWorkforceReservationLedger();
  private equipmentPanelOpen = false;
  private running = true;
  private raf = 0;
  private lastFrame = 0;
  private lastRenderedAt = 0;
  private lastHudRefresh = 0;
  private pickupReminderSignature = '';
  private pickupReminderText: string | null = null;
  private pickupReminderShowAt = 0;
  private pickupReminderExpiresAt = 0;
  private hiddenAt: number | null = null;
  private lastSave: number;
  private simulationOffsetMs = 0;
  private lastRainNoticeDay = 0;
  private devTools: HTMLElement | null = null;
  private inputCleanup: (() => void) | null = null;
  private resizeRaf = 0;
  private resizeSettleTimer: number | null = null;
  private applyViewportResize(): void {
    this.renderer.resize();
    // A live resize changes the active scene's fit, so discard stale viewport
    // framing instead of merely clamping a desktop zoom into a compact view.
    if (this.mode === 'town') this.renderer.centerOnTown(); else this.renderer.centerOnFarm();
  }
  private readonly onResize = (): void => {
    cancelAnimationFrame(this.resizeRaf);
    if (this.resizeSettleTimer !== null) window.clearTimeout(this.resizeSettleTimer);
    // iOS emits orientation and visual-viewport changes in separate phases.
    // Refit once on the next paint and once after the viewport has settled.
    this.resizeRaf = requestAnimationFrame(() => this.applyViewportResize());
    this.resizeSettleTimer = window.setTimeout(() => {
      this.resizeSettleTimer = null;
      this.applyViewportResize();
    }, 180);
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
    window.addEventListener('orientationchange', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);
    this.playerActor = {
      avatar: state.player.avatar,
      x: state.player.px,
      y: state.player.py,
      walking: false,
    };
    this.townActor = { avatar: state.player.avatar, ...TOWN_SPAWN, walking: false };
    const scoutHome = farmLandmarks().scoutHome;
    const farmhandHome = farmLandmarks().farmhandHome;
    this.farmhandActor = { avatar: FIRST_FARMHAND.avatar, ...farmhandHome, walking: false, name: FIRST_FARMHAND.name, variant: 'farmhand' };
    this.eliotActor = { avatar: ELIOT_REYES.avatar, ...farmLandmarks().crewHandHome, walking: false, name: ELIOT_REYES.name, variant: 'farmhand' };
    this.workerRuntime = {
      'mara-bell': { actor: this.farmhandActor, facing: 'south', target: null, action: null, job: null },
      'eliot-reyes': { actor: this.eliotActor, facing: 'south', target: null, action: null, job: null },
    };
    this.scout = { ...scoutHome, mode: 'home', moving: false };
    this.hud = new FarmHud({
      onSelectCrop: (cropId) => this.dispatch(selectFarmCrop(this.state, cropId)),
      onOpenCropChooser: () => this.openCropChooser(),
      onMarket: () => { if (this.manualActionBlocksUi()) return; this.cancelScoutApproach(); openFarmMarket(this.state, this.panelActions(), 'farm'); },
      onFarmbook: () => { if (!this.manualActionBlocksUi()) this.openFarmhouseOffice(); },
      onToggleHarvestDestination: () => this.openBasketMenu(),
      onUnloadBasket: () => this.requestBasketUnload(),
      onCancelOperation: () => this.cancelActiveOperation(),
      onEquipment: () => { if (!this.manualActionBlocksUi()) this.openEquipmentPanel(); },
      onReturnFarm: () => this.requestReturnToFarm(),
      onSave: () => {
        this.save();
        toast(this.mode === 'town' ? 'Farm business saved from town.' : 'Farm saved.', 'good');
      },
      onFitFarm: () => {
        if (this.mode === 'town') this.renderer.centerOnTown(); else this.renderer.centerOnFarm();
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
      sellBatch: (batch) => this.mode === 'town' ? sellPickupCropBatch(this.state, batch, this.pickupAtTown) : failFarmSideSale(),
      loadBatch: (batch) => { const preflight = preflightLoadBarnBatch(this.state, batch); return preflight.ok ? commitLoadBarnBatch(this.state, preflight.plan) : { ok: false, reason: preflight.reason }; },
      loadCrop: (cropId, count) => loadBarnCropToPickup(this.state, cropId, count),
      unloadCrop: (cropId, count) => unloadPickupCropToBarn(this.state, cropId, count),
      loadSeeds: (cropId, count) => loadFarmSeedsToPickup(this.state, cropId, count),
      unloadSeeds: (cropId, count) => unloadPickupSeedsToFarm(this.state, cropId, count),
      buyLand: () => purchaseNeighborParcel(this.state),
      acceptCountyWorkOrder: () => acceptCountyWorkOrder(this.state),
      fulfillCountyWorkOrder: () => fulfillCountyWorkOrder(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' }),
      acceptCountyKitchenDelivery: () => acceptCountyKitchenDelivery(this.state),
      fulfillCountyKitchenDelivery: () => fulfillCountyKitchenDelivery(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' }),
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
    cancelAnimationFrame(this.resizeRaf);
    if (this.resizeSettleTimer !== null) window.clearTimeout(this.resizeSettleTimer);
    this.hud.destroy();
    this.farmAudio.destroy();
    window.removeEventListener('beforeunload', this.save);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.inputCleanup?.(); this.inputCleanup = null;
    this.devTools?.remove();
    const browserHooks = window as unknown as Record<string, unknown>;
    delete browserHooks.__FE__;
    delete browserHooks.render_game_to_text;
    delete browserHooks.advanceTime;
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.hiddenAt === null) this.hiddenAt = Date.now();
      this.save();
      return;
    }
    if (this.hiddenAt === null) return;
    const now = Date.now();
    resumeFarmSession(this.state, this.hiddenAt, now, false);
    this.hiddenAt = null;
    this.lastFrame = now;
    this.hud.update(this.state, this.tractorHudRuntime());
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
        const destination = (event.data as { destination?: string } | undefined)?.destination === 'basket'
          ? 'basket'
          : 'barn';
        toast(`Harvested ${event.amount ?? 0} ${farmCropDef(String(event.target)).name} into the ${destination}.`, 'good');
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

  private updatePickupReminder(now: number): void {
    const context = { mode: this.mode, pickupAtTown: this.pickupAtTown, driving: this.operatingPickup || this.operatingTractor || !!this.pickupTarget, basketUnits: handBasketUsed(this.state) } as const;
    const signature = pickupReminderSignature(this.state, context);
    if (signature !== this.pickupReminderSignature) {
      this.pickupReminderSignature = signature;
      this.pickupReminderText = pickupReminderText(this.state, context);
      const window = reminderWindow(now);
      this.pickupReminderShowAt = window.showAt;
      this.pickupReminderExpiresAt = window.expiresAt;
    }
    const visible = this.pickupReminderText && now >= this.pickupReminderShowAt && now < this.pickupReminderExpiresAt && !context.driving;
    this.hud.setPickupReminder(visible ? this.pickupReminderText : null);
  }

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
      pickup: { ...farm.pickup, headingX: this.pickupMotion.headingX, headingY: this.pickupMotion.headingY, trailerOwned: farm.equipment.countyUtilityTrailerOwned },
      tractor: { ...farm.equipment.tractor, headingX: this.tractorMotion.headingX, headingY: this.tractorMotion.headingY, attachmentVisible: farm.equipment.harvestWagon.owned && (this.tractorJob?.kind === 'harvest' || Object.values(farm.equipment.harvestWagon.crops).some((count) => count > 0)), attachmentTier: farm.equipment.harvestWagon.tier },
      farmhand: farm.workforce.farmhandHired ? this.farmhandActor : undefined,
      farmhands: farm.workforce.eliotHired ? [{ point: this.eliotActor, label: `${ELIOT_REYES.name} · ${ELIOT_REYES.role}` }] : undefined,
      scout: this.scout,
      now: this.gameNow(),
    });
  }

  private farmPlotAtScreen(sx: number, sy: number): GameState['plots'][number] | undefined {
    const world = this.renderer.camera.tilePointAt(sx, sy);
    if (!pointInFarmBounds(world)) return undefined;
    return farmPlotAtWorldPoint(this.state.plots, world);
  }

  private townInteractionHintAtScreen(sx: number, sy: number): { label: string; x: number; y: number } | null {
    const pickupAnchor = this.townScreenAnchor(TOWN_PICKUP_PARKING);
    const point = this.renderer.camera.tilePointAt(sx, sy);
    if (this.pickupAtTown && pointInTownPickupScreenHitbox(
      { x: sx, y: sy }, pickupAnchor, this.renderer.camera.zoom,
    )) return { label: `Old Pickup · ${formatFarmCapacity(pickupCargoUsed(this.state), pickupCargoCapacity(this.state))}`, ...TOWN_PICKUP_PARKING };
    if (townPickupHit(point, this.pickupAtTown)) return { label: `Old Pickup · ${formatFarmCapacity(pickupCargoUsed(this.state), pickupCargoCapacity(this.state))}`, ...TOWN_PICKUP_PARKING };
    const screenNpc = this.townNpcAtScreen(sx, sy);
    if (screenNpc) return { label: `${screenNpc.name} · ${screenNpc.role}`, x: screenNpc.x, y: screenNpc.y };
    const interaction = townInteractionAt(point);
    if (interaction.kind === 'npc') return { label: `${interaction.npc.name} · ${interaction.npc.role}`, x: interaction.npc.x, y: interaction.npc.y };
    if (interaction.kind === 'building') return { label: interaction.building.name, ...interaction.building.door };
    if (interaction.kind === 'exit') return { label: 'Return to Farm', ...TOWN_EXIT };
    return null;
  }

  private townScreenAnchor(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.renderer.camera.sx(isoX(point.x, point.y)),
      y: this.renderer.camera.sy(isoY(point.x, point.y) + TILE_H / 2),
    };
  }

  private townNpcAtScreen(sx: number, sy: number): TownNpcDef | undefined {
    return TOWN_NPCS.find((npc) => pointInTownNpcScreenHitbox(
      { x: sx, y: sy },
      this.townScreenAnchor(npc),
      this.renderer.camera.zoom,
    ));
  }

  private cancelActiveOperation(): void {
    if (this.mode === 'town') {
      if (isActionMenuOpen()) hideActionMenu();
      else if (isPanelOpen()) closePanel();
      this.cancelTownWalk();
      return;
    }
    if (this.fieldDragSelection.length > 0) {
      this.fieldDragSelection = [];
      if (isActionMenuOpen()) hideActionMenu();
      return;
    }
    if (this.basketUnload) {
      this.cancelBasketUnload();
      if (this.manualFieldJob) this.cancelManualFieldJob(false);
    } else if (this.manualFieldJob) this.cancelManualFieldJob();
    else if (this.manualFieldAction) this.cancelManualFieldAction();
    else if (this.scoutWaitingForScratch) this.cancelScoutApproach();
    else if (this.scoutFetch) this.cancelScoutFetch();
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
    else if (this.farmhandJob) this.cancelFarmhandJob();
    else if (this.workerRuntime['mara-bell'].job) this.cancelWorkerJob('mara-bell');
    else if (this.workerRuntime['eliot-reyes'].job) this.cancelWorkerJob('eliot-reyes');
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    let downX = 0;
    let downY = 0;
    let dragging = false;
    let panning = false;
    let selectionAnchorUid: number | null = null;
    let fieldSelecting = false;
    let secondaryGestureArmed = false;
    const touchPointers = new Map<number, ScreenPoint>();
    let previousPinch: PinchGestureFrame | null = null;
    let touchGestureConsumed = false;

    const currentPinch = (): PinchGestureFrame | null => {
      const points = [...touchPointers.values()];
      if (points.length < 2) return null;
      return measurePinchGesture(points[0], points[1]);
    };

    const resetDirectGesture = (): void => {
      dragging = false;
      panning = false;
      selectionAnchorUid = null;
      fieldSelecting = false;
      secondaryGestureArmed = false;
      this.fieldDragSelection = [];
    };

    const onPointerDown = (event: PointerEvent): void => {
      this.farmAudio.ensureStarted();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Some embedded browsers can reject capture during a cancelled gesture.
      }
      if (event.pointerType === 'touch') {
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touchPointers.size >= 2) {
          previousPinch = currentPinch();
          touchGestureConsumed = true;
          resetDirectGesture();
          event.preventDefault();
          return;
        }
      }
      if (isMoveOnlyPointerButton(event.button)) {
        secondaryGestureArmed = !dragging;
        return;
      }
      if (event.button !== 0) return;
      downX = event.clientX;
      downY = event.clientY;
      dragging = true;
      panning = false;
      fieldSelecting = false;
      selectionAnchorUid = null;
      if (
        event.button === 0
        && this.mode === 'farm'
        && !this.operatingPickup
        && !this.tractorJob
        && !this.tractorTarget
        && !this.manualFieldAction
        && !this.manualFieldJob
        && !isActionMenuOpen()
        && !isPanelOpen()
      ) {
        const interaction = this.farmInteractionAtScreen(event.clientX, event.clientY);
        if (interaction?.kind === 'field' && interaction.plotUid !== undefined) {
          const parcelId = ownedFarmParcelAt(this.state, interaction.point.x, interaction.point.y);
          if (!parcelId || this.farmhandJob?.parcelId !== parcelId) {
            selectionAnchorUid = interaction.plotUid;
            this.fieldDragSelection = [interaction.plotUid];
          }
        }
      }
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerType === 'touch' && touchPointers.has(event.pointerId)) {
        touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const nextPinch = currentPinch();
        if (nextPinch) {
          if (previousPinch) {
            const transform = pinchCameraTransform(previousPinch, nextPinch);
            this.renderer.camera.pan(transform.panX, transform.panY);
            this.renderer.camera.zoomAt(transform.zoomFactor, transform.center.x, transform.center.y);
            if (this.mode === 'town') this.renderer.clampTownCamera(); else this.renderer.clampFarmCamera();
          }
          previousPinch = nextPinch;
          touchGestureConsumed = true;
          resetDirectGesture();
          event.preventDefault();
          return;
        }
        if (touchGestureConsumed) {
          event.preventDefault();
          return;
        }
      }
      if (dragging) {
        const dx = event.clientX - downX;
        const dy = event.clientY - downY;
        if (selectionAnchorUid !== null && (fieldSelecting || Math.hypot(dx, dy) > 6)) {
          fieldSelecting = true;
          const end = this.farmPlotAtScreen(event.clientX, event.clientY);
          if (end) {
            const selected = manualFieldRectanglePlotUids(this.state, selectionAnchorUid, end.uid);
            if (selected.length > 0) this.fieldDragSelection = selected;
          }
        } else if (panning || (selectionAnchorUid === null && Math.hypot(dx, dy) > 6)) {
          panning = true;
          this.renderer.camera.pan(event.movementX, event.movementY);
          if (this.mode === 'town') this.renderer.clampTownCamera(); else this.renderer.clampFarmCamera();
        }
      }
      this.hover = this.mode === 'farm' ? this.farmInteractionAtScreen(event.clientX, event.clientY) : null;
      this.townHover = this.mode === 'town' ? this.townInteractionHintAtScreen(event.clientX, event.clientY) : null;
    };
    const onPointerUp = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.pointerType === 'touch') {
        const consumed = touchGestureConsumed;
        touchPointers.delete(event.pointerId);
        previousPinch = currentPinch();
        if (consumed) {
          resetDirectGesture();
          if (touchPointers.size === 0) touchGestureConsumed = false;
          event.preventDefault();
          return;
        }
      }
      if (event.button !== 0) {
        if (isMoveOnlyPointerButton(event.button) && shouldCompleteMoveOnlyGesture(secondaryGestureArmed, dragging)) this.onMoveOnlyClick(event.clientX, event.clientY);
        if (isMoveOnlyPointerButton(event.button)) secondaryGestureArmed = false;
        return;
      }
      dragging = false;
      secondaryGestureArmed = false;
      if (selectionAnchorUid !== null) {
        const anchorPlotUid = selectionAnchorUid;
        const wasSelecting = fieldSelecting;
        selectionAnchorUid = null;
        fieldSelecting = false;
        if (wasSelecting) {
          if (this.operatingTractor) {
            this.showTractorDragMenu(event.clientX, event.clientY, this.fieldDragSelection, anchorPlotUid);
          } else {
            this.showManualDragMenu(event.clientX, event.clientY, this.fieldDragSelection);
          }
          return;
        }
        this.fieldDragSelection = [];
      }
      if (panning) {
        panning = false;
        return;
      }
      this.onClick(event.clientX, event.clientY);
    };
    const onPointerLeave = (event: PointerEvent): void => {
      if (event.pointerType === 'touch') {
        touchPointers.delete(event.pointerId);
        previousPinch = currentPinch();
        if (touchPointers.size === 0) touchGestureConsumed = false;
      }
      if (dragging && selectionAnchorUid !== null) this.fieldDragSelection = [];
      dragging = false;
      selectionAnchorUid = null;
      fieldSelecting = false;
      secondaryGestureArmed = false;
      this.hover = null;
      this.townHover = null;
    };
    const onPointerCancel = (event: PointerEvent): void => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.pointerType === 'touch') touchPointers.delete(event.pointerId);
      previousPinch = currentPinch();
      if (touchPointers.size === 0) touchGestureConsumed = false;
      resetDirectGesture();
      this.hover = null;
      this.townHover = null;
    };
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      this.renderer.camera.zoomAt(event.deltaY < 0 ? 1.12 : 0.9, event.clientX, event.clientY);
      if (this.mode === 'town') this.renderer.clampTownCamera(); else this.renderer.clampFarmCamera();
    };
    const onContextMenu = (event: MouseEvent): void => event.preventDefault();
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isTyping = !!target && (target.matches('input, textarea, select') || target.isContentEditable);
      if (isTyping) return;
      if (this.mode === 'farm' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const cropIndex = /^[1-8]$/.test(event.key) ? Number(event.key) - 1 : -1;
        if (cropIndex >= 0) {
          event.preventDefault();
          const crop = allFarmCrops()[cropIndex];
          if (crop) {
            hideActionMenu();
            this.fieldDragSelection = [];
            this.dispatch(selectFarmCrop(this.state, crop.id));
          }
          return;
        }
        const key = event.key.toLowerCase();
        const route = farmDirectionalInputRoute(key, {
          mode: this.mode,
          operatingVehicle: this.operatingTractor || this.operatingPickup,
          tractorFieldJobActive: !!this.tractorJob,
          panelOpen: isPanelOpen(),
          actionMenuOpen: isActionMenuOpen(),
          activeOwnerWork: !!this.manualFieldAction || !!this.manualFieldJob || !!this.basketUnload,
        });
        if (route === 'blocked') {
          event.preventDefault();
          return;
        }
        const vehicleTarget = route === 'vehicle'
          ? farmVehicleControlTarget(key, this.operatingTractor ? farmOf(this.state).equipment.tractor : farmOf(this.state).pickup)
          : null;
        if (vehicleTarget) {
          event.preventDefault();
          if (this.operatingTractor) this.driveTractorTo(vehicleTarget.x, vehicleTarget.y);
          else this.drivePickupTo(vehicleTarget.x, vehicleTarget.y);
          return;
        }
        const panStep = 52;
        const pan = key === 'arrowleft' || key === 'a' ? { x: panStep, y: 0 }
          : key === 'arrowright' || key === 'd' ? { x: -panStep, y: 0 }
            : key === 'arrowup' || key === 'w' ? { x: 0, y: panStep }
              : key === 'arrowdown' || key === 's' ? { x: 0, y: -panStep }
                : null;
        if (pan && !isActionMenuOpen() && !isPanelOpen()) {
          event.preventDefault();
          this.renderer.camera.pan(pan.x, pan.y);
          this.renderer.clampFarmCamera();
          return;
        }
      }
      if (event.key !== 'Escape') return;
      this.cancelActiveOperation();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    this.inputCleanup = () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  private onClick(sx: number, sy: number): void {
    if (isActionMenuOpen()) {
      hideActionMenu();
      this.fieldDragSelection = [];
      return;
    }
    if (this.mode === 'town') {
      this.onClickTown(sx, sy);
      return;
    }
    if (this.manualFieldJob || this.manualFieldAction || this.basketUnload) {
      if (this.basketUnload) {
        toast('Basket unloading in progress. Use Cancel to stop safely; the harvest stays safe.', 'bad');
        return;
      }
      const kind = this.manualFieldJob?.kind ?? this.manualFieldAction!.kind;
      toast(`${MANUAL_FIELD_ACTION_LABELS[kind]} in progress. Use Cancel to stop safely.`, 'bad');
      return;
    }
    if (this.tractorJob) {
      toast('A tractor field job is already active. Use Cancel to stop safely.', 'bad');
      return;
    }
    // Any new world click replaces an in-progress approach to Scout. A fresh
    // Scout hit below immediately restores the hold for that new approach.
    this.cancelScoutApproach();
    const worldPoint = this.renderer.camera.tilePointAt(sx, sy);
    if (!pointInFarmBounds(worldPoint)) return;
    const farm = farmOf(this.state);
    const interaction = farmInteractionAtWorldPoint(this.state, worldPoint, {
      pickup: { ...farm.pickup, headingX: this.pickupMotion.headingX, headingY: this.pickupMotion.headingY, trailerOwned: farm.equipment.countyUtilityTrailerOwned },
      tractor: { ...farm.equipment.tractor, headingX: this.tractorMotion.headingX, headingY: this.tractorMotion.headingY, attachmentVisible: farm.equipment.harvestWagon.owned && Object.values(farm.equipment.harvestWagon.crops).some((count) => count > 0), attachmentTier: farm.equipment.harvestWagon.tier },
      farmhand: farm.workforce.farmhandHired ? this.farmhandActor : undefined,
      farmhands: farm.workforce.eliotHired ? [{ point: this.eliotActor, label: `${ELIOT_REYES.name} · ${ELIOT_REYES.role}` }] : undefined,
      scout: this.scout,
      now: this.gameNow(),
    });
    const vehicleHits = farmVehicleHitsAtWorldPoint(worldPoint, {
      pickup: { ...farm.pickup, headingX: this.pickupMotion.headingX, headingY: this.pickupMotion.headingY, trailerOwned: farm.equipment.countyUtilityTrailerOwned },
      tractor: { ...farm.equipment.tractor, headingX: this.tractorMotion.headingX, headingY: this.tractorMotion.headingY, attachmentVisible: farm.equipment.harvestWagon.owned && Object.values(farm.equipment.harvestWagon.crops).some((count) => count > 0), attachmentTier: farm.equipment.harvestWagon.tier },
    });
    if (!this.operatingTractor && !this.operatingPickup && vehicleHits.length === 2) {
      showActionMenu(sx, sy, 'Vehicles parked together', [
        { label: 'Old Pickup · cargo and driving', onClick: () => this.openPickupPanel() },
        { label: 'Old Tractor · operate', disabled: farm.equipment.tractor.status !== 'operational', onClick: () => this.toggleTractorOperating() },
        { label: 'Inspect tractor equipment', onClick: () => this.openEquipmentPanel() },
      ]);
      return;
    }
    if (interaction && interaction.kind !== 'scout' && farmScoutHitAtWorldPoint(worldPoint, { scout: this.scout })) this.notifyScoutOverlap();
    if (interaction?.kind === 'pickup') {
      if (this.operatingTractor) this.switchTractorToPickup();
      else if (this.operatingPickup) this.togglePickupOperating();
      else this.openPickupPanel();
      return;
    }
    if (interaction?.kind === 'tractor') {
      if (this.operatingPickup) this.switchPickupToTractor();
      else if (farm.equipment.tractor.status === 'operational') this.toggleTractorOperating();
      else this.openEquipmentPanel();
      return;
    }
    if (interaction?.kind === 'farmhand') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to talk with Mara.', 'bad'); return; }
      this.walkNear(interaction.point.x, interaction.point.y, () => this.openWorkforcePanel('farm'));
      return;
    }
    if (interaction?.kind === 'scout') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to visit Scout.', 'bad'); return; }
      this.scoutWaitingForScratch = true;
      this.walkNear(this.scout.x, this.scout.y, () => { this.scoutWaitingForScratch = false; this.openScoutMenu(); });
      return;
    }
    if (interaction?.kind === 'doghouse') { toast("Scout's corner is cozy. Catch him on open grass for scratches or a game of fetch.", 'good'); return; }
    if (interaction?.kind === 'farmhouse') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to use the farmhouse.', 'bad'); return; }
      this.walkNear(interaction.point.x, interaction.point.y, () => this.openFarmhouseOffice());
      return;
    }
    if (interaction?.kind === 'roadside-stand') {
      if (this.operatingTractor || this.operatingPickup) { toast('Exit the vehicle to stock the farm stand.', 'bad'); return; }
      this.walkNear(interaction.point.x, interaction.point.y, () => this.openRoadsideStand('farm'));
      return;
    }
    if (interaction?.kind === 'pump') {
      showActionMenu(sx, sy, 'Hand Pump', [
        { label: 'Water new seedlings from their field menu · no water to carry', disabled: true, onClick: () => {} },
        { label: 'Open Farmbook', onClick: () => this.openFarmhouseOffice() },
      ]);
      return;
    }
    if (interaction?.kind === 'town-gate') { this.openFarmGateMenu(sx, sy); return; }
    if (interaction?.kind === 'locked-acreage') { openFarmLand(this.state, this.panelActions()); return; }
    if (interaction?.kind === 'barn') {
      if (this.operatingTractor) {
        this.driveTractorToReceivingBay();
        return;
      }
      if (this.operatingPickup) {
        const pad = farmLandmarks().cargoPad;
        this.drivePickupTo(pad.x, pad.y, () => { toast('Pickup parked at the cargo pad.', 'good'); this.openPickupPanel(); });
      } else this.walkNear(interaction.point.x, interaction.point.y, () => showActionMenu(sx, sy, 'Barn · Cargo & Storage', [
        { label: 'Load Produce for Town', icon: 'icon:produce_corn', onClick: () => pickupIsAtCargoPad(this.state) ? openFarmMarket(this.state, this.panelActions(), 'farm') : this.drivePickupToCargoPad() },
        { label: 'Unload Pickup', icon: 'icon:produce_wheat', onClick: () => pickupIsAtCargoPad(this.state) ? openFarmMarket(this.state, this.panelActions(), 'farm') : this.drivePickupToCargoPad() },
        { label: 'View Barn & Upgrades', onClick: () => this.openFarmInventory() },
      ]));
      return;
    }
    if (interaction?.kind === 'field' && interaction.plotUid !== undefined) {
      const parcelId = ownedFarmParcelAt(this.state, interaction.point.x, interaction.point.y);
      if (parcelId && this.farmhandJob?.parcelId === parcelId) {
        toast(`${FIRST_FARMHAND.name} is working this acreage. Use the other field or stop her assignment from Workforce.`, 'bad');
        return;
      }
      if (this.operatingTractor) {
        if (parcelId) this.openTractorParcelMenu(parcelId, interaction.plotUid, interaction.point.x, interaction.point.y, sx, sy);
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

  /** Secondary click on the tractor inspects it; other secondary clicks remain ground-only movement. */
  private onMoveOnlyClick(sx: number, sy: number): void {
    if (isActionMenuOpen() || isPanelOpen() || this.manualFieldJob || this.manualFieldAction || this.basketUnload || this.tractorJob) return;
    if (this.mode === 'town') {
      const point = this.renderer.camera.tilePointAt(sx, sy);
      const pickupAnchor = this.townScreenAnchor(TOWN_PICKUP_PARKING);
      if (this.townNpcAtScreen(sx, sy) || (this.pickupAtTown && (pointInTownPickupScreenHitbox({ x: sx, y: sy }, pickupAnchor, this.renderer.camera.zoom) || townPickupHit(point, true)))) return;
      const interaction = townInteractionAt(point);
      if (interaction.kind === 'ground') this.townTarget = { ...interaction.point, cb: null };
      return;
    }
    const interaction = this.farmInteractionAtScreen(sx, sy);
    if (interaction?.kind === 'tractor' && !this.operatingPickup) {
      this.openEquipmentPanel();
      return;
    }
    if (!isMoveOnlyFarmGround(interaction?.kind)) return;
    const target = this.farmTargetAtScreen(sx, sy);
    if (!target) return;
    if (this.operatingTractor) this.driveTractorTo(target.tx, target.ty);
    else if (this.operatingPickup) this.drivePickupTo(target.tx, target.ty);
    else this.walkNear(target.tx, target.ty, null);
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
    const pickupAnchor = this.townScreenAnchor(TOWN_PICKUP_PARKING);
    if (this.pickupAtTown && (
      pointInTownPickupScreenHitbox({ x: sx, y: sy }, pickupAnchor, this.renderer.camera.zoom)
      || townPickupHit(point, true)
    )) { this.openPickupPanel(); return; }
    const screenNpc = this.townNpcAtScreen(sx, sy);
    const interaction = screenNpc
      ? { kind: 'npc' as const, npc: screenNpc, service: screenNpc.service }
      : townInteractionAt(point);
    if (interaction.kind === 'npc') {
      this.walkTownNear(interaction.npc.x, interaction.npc.y, () => {
        this.townGesture = { npcId: interaction.npc.id, until: this.gameNow() + 1_200 };
        if (interaction.npc.id === 'mae-carter') this.openCountyWorkOrder();
        else if (interaction.npc.id === 'rosa-alvarez') this.openCountyKitchen();
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
    if (service === 'county-kitchen') { this.openCountyKitchen(); return; }
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
          onPurchaseTrailer: () => purchaseCountyUtilityTrailer(this.state),
          onPurchaseSilo: () => purchaseCountyGrainSilo(this.state),
          onPurchaseWagon: () => purchaseCountyHarvestWagon(this.state),
          dispatch: this.dispatch,
          onClose: () => {},
        }),
      },
      { label: 'Workforce Desk', onClick: () => this.openWorkforcePanel('town') },
      { label: 'Farm Improvements', onClick: () => this.openRoadsideStand('town') },
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
    hideActionMenu(); if (isPanelOpen()) closePanel();
    const returnPoint = placePlayerAtTownReturn(this.state);
    this.playerActor.x = returnPoint.x; this.playerActor.y = returnPoint.y; this.playerActor.walking = false;
    this.walkTarget = null; this.hover = null; this.townHover = null; this.cancelScoutApproach(); this.cancelScoutFetch(false);
    this.farmCamera = { cx: this.renderer.camera.cx, cy: this.renderer.camera.cy, zoom: this.renderer.camera.zoom, viewW: this.renderer.camera.viewW, viewH: this.renderer.camera.viewH };
    this.townActor = { avatar: this.state.player.avatar, ...TOWN_SPAWN, walking: false };
    this.townFacing = 'north'; this.townTarget = null; this.townGesture = null; this.mode = 'town';
    recordFarmStat(this.state, 'farmTownVisits');
    this.renderer.centerOnTown(); this.hud.setMode('town');
    toast('Welcome to the County Service Center.', 'good');
  }

  private requestReturnToFarm(): void {
    if (this.mode !== 'town') return;
    if (this.pickupAtTown) { this.returnToFarm('pickup'); return; }
    this.walkTownNear(TOWN_EXIT.x, TOWN_EXIT.y, () => this.returnToFarm());
  }

  private openCountyKitchen(): void {
    this.dispatch(offerCountyKitchenDelivery(this.state));
    openCountyKitchen(this.state, this.panelActions());
  }

  private cancelTownWalk(): boolean {
    const cancellation = cancelTownMovement(this.townTarget);
    if (!cancellation.cancelled) return false;
    this.townTarget = cancellation.target;
    this.townActor.walking = cancellation.walking;
    toast('Town walk cancelled.', 'good');
    return true;
  }

  private returnToFarm(arrival: 'gate' | 'pickup' = 'gate'): void {
    if (this.mode !== 'town') return;
    hideActionMenu(); if (isPanelOpen()) closePanel();
    this.hover = null; this.townHover = null; this.fieldDragSelection = [];
    this.townTarget = null; this.townActor.walking = false; this.townGesture = null; this.mode = 'farm';
    const drovePickupHome = arrival === 'pickup' && this.pickupAtTown;
    const home = drovePickupHome ? pickupHomeArrival() : null;
    const returnPoint = home ? home.player : placePlayerAtTownReturn(this.state);
    if (home) {
      const pickup = farmOf(this.state).pickup;
      pickup.x = home.pickup.x; pickup.y = home.pickup.y;
      this.state.player.px = home.player.x; this.state.player.py = home.player.y;
      this.pickupAtTown = false;
    }
    this.playerActor.x = returnPoint.x; this.playerActor.y = returnPoint.y; this.playerActor.walking = false;
    if (drovePickupHome) {
      const pad = farmWorldPoint(farmLandmarks().cargoPad);
      this.renderer.camera.centerOnTile(pad.x, pad.y);
      if (this.farmCamera) this.renderer.camera.zoom = this.farmCamera.zoom;
      this.renderer.clampFarmCamera();
    } else if (this.farmCamera && this.farmCamera.viewW === this.renderer.camera.viewW && this.farmCamera.viewH === this.renderer.camera.viewH) {
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
    toast(drovePickupHome ? 'Pickup parked at the barn cargo pad. You are beside it.' : 'Back at the farm.', 'good');
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

  private openCropChooser(returnTo?: { plotUid: number; sx: number; sy: number }): void {
    if (this.mode !== 'farm' || this.manualActionBlocksUi()) return;
    openPanel({ title: 'Choose Crop', className: 'panel-crop-chooser', body: (body) => {
      const farm = farmOf(this.state);
      body.append(h('p', { class: 'panel-note' }, 'Choose an unlocked crop. Seed quantities are exact; number keys 1–8 remain available on the farm.'));
      const list = h('div', { class: 'crop-chooser-list', role: 'list' });
      for (const [index, def] of allFarmCrops().entries()) {
        const unlock = farmCropUnlockInfo(this.state, def.id);
        if (!unlock.unlocked) continue;
        if (returnTo && (farm.seeds[def.id] ?? 0) <= 0) continue;
        const button = h('button', { class: `crop-chooser-row ${farm.selectedCropId === def.id ? 'active' : ''}`, type: 'button', 'data-testid': `choose-${def.id}`, 'aria-pressed': farm.selectedCropId === def.id ? 'true' : 'false', onclick: () => { this.dispatch(selectFarmCrop(this.state, def.id)); closePanel(); if (returnTo) this.openPlotMenu(returnTo.plotUid, returnTo.sx, returnTo.sy); } }, spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-md'), h('span', { class: 'crop-chooser-name' }, `${index + 1}. ${def.name}`), h('strong', {}, `${farm.seeds[def.id] ?? 0} seeds`));
        list.append(button);
      }
      const locked = allFarmCrops().filter((def) => !farmCropUnlockInfo(this.state, def.id).unlocked);
      if (locked.length) list.append(h('details', { class: 'crop-chooser-locked' }, h('summary', {}, `${locked.length} more crops locked`), h('div', {}, locked.map((def) => `${def.name} · ${farmCropUnlockInfo(this.state, def.id).requirement}`).join(' · '))));
      body.append(list);
    } });
  }

  private openFarmInventory(): void {
    if (this.mode !== 'farm') return;
    openPanel({ title: 'Farm Inventory', className: 'panel-wide panel-farm-inventory', body: (body) => {
      const farm = farmOf(this.state);
      body.append(h('div', { class: 'farm-panel-summary inventory-capacity' }, h('strong', {}, `Storage · ${formatFarmCapacity(storageUsed(this.state), farm.storageCapacity)}`), h('span', {}, `Pickup · ${formatFarmCapacity(pickupCargoUsed(this.state), pickupCargoCapacity(this.state))}`)));
      const produce = h('div', { class: 'inventory-section' }, h('h3', {}, 'Produce in storage'));
      for (const def of allFarmCrops()) { const count = farm.storage[def.id] ?? 0; if (count > 0) produce.append(h('div', { class: 'inventory-row' }, spriteImg(`icon:produce_${def.id.replace('crop_', '')}`, 'icon-sm'), h('span', {}, def.name), h('strong', {}, String(count)))); }
      if (produce.childElementCount === 1) produce.append(h('p', { class: 'panel-note' }, 'No produce stored yet.'));
      const seeds = h('div', { class: 'inventory-section' }, h('h3', {}, 'Seed bags'));
      for (const def of allFarmCrops()) { const count = farm.seeds[def.id] ?? 0; if (count > 0) seeds.append(h('div', { class: 'inventory-row' }, spriteImg(`icon:seed_${def.id.replace('crop_', '')}`, 'icon-sm'), h('span', {}, def.name), h('strong', {}, String(count)))); }
      body.append(produce, seeds, h('div', { class: 'inventory-actions' }, h('button', { class: 'btn btn-primary', 'data-testid': 'inventory-load-produce', onclick: () => openFarmMarket(this.state, this.panelActions(), 'farm') }, 'Load Produce for Town'), h('button', { class: 'btn', 'data-testid': 'inventory-view-upgrades', onclick: () => this.openEquipmentPanel() }, 'View Equipment Upgrades'), h('button', { class: 'btn', 'data-testid': 'inventory-barn-upgrades', onclick: () => openCountyWorkOrder(this.state, this.panelActions()) }, 'View Barn Upgrades')));
    } });
  }

  private openBasketMenu(): void {
    if (!handBasketHasCargo(this.state) || this.manualActionBlocksUi()) return;
    const farm = farmOf(this.state);
    showActionMenu(window.innerWidth / 2, window.innerHeight - 80, `Basket · ${handBasketUsed(this.state)} / ${HAND_BASKET_CAPACITY}`, [
      { label: 'Unload to Barn', disabled: farm.storageCapacity - storageUsed(this.state) < handBasketUsed(this.state), onClick: () => { this.dispatch(setHarvestDestination(this.state, 'barn')); this.requestBasketUnload(); } },
      { label: 'Unload to Pickup', disabled: this.pickupAtTown || pickupCargoCapacity(this.state) - pickupCargoUsed(this.state) < handBasketUsed(this.state), onClick: () => { this.dispatch(setHarvestDestination(this.state, 'pickup')); this.requestBasketUnload(); } },
    ]);
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

  private cancelScoutFetch(notice = true): void {
    if (!this.scoutFetch) return;
    this.scoutFetch = null;
    if (notice) toast('Scout leaves the frisbee and heads back.', 'good');
  }

  private notifyScoutOverlap(): void {
    const now = this.gameNow();
    if (now - this.scoutOverlapToastAt < 1_500) return;
    this.scoutOverlapToastAt = now;
    toast('Scout is helping here. Pet him when he is back on open grass.', 'good');
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
    if (!this.operatingTractor && handBasketHasCargo(this.state)) {
      toast('Unload the harvest basket before operating the tractor.', 'bad');
      return;
    }
    this.cancelScoutFetch(false);
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
      toast('Operating the old tractor. WASD/arrow keys or click/right-click ground to drive.', 'good');
    }
    this.hud.update(this.state, this.tractorHudRuntime());
    this.farmAudio.playTransaction('success');
  }

  private switchTractorToPickup(): void {
    if (!this.operatingTractor || this.tractorJob) return;
    this.cancelScoutFetch(false);
    this.tractorTarget = null;
    this.tractorMotion = resetTractorMotion(this.tractorMotion);
    this.operatingTractor = false;
    this.operatingPickup = true;
    this.pickupTarget = null;
    this.pickupMotion = resetTractorMotion(this.pickupMotion);
    this.walkTarget = null;
    this.playerActor.walking = false;
    this.fieldDragSelection = [];
    toast('Switched from the tractor to the pickup.', 'good');
    this.hud.update(this.state, this.tractorHudRuntime());
    this.farmAudio.playTransaction('success');
  }

  private switchPickupToTractor(): void {
    const tractor = farmOf(this.state).equipment.tractor;
    if (!this.operatingPickup) return;
    if (tractor.status !== 'operational') {
      toast('Restore the inherited tractor at the County Equipment Desk before operating it.', 'bad');
      return;
    }
    this.cancelScoutFetch(false);
    this.pickupTarget = null;
    this.pickupMotion = resetTractorMotion(this.pickupMotion);
    this.operatingPickup = false;
    this.operatingTractor = true;
    this.tractorTarget = null;
    this.tractorMotion = resetTractorMotion(this.tractorMotion);
    this.walkTarget = null;
    this.playerActor.walking = false;
    this.fieldDragSelection = [];
    toast('Switched from the pickup to the tractor.', 'good');
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
            h('div', { class: 'farm-card-title' }, `Cargo · ${pickupCargoUsed(this.state)} / ${pickupCargoCapacity(this.state)}`),
            h('div', { class: 'farm-panel-summary' }, 'County services use cargo in this pickup.'),
            h('button', { class: 'btn btn-primary', onclick: () => openFarmSeedShop(this.state, this.panelActions()) }, 'Buy Seed Bags'),
            h('button', { class: 'btn', onclick: () => openFarmMarket(this.state, this.panelActions(), 'town') }, 'Sell / Deliver Produce'),
            h('button', { class: 'btn btn-primary', 'data-testid': 'drive-pickup-home', onclick: () => { closePanel(); this.returnToFarm('pickup'); } }, 'Drive Pickup Home'),
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
          h('div', { class: 'farm-card-title' }, `Cargo · ${formatFarmCapacity(pickupCargoUsed(this.state), pickupCargoCapacity(this.state))}`),
          h('div', { class: 'farm-panel-summary' }, `Cargo: ${formatFarmCapacity(pickupCargoUsed(this.state), pickupCargoCapacity(this.state))} · ${atPad ? 'Parked at the barn cargo pad.' : 'Drive to the barn cargo pad to manage cargo.'}`),
          ...(!atPad ? [h('button', { class: 'btn btn-primary', 'data-testid': 'drive-pickup-to-cargo-pad', onclick: () => this.drivePickupToCargoPad() }, 'Drive to Barn Cargo Pad')] : []),
          h('button', { class: `btn ${atPad ? 'btn-primary' : ''}`, 'data-testid': this.operatingPickup ? 'exit-pickup' : 'operate-pickup', onclick: () => { closePanel(); this.togglePickupOperating(); } }, this.operatingPickup ? 'Exit Pickup' : 'Operate Pickup'),
          ...(atPad ? [
            h('button', { class: 'btn', 'data-testid': 'manage-pickup-cargo', onclick: () => { closePanel(); openFarmMarket(this.state, this.panelActions(), 'farm'); } }, 'Load / Unload Produce'),
            h('button', { class: 'btn', 'data-testid': 'manage-pickup-seeds', onclick: () => { closePanel(); openFarmSeedShop(this.state, this.panelActions()); } }, 'Load / Unload Seed Bags'),
          ] : []),
        ),
      ),
    });
  }

  private drivePickupToCargoPad(): void {
    if (this.operatingTractor || this.tractorJob || this.tractorTarget) {
      toast('Exit the tractor before moving the pickup.', 'bad');
      return;
    }
    closePanel();
    if (!this.operatingPickup) this.togglePickupOperating();
    const pad = farmLandmarks().cargoPad;
    this.drivePickupTo(pad.x, pad.y, () => {
      if (this.operatingPickup) this.togglePickupOperating();
      toast('Pickup parked at the barn cargo pad. Cargo controls are ready.', 'good');
      this.openPickupPanel();
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
        h('button', { class: 'btn', onclick: () => openPanel({ title: 'How to Play', body: (help) => help.append(h('p', {}, 'Drag across owned field sections to highlight any rectangular work area, then choose Prepare, Plant, Water, Harvest, or Clear. A planting selection uses the active crop and stops cleanly when its seeds run out. Number keys 1–8 select crops. On a touchscreen, drag open ground to pan and pinch anywhere on the farm to zoom.'), h('p', {}, 'Prepare rough soil, plant, then water new seedlings to start growth. Ready crops remain harvestable for one active hour. Manual harvests fill your visible basket; use Harvest → Barn/Pickup on the bottom bar to choose where each basket is carried.'), h('p', {}, 'Cargo uses crop quantities and abstract capacity. Park the pickup at the marked barn cargo pad to load, then drive it to the County Grain Exchange to sell or deliver.'), h('p', {}, 'Completing the Pantry delivery unlocks tractor restoration and its harvest wagon. Operated harvest loads that wagon—not the barn—so drive the tractor to the barn receiving bay to unload.')) }) }, 'How to Play'),
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
      onWorkforce: () => this.openWorkforcePanel('farm'),
      onRoadsideStand: () => this.openRoadsideStand('farm'),
    });
  }

  private openWorkforcePanel(context: 'farm' | 'town' = this.mode): void {
    const jobs = (['mara-bell', 'eliot-reyes'] as const).flatMap((workerId) => {
      const job = this.workerRuntime[workerId].job ?? (workerId === 'mara-bell' ? this.farmhandJob : null);
      return job ? [{ workerId, parcelId: job.parcelId, kind: job.kind, completed: job.completed, skipped: job.skipped, total: job.targetPlotUids.length }] : [];
    });
    openFarmWorkforce(this.state, {
      context,
      now: this.gameNow(),
      activeJobs: jobs,
      hire: context === 'town' ? () => hireFirstFarmhand(this.state) : undefined,
      hireManager: context === 'town' ? () => hireFarmManager(this.state) : undefined,
      hireEliot: context === 'town' ? () => hireEliotReyes(this.state) : undefined,
      purchaseOfficeQuarters: context === 'town' ? () => { const result = purchaseFarmsteadOfficeQuarters(this.state); if (result.ok) this.save(); return result; } : undefined,
      updateManager: context === 'farm' ? (input) => { const result = updateFarmManagerPlan(this.state, input); if (result.ok) this.save(); return result; } : undefined,
      updateSlot: context === 'farm' ? (input) => { const result = updateWorkerPlanSlot(this.state, input); if (result.ok) this.save(); return result; } : undefined,
      approveDispatch: context === 'farm' ? () => { const result = approveWorkforceDispatch(this.state); if (result.ok) this.save(); return result; } : undefined,
      dispatchManager: context === 'farm' ? () => this.dispatchFarmManager() : undefined,
      startWork: context === 'farm' ? (parcelId, kind) => this.startFarmhandJob(parcelId, kind) : undefined,
      cancelWork: context === 'farm' ? (workerId) => workerId === 'mara-bell' && this.farmhandJob ? this.cancelFarmhandJob() : this.cancelWorkerJob(workerId) : undefined,
      dispatch: this.dispatch,
      onClose: () => {},
    });
  }

  private openRoadsideStand(context: 'farm' | 'town' = this.mode): void {
    openFarmRoadsideStand(this.state, {
      context,
      purchase: context === 'town' ? () => purchaseRoadsideStand(this.state) : undefined,
      fulfill: context === 'farm' ? (orderId) => fulfillRoadsideStandOrder(this.state, orderId) : undefined,
      dispatch: this.dispatch,
    });
  }

  private togglePickupOperating(): void {
    if (this.operatingTractor || this.tractorJob || this.tractorTarget) {
      toast('Exit the tractor before operating the pickup.', 'bad');
      return;
    }
    this.cancelScoutFetch(false);
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
      toast('Operating the old pickup. WASD/arrow keys or click/right-click ground to drive.', 'good');
    }
    this.hud.update(this.state, this.tractorHudRuntime());
    this.farmAudio.playTransaction('success');
  }

  private openScoutMenu(): void {
    const point = farmWorldPoint(this.scout);
    const sx = this.renderer.camera.sx(isoX(point.x, point.y));
    const sy = this.renderer.camera.sy(isoY(point.x, point.y));
    showActionMenu(sx, sy, 'Scout · corgi companion', [{
      label: 'Give scratches',
      onClick: () => {
        this.scoutScratchUntil = this.gameNow() + 1_200;
        this.farmAudio.playTransaction('scout');
        toast('Scout wags and leans into the scratches.', 'good');
      },
    }, {
      label: 'Play fetch',
      onClick: () => {
        this.cancelScoutApproach();
        this.scoutFetch = { phase: 'outbound', target: { x: 7.95, y: 12.3 }, throwFrom: { x: this.playerActor.x, y: this.playerActor.y }, phaseStartedAt: this.gameNow() };
        this.farmAudio.playTransaction('scout');
        toast('Frisbee away! Scout is on it.', 'good');
      },
    }]);
  }

  private driveTractorTo(x: number, y: number, cb: (() => void) | null = () => toast('Tractor parked.', 'good')): void {
    if (!this.operatingTractor || this.tractorJob) return;
    this.tractorTarget = {
      x,
      y,
      cb,
    };
  }

  private driveTractorToReceivingBay(): void {
    if (!this.operatingTractor) return;
    const bay = farmLandmarks().cargoPad;
    this.driveTractorTo(bay.x, bay.y, () => {
      const result = unloadHarvestWagonToBarn(this.state);
      this.dispatch(result);
      if (result.ok) {
        // The authoritative cargo mutation must survive even if the later
        // presentation-only return drive is interrupted or the app closes.
        this.save();
        this.driveTractorTo(TRACTOR_HOME_PARKING.x, TRACTOR_HOME_PARKING.y, () => {
          this.save();
          toast('Harvest wagon unloaded. Tractor returned to its parking bay.', 'good');
        });
      }
    });
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

  private openTractorParcelMenu(parcelId: FarmParcelId, anchorPlotUid: number, tx: number, ty: number, sx: number, sy: number): void {
    const plan = planParcelWork(this.state, parcelId, this.gameNow(), farmOf(this.state).selectedCropId, { anchorPlotUid });
    const parcel = farmParcelDef(parcelId);
    this.showTractorWorkMenu(parcelId, plan, tx, ty, sx, sy, `${parcel.name} · ${parcel.columns}×${parcel.rows} tractor work`);
  }

  private showTractorDragMenu(
    sx: number,
    sy: number,
    selectedPlotUids: readonly number[],
    anchorPlotUid: number,
  ): void {
    if (selectedPlotUids.length === 0 || !this.operatingTractor) return;
    const anchor = this.state.plots.find((plot) => plot.uid === anchorPlotUid);
    if (!anchor) return;
    const parcelId = ownedFarmParcelAt(this.state, anchor.x, anchor.y);
    if (!parcelId || this.farmhandJob?.parcelId === parcelId) {
      this.fieldDragSelection = [];
      return;
    }
    const plan = planParcelWork(this.state, parcelId, this.gameNow(), farmOf(this.state).selectedCropId, {
      anchorPlotUid,
      selectedPlotUids,
    });
    this.showTractorWorkMenu(
      parcelId,
      plan,
      anchor.x,
      anchor.y,
      sx,
      sy,
      `${selectedPlotUids.length} field section${selectedPlotUids.length === 1 ? '' : 's'} selected · tractor`,
    );
  }

  private showTractorWorkMenu(
    parcelId: FarmParcelId,
    plan: ParcelWorkPlan,
    tx: number,
    ty: number,
    sx: number,
    sy: number,
    title: string,
  ): void {
    const farm = farmOf(this.state);
    const crop = farmCropDef(farm.selectedCropId);
    const cropUnlock = farmCropUnlockInfo(this.state, crop.id);
    const seedCount = farm.seeds[crop.id] ?? 0;
    showActionMenu(sx, sy, title, [
      {
        label: cropUnlock.unlocked
          ? `Prepare & plant ${crop.name} on ${plan.plantPlotUids.length} field section${plan.plantPlotUids.length === 1 ? '' : 's'} (${seedCount} seeds)`
          : `${crop.name} locked: ${cropUnlock.requirement}`,
        icon: `icon:seed_${crop.id.replace('crop_', '')}`,
        disabled: !cropUnlock.unlocked || plan.plantPlotUids.length === 0,
        onClick: () => {
          this.fieldDragSelection = [];
          this.startTractorJob('plant', parcelId, plan.plantPlotUids, crop.id);
        },
      },
      {
        label: plan.harvestPlotUids.length > 0
          ? `Harvest wagon · ${plan.readyHarvestPlotUids.length} ready · ${plan.harvestPlotUids.length} fits (${plan.harvestOpenCapacity} open)`
          : plan.readyHarvestPlotUids.length > 0
            ? `Wagon needs unloading · ${plan.harvestOpenCapacity} open · next section ${plan.nextHarvestRequiredCapacity}`
            : 'No ready field sections selected',
        icon: 'fx:ready',
        disabled: plan.harvestPlotUids.length === 0,
        onClick: () => {
          this.fieldDragSelection = [];
          this.startTractorJob('harvest', parcelId, plan.harvestPlotUids);
        },
      },
      ...(plan.readyHarvestPlotUids.length > 0 && plan.harvestPlotUids.length === 0 ? [{
        label: 'Drive to barn receiving bay to unload wagon',
        onClick: () => this.driveTractorToReceivingBay(),
      }] : []),
      {
        label: 'Drive to selected field section',
        onClick: () => {
          this.fieldDragSelection = [];
          this.driveTractorTo(tx, ty);
        },
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
      const preferredCropId = this.resolvePlantingCrop();
      const def = farmCropDef(preferredCropId);
      const count = farm.seeds[def.id] ?? 0;
      const rotation = rotationPreview(plot, def.id);
      this.showManualScopeMenu(
        sx, sy, `Prepared soil · ${def.name} · ${count} seed${count === 1 ? '' : 's'} · ${rotation.bonusMs ? 'Rotation +10%' : rotation.lastHarvestFamily ? 'Same family' : 'First crop'}`,
        'plant', plotUid, def.id, count > 0
          ? [{ label: 'Change crop', onClick: () => this.openCropChooser({ plotUid, sx, sy }) }]
          : [{ label: 'No stocked seeds · buy in town, then unload at the barn', onClick: () => this.openFarmhouseOffice() }],
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
        label: `Growing · ${Math.max(1, Math.ceil((farmGrowthReadyAt(plot.crop) - now) / 1000))}s remaining${plot.crop.rotationBonusMs ? ' · rotation boost' : ''}`,
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
    this.cancelScoutFetch(false);
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
    const heldSeed = job.kind === 'plant' ? this.workerReservations.heldSeeds(String(job.cropId)) : 0;
    const result = this.workerReservations.isClaimed(plotUid)
      ? { ok: false, reason: 'This field section is reserved for an approved worker assignment.' }
      : job.kind === 'plant' && (farmOf(this.state).seeds[String(job.cropId)] ?? 0) <= heldSeed
      ? { ok: false, reason: 'Seed stock is reserved for an approved worker assignment.' }
      : job.kind === 'plant'
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
      if (job.kind === 'harvest') this.save();
    } else {
      job.skipped += 1;
      job.lastFailure = result.reason || 'The field section was no longer eligible.';
      if (job.kind === 'harvest' && result.reason?.startsWith('Harvest wagon full:')) {
        this.tractorJob = null;
        this.tractorTarget = null;
        toast(`${result.reason} Harvest paused with completed sections safely in the wagon.`, 'bad');
        this.hud.update(this.state, this.tractorHudRuntime());
        return;
      }
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

  private tractorHudRuntime(): { operating: boolean; working: boolean; activeVehicle: 'tractor' | 'pickup' | null; statusText: string; manualWorking?: boolean; farmhandWorking?: boolean; canCancel?: boolean } {
    if (this.basketUnload) {
      const destination = this.basketUnload.destination === 'pickup' ? 'pickup' : 'barn';
      return {
        operating: false,
        working: false,
        activeVehicle: null,
        manualWorking: true,
        canCancel: true,
        statusText: `Carrying harvest basket · ${handBasketUsed(this.state)} / ${HAND_BASKET_CAPACITY} · walking to ${destination}`,
      };
    }
    const manualJob = this.manualFieldJob;
    if (manualJob) {
      const total = manualJob.targetPlotUids.length;
      const current = Math.min(total, manualJob.nextIndex + 1);
      const action = this.manualFieldAction;
      const progress = action ? Math.round(manualFieldActionProgress(action, this.gameNow()) * 100) : 0;
      return {
        operating: false,
        working: false,
        activeVehicle: null,
        manualWorking: true,
        canCancel: true,
        statusText: `${MANUAL_FIELD_ACTION_LABELS[manualJob.kind]} · ${manualJob.completed}/${total} complete${manualJob.skipped ? ` · ${manualJob.skipped} skipped` : ''} · section ${current}/${total}${action ? ` · ${progress}%` : ''}`,
      };
    }
    const manual = this.manualFieldAction;
    if (manual) {
      const progress = Math.round(manualFieldActionProgress(manual, this.gameNow()) * 100);
      return {
        operating: false,
        working: false,
        activeVehicle: null,
        manualWorking: true,
        canCancel: true,
        statusText: `${MANUAL_FIELD_ACTION_LABELS[manual.kind]} · ${progress}%`,
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
        activeVehicle: 'tractor',
        canCancel: true,
        statusText: `${job.kind === 'plant' ? 'Planting' : 'Harvesting'}${cropLabel} · ${job.completed}/${total} completed${job.skipped ? ` · ${job.skipped} skipped` : ''} · section ${current}/${total}`,
      };
    }
    if (this.operatingTractor && this.tractorTarget) {
      return { operating: true, working: false, activeVehicle: 'tractor', canCancel: true, statusText: 'Driving tractor' };
    }
    if (this.operatingPickup && this.pickupTarget) {
      return { operating: true, working: false, activeVehicle: 'pickup', canCancel: true, statusText: 'Driving pickup' };
    }
    const farmhandJob = this.farmhandJob;
    if (farmhandJob) {
      const total = farmhandJob.targetPlotUids.length;
      const current = Math.min(total, farmhandJob.nextIndex + 1);
      const progress = this.farmhandAction ? Math.round(manualFieldActionProgress(this.farmhandAction, this.gameNow()) * 100) : 0;
      return {
        operating: this.operatingTractor,
        working: false,
        activeVehicle: this.operatingTractor ? 'tractor' : this.operatingPickup ? 'pickup' : null,
        farmhandWorking: true,
        canCancel: true,
        statusText: `${FIRST_FARMHAND.name} · ${MANUAL_FIELD_ACTION_LABELS[farmhandJob.kind]} · ${farmhandJob.completed}/${total} complete${farmhandJob.skipped ? ` · ${farmhandJob.skipped} skipped` : ''} · section ${current}/${total}${this.farmhandAction ? ` · ${progress}%` : ''}`,
      };
    }
    return {
      operating: this.operatingTractor || this.operatingPickup,
      working: false,
      activeVehicle: this.operatingTractor ? 'tractor' : this.operatingPickup ? 'pickup' : null,
      statusText: this.operatingTractor
        ? 'Operating old tractor · WASD/arrow keys or click/right-click ground to drive'
        : this.operatingPickup ? 'Operating old pickup · WASD/arrow keys or click/right-click ground to drive' : '',
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
    const actionName = kind === 'prepare' ? 'Prepare' : kind === 'rework' ? 'Rework' : kind === 'plant' && cropId ? `Plant ${farmCropDef(cropId).name}` : kind === 'water' ? 'Water' : kind === 'harvest' ? 'Harvest' : 'Clear';
    const actionIcon = icon ?? (kind === 'plant' && cropId ? `icon:seed_${cropId.replace('crop_', '')}` : undefined);
    const anchor = this.state.plots.find((plot) => plot.uid === anchorPlotUid);
    const parcelId = anchor ? ownedFarmParcelAt(this.state, anchor.x, anchor.y) : null;
    const acreage = parcelId ? manualFieldAcreagePlotUids(this.state, anchorPlotUid) : [];
    const whole = this.manualTargetsFromPlotUids(kind, acreage, cropId);
    const eligibleWhole = this.manualEligibleTargetsFromPlotUids(kind, acreage, cropId);
    const scopes: { scope: ManualFieldSelectionScope; label: string }[] = [
      { scope: 'section', label: 'this section' },
      { scope: 'row', label: 'this row' },
      { scope: 'three-rows', label: '3-row block' },
    ];
    const secondary = scopes.flatMap(({ scope, label }) => {
        const targets = this.manualTargetsFor(kind, anchorPlotUid, scope, cropId);
        if (targets.length === 0) return [];
        return [{
          label: `${actionName} ${label} · ${targets.length} section${targets.length === 1 ? '' : 's'}`,
          icon: actionIcon,
          onClick: () => this.startManualSelection(kind, anchorPlotUid, scope, cropId),
        }];
      });
    const primary = whole.length > 0 ? [{
      label: kind === 'plant' && whole.length < eligibleWhole.length
        ? `${actionName} ${whole.length} of ${eligibleWhole.length} prepared sections · ${farmOf(this.state).seeds[cropId ?? ''] ?? 0} seeds available`
        : `${actionName} all matching sections · ${whole.length}`,
      icon: actionIcon,
      onClick: () => this.startManualTargetList(kind, whole, 'selection', cropId),
    }] : [];
    const dragCue = [{ label: 'Drag for a custom selection', onClick: () => toast('Drag across field sections for a custom selection.', 'good') }];
    showActionMenu(sx, sy, `${title} · ${whole.length || 0} matching in this acreage`, [
      ...primary,
      ...secondary,
      ...dragCue,
      ...extraActions,
    ]);
  }

  private resolvePlantingCrop(): string {
    const farm = farmOf(this.state);
    const current = farmCropDef(farm.selectedCropId);
    if (farm.seeds[current.id] > 0 && isFarmCropUnlocked(this.state, current.id)) return current.id;
    const recent = [...this.state.plots]
      .filter((plot) => plot.crop && isFarmCropUnlocked(this.state, plot.crop.defId) && (farm.seeds[plot.crop.defId] ?? 0) > 0)
      .sort((a, b) => (b.crop?.plantedAt ?? 0) - (a.crop?.plantedAt ?? 0))[0]?.crop?.defId;
    const fallback = recent ?? allFarmCrops().find((def) => isFarmCropUnlocked(this.state, def.id) && (farm.seeds[def.id] ?? 0) > 0)?.id;
    if (fallback) farm.selectedCropId = fallback;
    return fallback ?? farm.selectedCropId;
  }

  private manualTargetsFor(
    kind: ManualFieldActionKind,
    anchorPlotUid: number,
    scope: ManualFieldSelectionScope,
    cropId?: string,
  ): number[] {
    return this.manualTargetsFromPlotUids(
      kind,
      manualFieldSelectionPlotUids(this.state, anchorPlotUid, scope),
      cropId,
    );
  }

  private manualEligibleTargetsFromPlotUids(
    kind: ManualFieldActionKind,
    plotUids: readonly number[],
    cropId?: string,
  ): number[] {
    const now = this.gameNow();
    return plotUids.filter((plotUid) => {
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
  }

  private manualTargetsFromPlotUids(
    kind: ManualFieldActionKind,
    plotUids: readonly number[],
    cropId?: string,
  ): number[] {
    const targets = this.manualEligibleTargetsFromPlotUids(kind, plotUids, cropId);
    if (kind !== 'plant' || !cropId) return targets;
    return targets.slice(0, Math.max(0, farmOf(this.state).seeds[cropId] ?? 0));
  }

  private showManualDragMenu(sx: number, sy: number, selectedPlotUids: readonly number[]): void {
    if (selectedPlotUids.length === 0) return;
    const cropId = farmOf(this.state).selectedCropId;
    const crop = farmCropDef(cropId);
    const actions: { label: string; disabled?: boolean; icon?: string; onClick: () => void }[] = [];
    const specs: { kind: ManualFieldActionKind; label: string; icon?: string }[] = [
      { kind: 'prepare', label: 'Prepare soil' },
      { kind: 'rework', label: 'Rework stubble' },
      { kind: 'plant', label: `Plant ${crop.name}`, icon: `icon:seed_${cropId.replace('crop_', '')}` },
      { kind: 'water', label: 'Water seedlings' },
      { kind: 'harvest', label: 'Harvest crops' },
      { kind: 'clear', label: 'Clear withered crops' },
    ];
    for (const spec of specs) {
      const eligible = this.manualEligibleTargetsFromPlotUids(spec.kind, selectedPlotUids, cropId);
      if (eligible.length === 0) continue;
      const targets = this.manualTargetsFromPlotUids(spec.kind, selectedPlotUids, cropId);
      const seedLimited = spec.kind === 'plant' && targets.length < eligible.length;
      actions.push({
        label: `${spec.label} · ${targets.length}${seedLimited ? ` of ${eligible.length} · ${farmOf(this.state).seeds[cropId] ?? 0} seeds` : ' eligible'}`,
        icon: spec.icon,
        disabled: targets.length === 0,
        onClick: () => {
          this.fieldDragSelection = [];
          this.startManualTargetList(spec.kind, targets, 'selection', spec.kind === 'plant' ? cropId : undefined);
        },
      });
    }
    if (actions.length === 0) actions.push({ label: 'No eligible work in this selection', disabled: true, onClick: () => {} });
    showActionMenu(sx, sy, `${selectedPlotUids.length} field section${selectedPlotUids.length === 1 ? '' : 's'} selected`, actions);
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
    this.startManualTargetList(kind, targets, scope, cropId);
  }

  private startManualTargetList(
    kind: ManualFieldActionKind,
    targets: readonly number[],
    scope: ManualFieldSelectionScope | 'selection',
    cropId?: string,
  ): void {
    if (targets.length === 0) return;
    this.cancelScoutFetch(false);
    if (targets.length === 1 || scope === 'section') {
      if (kind === 'harvest') {
        const readiness = inspectBasketHarvest(this.state, targets[0], this.gameNow());
        if (readiness.ok && Number(readiness.capacityUnits) > handBasketRemaining(this.state) && handBasketHasCargo(this.state)) {
          this.beginBasketUnload(
            () => this.startManualTargetList(kind, targets, scope, cropId),
            (reason) => toast(`${reason} The selected crop remains ready in the field.`, 'bad'),
          );
          return;
        }
      }
      this.startManualFieldAction(kind, targets[0], () => this.applyManualFieldAction(kind, targets[0], cropId));
      return;
    }
    this.manualFieldJob = {
      kind,
      scope,
      cropId,
      targetPlotUids: [...targets],
      nextIndex: 0,
      completed: 0,
      skipped: 0,
    };
    const label = scope === 'row' ? 'Row' : scope === 'three-rows' ? 'Three-row block' : 'Custom area';
    toast(`${label} selected · ${targets.length} eligible section${targets.length === 1 ? '' : 's'} · Cancel stops unfinished work.`, 'good');
    this.beginManualFieldJobStep();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private applyManualFieldAction(
    kind: ManualFieldActionKind,
    plotUid: number,
    cropId?: string,
    harvestToBasket = true,
    workerId?: FarmWorkerId,
  ): ActionResult {
    if (!workerId && this.workerReservations.isClaimed(plotUid)) return { ok: false, reason: 'This field section is reserved for an approved worker assignment.' };
    if (!workerId && kind === 'plant' && (farmOf(this.state).seeds[String(cropId)] ?? 0) <= this.workerReservations.heldSeeds(String(cropId))) return { ok: false, reason: 'Seed stock is reserved for an approved worker assignment.' };
    if (kind === 'prepare' || kind === 'rework') return tillFarmField(this.state, plotUid);
    if (kind === 'plant') return plantFarmCrop(this.state, plotUid, String(cropId), this.gameNow(), 'manual');
    if (kind === 'water') return waterFarmCrop(this.state, plotUid, this.gameNow());
    if (kind === 'harvest') {
      const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
      const harvestedCropId = plot?.crop?.defId;
      const result = harvestToBasket
      ? harvestFarmCropToBasket(this.state, plotUid, this.gameNow())
      : harvestFarmCrop(this.state, plotUid, this.gameNow(), 'manual');
      if (shouldTriggerFarmHarvestFeedback(result.ok, harvestToBasket, harvestedCropId) && plot) {
        this.harvestFeedback = { x: plot.x, y: plot.y, cropId: harvestedCropId!, startedAt: this.gameNow() };
      }
      return result;
    }
    return clearWitheredFarmCrop(this.state, plotUid, this.gameNow());
  }

  private startFarmhandJob(parcelId: FarmParcelId, kind: FarmhandWorkKind, cropId = farmOf(this.state).selectedCropId): ActionResult {
    if (kind === 'clear') return { ok: false, reason: 'Workers do not clear withered crops.' };
    if (this.farmhandJob || this.workerRuntime['mara-bell'].job) return { ok: false, reason: `${FIRST_FARMHAND.name} already has an acreage assignment.` };
    this.cancelScoutFetch(false);
    return this.startWorkerRuntimeJob('mara-bell', parcelId, kind, cropId);
  }

  private startWorkerRuntimeJob(workerId: FarmWorkerId, parcelId: FarmParcelId, kind: Exclude<FarmhandWorkKind, 'clear'>, cropId: string): ActionResult {
    const runtime = this.workerRuntime[workerId];
    if (runtime.job) return { ok: false, reason: `${workerDefinition(workerId).name} already has an acreage assignment.` };
    if (!workerDispatchAvailable(this.state, workerId)) return { ok: false, reason: `${workerDefinition(workerId).name} has already started a Day ${farmOf(this.state).clock.day} assignment.` };
    const preview = planFarmhandWork(this.state, parcelId, kind, this.gameNow(), cropId);
    const reserved = this.workerReservations.reserve(this.state, { workerId, kind, cropId: preview.cropId, targetPlotUids: preview.targetPlotUids });
    if (!reserved.targetPlotUids.length) { this.workerReservations.release(workerId); return { ok: false, reason: 'No unclaimed eligible field resources are ready for that assignment.' }; }
    const start = startWorkerShift(this.state, workerId, parcelId, kind, this.gameNow(), cropId);
    if (!start.result.ok || !start.plan) { this.workerReservations.release(workerId); return start.result; }
    farmOf(this.state).workforce.workerLastDispatchedDay[workerId] = farmOf(this.state).clock.day;
    runtime.job = { ...reserved, parcelId, nextIndex: 0, completed: 0, skipped: 0 }; runtime.action = null; runtime.target = null;
    this.beginWorkerJobStep(workerId); this.hud.update(this.state, this.tractorHudRuntime());
    this.save();
    return start.result;
  }

  /** Manager dispatch is explicit; opening, loading, and day change never call it. */
  private dispatchFarmManager(): ActionResult {
    const farm = farmOf(this.state);
    if (this.farmhandJob) return { ok: false, reason: `${FIRST_FARMHAND.name} already has an acreage assignment.` };
    if (farm.workforce.dispatchApprovedDay !== farm.clock.day) return { ok: false, reason: 'Approve today’s dispatch from Workforce first.' };
    if (!farm.workforce.manager.hired || !farm.workforce.manager.enabled) return { ok: false, reason: 'Enable the manager acreage plan first.' };
    if (farm.workforce.manager.lastReviewedDay === farm.clock.day) return { ok: false, reason: `Manager dispatch was already reviewed on Day ${farm.clock.day}.` };
    const preview = planFarmManagerDispatch(this.state, this.gameNow());
    if (!preview.targetPlotUids.length) return { ok: false, reason: preview.reason ?? 'No eligible manager assignment is ready.' };
    const result = this.startFarmhandJob(preview.parcelId, preview.kind, preview.cropId ?? farm.workforce.manager.cropId);
    if (!result.ok) return result;
    farm.workforce.manager.lastReviewedDay = farm.clock.day;
    this.save();
    return result;
  }

  private beginWorkerJobStep(workerId: FarmWorkerId): void {
    const runtime = this.workerRuntime[workerId]; const job = runtime.job;
    if (!job || runtime.action || runtime.target) return;
    while (job.nextIndex < job.targetPlotUids.length) {
      const plotUid = job.targetPlotUids[job.nextIndex]; const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
      if (!plot) { job.skipped += 1; job.lastFailure = 'A planned field section was unavailable.'; job.nextIndex += 1; continue; }
      runtime.target = { x: plot.x + .62, y: plot.y + .18, plotUid }; return;
    }
    this.finishWorkerJob(workerId);
  }

  private updateFarmhand(now: number, dt: number): void {
    // Dispatch is only considered from a visible running app update. Loading,
    // hidden/offline time and approving the review card never start or charge a shift.
    const workforce = farmOf(this.state).workforce;
    if (this.mode === 'farm' && workforce.dispatchApprovedDay === farmOf(this.state).clock.day && workforce.manager.hired) {
      for (const review of reviewWorkforceDispatch(this.state, now)) {
        if (review.eligibleCount && !this.workerRuntime[review.workerId].job && workerDispatchAvailable(this.state, review.workerId)) {
          const result = this.startWorkerRuntimeJob(review.workerId, review.parcelId, review.kind as Exclude<FarmhandWorkKind, 'clear'>, review.cropId ?? farmOf(this.state).selectedCropId);
          if (result.ok) workforce.manager.lastReviewedDay = farmOf(this.state).clock.day;
        }
      }
    }
    // V2 has one Mara authority: the generic worker runtime below. Legacy
    // fields remain inert compatibility placeholders and never advance work.
    this.updateWorkerRuntime('mara-bell', now, dt);
  }

  private updateWorkerRuntime(workerId: FarmWorkerId, now: number, dt: number): void {
    if (this.mode !== 'farm') return;
    const runtime = this.workerRuntime[workerId]; const job = runtime.job;
    if (!job) return;
    if (runtime.action) {
      if (!manualFieldActionComplete(runtime.action, now)) return;
      const action = runtime.action; runtime.action = null; const result = action.apply();
      if (result.ok) { job.completed += 1; this.workerReservations.consume(this.state, workerId, job.kind, action.plotUid, job.cropId); }
      else { job.skipped += 1; job.lastFailure = result.reason || 'A field section changed before the worker reached it.'; }
      job.nextIndex += 1; this.beginWorkerJobStep(workerId); return;
    }
    if (runtime.target) {
      const dx = runtime.target.x - runtime.actor.x; const dy = runtime.target.y - runtime.actor.y; const distance = Math.hypot(dx, dy); const step = 4.8 / 1_000 * dt;
      if (distance <= step) { const target = runtime.target; runtime.actor.x = target.x; runtime.actor.y = target.y; runtime.actor.walking = false; runtime.target = null; const plot = this.state.plots.find((candidate) => candidate.uid === target.plotUid); if (plot && target.plotUid !== undefined) runtime.action = { ...createManualFieldAction(job.kind, target.plotUid, plot, now), apply: () => this.applyManualFieldAction(job.kind, target.plotUid!, job.cropId, false, workerId) }; }
      else { runtime.actor.x += dx / distance * step; runtime.actor.y += dy / distance * step; runtime.actor.walking = true; runtime.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north'); }
    }
  }

  private finishWorkerJob(workerId: FarmWorkerId): void {
    const runtime = this.workerRuntime[workerId]; const job = runtime.job; if (!job) return;
    runtime.job = null; runtime.action = null; runtime.target = { ...(workerId === 'mara-bell' ? farmLandmarks().farmhandHome : farmLandmarks().crewHandHome) }; this.workerReservations.release(workerId);
    toast(`${workerDefinition(workerId).name} finished ${farmParcelDef(job.parcelId).name}: ${job.completed} completed${job.skipped ? `, ${job.skipped} skipped` : ''}.`, job.completed > 0 ? 'good' : 'bad'); if (job.completed > 0) this.save();
  }

  private cancelWorkerJob(workerId: FarmWorkerId): void {
    const runtime = this.workerRuntime[workerId]; const job = runtime.job; if (!job) return;
    runtime.job = null; runtime.action = null; runtime.target = { ...(workerId === 'mara-bell' ? farmLandmarks().farmhandHome : farmLandmarks().crewHandHome) }; this.workerReservations.release(workerId);
    toast(`${workerDefinition(workerId).name}'s assignment stopped: ${job.completed} completed; today's shift remains paid.`, 'good'); this.save();
  }

  private cancelFarmhandJob(): void {
    this.farmhandJob = null; this.farmhandAction = null; this.farmhandTarget = null;
    this.cancelWorkerJob('mara-bell'); this.hud.update(this.state, this.tractorHudRuntime());
  }

  private requestBasketUnload(): void {
    const blocked = this.basketInteractionBlockReason();
    if (blocked) {
      toast(blocked, 'bad');
      return;
    }
    if (this.manualActionBlocksUi()) return;
    if (!handBasketHasCargo(this.state)) {
      toast('The harvest basket is empty.', 'bad');
      return;
    }
    this.beginBasketUnload();
  }

  private beginBasketUnload(
    afterSuccess: (() => void) | null = null,
    onFailure: ((reason: string) => void) | null = null,
  ): void {
    const blocked = this.basketInteractionBlockReason();
    if (blocked) {
      toast(blocked, 'bad');
      onFailure?.(blocked);
      return;
    }
    if (!handBasketHasCargo(this.state)) {
      afterSuccess?.();
      return;
    }
    if (this.basketUnload) return;
    const farm = farmOf(this.state);
    const destination = farm.handBasket.destination;
    if (destination === 'pickup' && this.pickupAtTown) {
      const result = unloadHandBasket(this.state, destination, false);
      this.dispatch(result);
      onFailure?.(result.reason ?? 'The pickup is unavailable.');
      return;
    }
    this.cancelScoutFetch(false);
    this.basketUnload = { destination, afterSuccess, onFailure };
    const barn = this.state.placements.find((placement) => placement.defId === 'bld_storage');
    const target = destination === 'pickup'
      ? { x: farm.pickup.x, y: farm.pickup.y }
      : barn ? { x: barn.x + .5, y: barn.y + 1.85 } : farmLandmarks().cargoPad;
    this.walkNear(target.x, target.y, () => {
      const pending = this.basketUnload;
      if (!pending) return;
      this.basketUnload = null;
      const result = unloadHandBasket(this.state, pending.destination, !this.pickupAtTown);
      this.dispatch(result);
      if (result.ok) {
        this.save();
        pending.afterSuccess?.();
      } else {
        pending.onFailure?.(result.reason ?? 'The basket could not be unloaded.');
      }
    });
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private cancelBasketUnload(): void {
    if (!this.basketUnload) return;
    this.basketUnload = null;
    this.walkTarget = null;
    this.playerActor.walking = false;
    toast('Basket walk cancelled. Every harvested crop is still safe in the basket.', 'good');
    this.save();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private stopManualHarvestForUnloadFailure(reason: string): void {
    const job = this.manualFieldJob;
    if (!job) return;
    const untouched = Math.max(0, job.targetPlotUids.length - job.nextIndex);
    this.manualFieldJob = null;
    this.manualFieldAction = null;
    this.basketUnload = null;
    this.walkTarget = null;
    this.playerActor.walking = false;
    const basketUnits = handBasketUsed(this.state);
    const barnFull = farmOf(this.state).storageCapacity - storageUsed(this.state) < basketUnits;
    const pickupFull = pickupCargoCapacity(this.state) - pickupCargoUsed(this.state) < basketUnits;
    const recovery = barnFull && pickupFull
      ? ' Drive the pickup to town to sell cargo and make space, then return to unload the basket.'
      : '';
    toast(`Harvest paused: ${job.completed} completed, ${untouched} not attempted. ${reason} The basket contents remain safe.${recovery}`, 'bad');
    this.save();
    this.hud.update(this.state, this.tractorHudRuntime());
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
      if (job.kind === 'harvest') {
        const readiness = inspectBasketHarvest(this.state, plotUid, this.gameNow());
        if (readiness.ok && Number(readiness.capacityUnits) > handBasketRemaining(this.state) && handBasketHasCargo(this.state)) {
          this.beginBasketUnload(
            () => this.beginManualFieldJobStep(),
            (reason) => this.stopManualHarvestForUnloadFailure(reason),
          );
          return;
        }
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
    this.hover = null;
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
    if (job.kind === 'harvest' && handBasketHasCargo(this.state) && !this.basketUnload) {
      this.beginBasketUnload(
        () => this.finishManualFieldJob(),
        (reason) => this.stopManualHarvestForUnloadFailure(reason),
      );
      return;
    }
    const label = job.scope === 'row' ? 'Row' : job.scope === 'three-rows' ? 'Three-row block' : 'Custom area';
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

  private cancelManualFieldJob(unloadHarvestBasket = true): void {
    const job = this.manualFieldJob;
    if (!job) return;
    const untouched = Math.max(0, job.targetPlotUids.length - job.completed - job.skipped);
    const label = job.scope === 'row' ? 'Row work' : job.scope === 'three-rows' ? 'Three-row work' : 'Custom-area work';
    this.manualFieldJob = null;
    this.manualFieldAction = null;
    this.basketUnload = null;
    this.walkTarget = null;
    this.playerActor.walking = false;
    toast(`${label} cancelled: ${job.completed} completed, ${job.skipped} skipped, ${untouched} not attempted.`, 'good');
    if (job.completed > 0) this.save();
    if (unloadHarvestBasket && job.kind === 'harvest' && handBasketHasCargo(this.state)) this.beginBasketUnload();
    this.hud.update(this.state, this.tractorHudRuntime());
  }

  private manualActionBlocksUi(): boolean {
    if (this.basketUnload) {
      toast('Basket unloading in progress. Use Cancel to stop safely; the harvest stays safe.', 'bad');
      return true;
    }
    const kind = this.manualFieldJob?.kind ?? this.manualFieldAction?.kind;
    if (!kind) return false;
    toast(`${MANUAL_FIELD_ACTION_LABELS[kind]} in progress. Finish it or use Cancel to stop safely.`, 'bad');
    return true;
  }

  private basketInteractionBlockReason(): string | null {
    return basketInteractionBlockReason({
      operatingTractor: this.operatingTractor,
      operatingPickup: this.operatingPickup,
    });
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
      if (result.ok && action.kind === 'harvest') this.beginBasketUnload();
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
    this.updateFarmhand(now, Math.max(0, Math.min(5_000, Math.floor(ms))));
    this.updateWorkerRuntime('eliot-reyes', now, Math.max(0, Math.min(5_000, Math.floor(ms))));
    this.renderer.render(this.buildScene(), now);
    this.updateDevTools();
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
      selectedSeedCount: farm.seeds[farm.selectedCropId] ?? 0,
      fieldSelection: [...this.fieldDragSelection],
      cashCents: farm.cashCents,
      barn: { used: storageUsed(this.state), capacity: farm.storageCapacity },
      basket: { used: handBasketUsed(this.state), capacity: HAND_BASKET_CAPACITY, destination: farm.handBasket.destination, unloading: !!this.basketUnload },
      pickup: { x: farm.pickup.x, y: farm.pickup.y, operating: this.operatingPickup, atTown: this.pickupAtTown, cargoUsed: pickupCargoUsed(this.state), cargoCapacity: pickupCargoCapacity(this.state), trailerOwned: farm.equipment.countyUtilityTrailerOwned },
      tractor: { x: farm.equipment.tractor.x, y: farm.equipment.tractor.y, operating: this.operatingTractor, working: !!this.tractorJob },
      workforce: {
        hired: farm.workforce.farmhandHired,
        lastShiftPaidDay: farm.workforce.lastShiftPaidDay,
        farmhand: { x: this.farmhandActor.x, y: this.farmhandActor.y, walking: this.farmhandActor.walking },
        job: this.farmhandJob ? {
          parcelId: this.farmhandJob.parcelId,
          kind: this.farmhandJob.kind,
          completed: this.farmhandJob.completed,
          skipped: this.farmhandJob.skipped,
          total: this.farmhandJob.targetPlotUids.length,
          nextIndex: this.farmhandJob.nextIndex,
        } : null,
        workers: (['mara-bell', 'eliot-reyes'] as const).map((workerId) => {
          const runtime = this.workerRuntime[workerId];
          return { workerId, x: runtime.actor.x, y: runtime.actor.y, job: runtime.job ? { kind: runtime.job.kind, parcelId: runtime.job.parcelId, completed: runtime.job.completed, total: runtime.job.targetPlotUids.length } : null };
        }),
      },
      countyFreight: (() => {
        const board = countyFreightBoardState(this.state);
        const progress = countyFreightProgress(this.state, { pickupPresent: this.pickupAtTown, source: 'pickup' });
        return {
          unlocked: board.unlocked,
          offers: board.offers,
          active: board.active,
          completedToday: board.completedToday,
          pickupProgress: progress,
        };
      })(),
      roadsideStand: roadsideStandView(this.state),
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
      weather: currentFarmWeather(this.state),
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
    addButton('dev-rain-day', 'Advance to rain', () => {
      const farm = farmOf(this.state);
      for (let offset = 0; offset < 14; offset++) {
        if (farmWeatherForDay(this.state.seed, farm.clock.day).kind === 'rain') break;
        advanceFarmDays(this.state, 1);
      }
      this.hud.update(this.state, this.tractorHudRuntime());
      this.updatePickupReminder(this.gameNow());
    });
    addButton('dev-fund-land', 'Fund land test', () => {
      farmOf(this.state).cashCents = 1_000_000;
      syncCashMirror(this.state);
    });
    addButton('dev-unlock-trailer', 'Unlock trailer test', () => {
      const farm = farmOf(this.state);
      farm.townContact.status = 'completed';
      farm.countyFreight.active = null;
      farm.countyFreight.lastCompletedDay = Math.max(1, farm.clock.day);
      farm.cashCents = Math.max(farm.cashCents, 500_000);
      syncCashMirror(this.state);
      this.hud.update(this.state, this.tractorHudRuntime());
    });
    addButton('dev-unlock-farmhand', 'Unlock farmhand test', () => {
      const farm = farmOf(this.state);
      farm.townContact.status = 'completed';
      farm.parcels.northOwned = true;
      ensureOwnedFarmParcelPlots(this.state, farm.parcels);
      farm.cashCents = Math.max(farm.cashCents, 500_000);
      syncCashMirror(this.state);
      this.hud.update(this.state, this.tractorHudRuntime());
    });
    addButton('dev-fill-roadside-order', 'Fill stand order', () => {
      const order = roadsideStandOrder(this.state);
      if (!order) return;
      const farm = farmOf(this.state);
      farm.storage[order.cropId] = Math.max(farm.storage[order.cropId] ?? 0, order.requiredUnits);
      this.hud.update(this.state, this.tractorHudRuntime());
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
    if (document.hidden) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    const realNow = Date.now();
    const now = this.gameNow();
    const dt = this.lastFrame ? Math.min(100, realNow - this.lastFrame) : 16;
    this.lastFrame = realNow;
    advanceFarmClock(this.state, now);
    const rainResult = applyCurrentFarmRain(this.state, now);
    const weather = currentFarmWeather(this.state);
    if (rainResult.wateredPlotUids.length > 0 && this.lastRainNoticeDay !== weather.day) {
      this.lastRainNoticeDay = weather.day;
      toast(`Steady rain established ${rainResult.wateredPlotUids.length} field section${rainResult.wateredPlotUids.length === 1 ? '' : 's'}.`, 'good');
    }
    this.updateFarmhand(now, dt);
    this.updateWorkerRuntime('eliot-reyes', now, dt);
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
    if (this.scoutFetch && canAdvanceFarmCompanionFetch({
      onFarm: this.mode === 'farm', operatingVehicle: this.operatingTractor || this.operatingPickup,
      tractorJob: !!this.tractorJob, farmhandJob: !!this.farmhandJob, manualFieldAction: !!this.manualFieldAction,
      manualFieldJob: !!this.manualFieldJob, basketUnload: !!this.basketUnload,
    })) {
      const nextFetch = advanceFarmCompanionFetch(this.scout, this.scoutFetch, this.playerActor, scoutHome, dt, this.gameNow());
      this.scout = nextFetch.scout;
      this.scoutFetch = nextFetch.fetch;
      if (!this.scoutFetch) toast('Scout brings the frisbee back, tail wagging.', 'good');
    } else this.scout = this.scoutWaitingForScratch && !this.operatingTractor && !this.operatingPickup && this.mode === 'farm'
      ? { ...this.scout, moving: false }
      : updateFarmCompanion(this.scout, this.playerActor, scoutHome, dt, this.mode === 'town' || this.operatingTractor || this.operatingPickup || !!this.tractorJob);
    const scoutDx = this.scout.x - scoutBefore.x; const scoutDy = this.scout.y - scoutBefore.y;
    if (Math.hypot(scoutDx, scoutDy) > 0.0001) this.scoutFacing = Math.abs(scoutDx) >= Math.abs(scoutDy) ? (scoutDx > 0 ? 'east' : 'west') : (scoutDy > 0 ? 'south' : 'north');

    const activeVehicle = this.operatingTractor ? 'tractor' : this.operatingPickup ? 'pickup' : null;
    const vehicleMoving = this.operatingTractor ? !!this.tractorTarget : this.operatingPickup ? !!this.pickupTarget : false;
    this.farmAudio.update(activeVehicle, vehicleMoving, weather.kind);

    if (shouldRenderFarmFrame(this.lastRenderedAt, realNow)) {
      this.lastRenderedAt = realNow;
      this.renderer.render(this.buildScene(), now);
      this.updateDevTools();
    }
    if (realNow - this.lastHudRefresh >= HUD_REFRESH_MS) {
      this.lastHudRefresh = realNow;
      this.hud.update(this.state, this.tractorHudRuntime());
      this.updatePickupReminder(now);
    }
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
        seed: this.state.seed,
        actor: {
          avatar: this.state.player.avatar,
          x: this.townActor.x,
          y: this.townActor.y,
          walking: this.townActor.walking,
          facing: this.townFacing,
          name: this.state.player.name,
        },
        clockDay: farm.clock.day,
        clockMinute: farm.clock.minute,
        weather: currentFarmWeather(this.state).kind,
        gesturingNpcId: this.townGesture?.npcId ?? null,
        gestureUntil: this.townGesture?.until ?? 0,
        pickup: this.pickupAtTown ? { ...TOWN_PICKUP_PARKING, trailerOwned: farm.equipment.countyUtilityTrailerOwned } : undefined,
        interactionHint: this.townHover ?? undefined,
        kitchenCompleted: farm.countyKitchen.status === 'completed',
      };
      return scene;
    }
    scene.actors = [
      ...((this.operatingTractor || this.operatingPickup) ? [] : [{
        ...this.playerActor,
        name: this.state.player.name,
        facing: this.playerFacing,
        variant: 'owner' as const,
        carryingBasket: handBasketHasCargo(this.state),
        basketFill: handBasketUsed(this.state) / HAND_BASKET_CAPACITY,
      }]),
      ...(farm.workforce.farmhandHired ? [{
        ...this.farmhandActor,
        name: this.farmhandAction ? undefined : FIRST_FARMHAND.name,
        facing: this.farmhandFacing,
        variant: 'farmhand' as const,
      }] : []),
      ...(farm.workforce.eliotHired ? [{ ...this.eliotActor, name: this.workerRuntime['eliot-reyes'].action ? undefined : ELIOT_REYES.name, facing: this.workerRuntime['eliot-reyes'].facing, variant: 'farmhand' as const }] : []),
    ];
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
        workKind: this.tractorJob?.kind,
        harvestWagon: {
          tier: farm.equipment.harvestWagon.tier,
          used: allFarmCrops().reduce((sum, def) => sum + (farm.equipment.harvestWagon.crops[def.id] ?? 0) * def.storageUnitsPerItem, 0),
          attached: farm.equipment.harvestWagon.owned && (this.tractorJob?.kind === 'harvest' || Object.values(farm.equipment.harvestWagon.crops).some((count) => count > 0)),
        },
      },
      pickup: {
        name: farm.pickup.name,
        x: farm.pickup.x,
        y: farm.pickup.y,
        operating: this.operatingPickup,
        moving: !!this.pickupTarget,
        trailerOwned: farm.equipment.countyUtilityTrailerOwned,
        headingX: this.pickupMotion.headingX,
        headingY: this.pickupMotion.headingY,
        steer: this.pickupMotion.steer,
        wheelPhase: this.pickupMotion.wheelPhase,
      },
      scout: { ...this.scout, facing: this.scoutFacing, scratching: this.gameNow() < this.scoutScratchUntil },
      frisbee: this.scoutFetch ? { throwFrom: this.scoutFetch.throwFrom, carrier: this.scout, to: this.scoutFetch.target, phase: this.scoutFetch.phase, phaseStartedAt: this.scoutFetch.phaseStartedAt } : undefined,
      farmhouseTier: farmhousePresentationTier(farm.parcels.northOwned, farm.farmstead.officeQuartersOwned),
      barnLoftOwned: farm.equipment.barnLoftExpansionOwned,
      grainSiloOwned: farm.equipment.countyGrainSiloOwned,
      roadsideStand: {
        owned: farm.roadsideStand.owned,
        completedToday: farm.roadsideStand.lastCompletedDay >= farm.clock.day,
      },
      clockDay: farm.clock.day,
      clockMinute: farm.clock.minute,
      weather: currentFarmWeather(this.state).kind,
      interactionHint: this.hover ? { kind: this.hover.kind, label: this.hover.label, ...this.hover.point } : undefined,
      manualAction: this.manualFieldAction ? {
        kind: this.manualFieldAction.kind,
        x: this.manualFieldAction.x,
        y: this.manualFieldAction.y,
        progress: manualFieldActionProgress(this.manualFieldAction, this.gameNow()),
      } : undefined,
      manualSelection: this.fieldDragSelection.length > 0 || this.manualFieldJob
        ? (this.fieldDragSelection.length > 0
          ? this.fieldDragSelection
          : this.manualFieldJob!.targetPlotUids.slice(this.manualFieldJob!.nextIndex)).flatMap((plotUid) => {
          const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
          return plot ? [{ x: plot.x, y: plot.y }] : [];
        })
        : undefined,
      starterGuideTarget: shouldPresentStarterGuideTarget({
        tractorOperating: this.operatingTractor, tractorJob: !!this.tractorJob, tractorMoving: !!this.tractorTarget,
        manualAction: !!this.manualFieldAction, manualJob: !!this.manualFieldJob, dragging: this.fieldDragSelection.length > 0,
        farmhandJob: !!this.farmhandJob, farmhandAction: !!this.farmhandAction, farmhandMoving: !!this.farmhandTarget,
      }) ? firstFarmMorningGuide(this.state, this.gameNow()).fieldTarget ?? undefined : undefined,
      farmhandAction: this.farmhandAction ? {
        kind: this.farmhandAction.kind,
        x: this.farmhandAction.x,
        y: this.farmhandAction.y,
        progress: manualFieldActionProgress(this.farmhandAction, this.gameNow()),
      } : undefined,
      farmhandSelection: this.farmhandJob
        ? this.farmhandJob.targetPlotUids.slice(this.farmhandJob.nextIndex).flatMap((plotUid) => {
          const plot = this.state.plots.find((candidate) => candidate.uid === plotUid);
          return plot ? [{ x: plot.x, y: plot.y }] : [];
        })
        : undefined,
      harvestFeedback: this.harvestFeedback && this.gameNow() - this.harvestFeedback.startedAt < 760
        ? this.harvestFeedback
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
