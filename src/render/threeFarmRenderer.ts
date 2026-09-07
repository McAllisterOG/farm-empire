import {
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PCFShadowMap,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
  ACESFilmicToneMapping,
} from "three";
import type { RenderScene, SceneActor } from "./renderer";
import type { Camera } from "./camera";
import {
  farmDriveLane,
  farmLandmarks,
  farmWorldPoint,
  FARM_PLOT_SPAN,
} from "./farmLayout";
import {
  FARM_DECOR_MANIFEST,
  FARM_FENCE_MANIFEST,
  FARM_HOMESTEAD_DECOR_MANIFEST,
  FARM_WORLD_CUE_MANIFEST,
  farmWindbreakAnchors,
} from "./farmDecor";
import { FARM_TOWN_GATE } from "../core/townGateway";
import { farmCropStage } from "../core/farmBusiness";
import { buildingDef } from "../core/registry";
import {
  TOWN_BUILDINGS,
  TOWN_EDGE_HOMES,
  TOWN_NPCS,
  TOWN_DECOR,
} from "../data/town.data";
import { TOWN_EXIT } from "./townLayout";
import { roadsideCustomerActors, townCountyLifeActors } from "./countyLife";
import { farmNightAlpha } from "./lighting";
import { syncThreeCamera, projectThreePoint } from "./threeProjection";
import {
  barnModel,
  cropModel,
  houseModel,
  ModelBuilder,
  PALETTE,
  personModel,
  scoutModel,
  townBuildingModel,
  treeModel,
  vehicleModel,
  wagonModel,
} from "./threeModels";
import type { FarmInteractionKind } from "./farmInteractions";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { frisbeeThrowProgress } from "../core/farmCompanion";

export interface MeshPick {
  kind: FarmInteractionKind | "town-npc" | "town-building" | "town-exit";
  x: number;
  y: number;
  id?: string;
  plotUid?: number;
}
interface Label {
  text: string;
  x: number;
  z: number;
  height: number;
  pick?: MeshPick;
}
interface DynamicItem {
  mesh: Mesh;
  key: string;
}

/** Owns only GPU/presentation resources. The game calls render; no RAF or clock. */
export class ThreeFarmRenderer {
  readonly canvas: HTMLCanvasElement;
  private gpu: WebGLRenderer;
  private scene = new Scene();
  readonly camera = new OrthographicCamera();
  private sun = new DirectionalLight("#fff0cd", 3.1);
  private sky = new HemisphereLight("#d8e8f0", "#8b7951", 2.2);
  private material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  private geometries = new Map<string, BufferGeometry>();
  private staticRoot = new Group();
  private cropRoot = new Group();
  private moving = new Map<string, DynamicItem>();
  private dynamicSeen = new Set<string>();
  private pickables: Mesh[] = [];
  private staticKey = "";
  private cropKey = "";
  private labels: Label[] = [];
  private labelHits: {
    x: number;
    y: number;
    w: number;
    h: number;
    pick: MeshPick;
  }[] = [];
  private environmentGeometries: BufferGeometry[] = [];
  private ray = new Raycaster();
  private pointer = new Vector2();
  private matrix = new Matrix4();
  private lost = false;
  private disposed = false;
  private readonly lostListener = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
  };
  private readonly restoredListener = (): void => {
    this.lost = false;
  };
  private frames = 0;
  private totalMs = 0;
  private maxMs = 0;
  private recentMs: number[] = [];
  private intervals: number[] = [];
  private previousFrame = 0;

  constructor(host: HTMLCanvasElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fe-three-world";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText =
      "position:fixed;left:0;top:0;pointer-events:none;";
    this.gpu = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.gpu.setClearColor("#c6d0ab");
    this.gpu.toneMapping = ACESFilmicToneMapping;
    this.gpu.toneMappingExposure = 1.18;
    this.gpu.shadowMap.enabled = true;
    this.gpu.shadowMap.type = PCFShadowMap;
    this.sun.position.set(-25, 45, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -48;
    this.sun.shadow.camera.right = 48;
    this.sun.shadow.camera.top = 48;
    this.sun.shadow.camera.bottom = -48;
    this.sun.shadow.camera.far = 160;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.bias = -0.0002;
    this.scene.add(
      this.sky,
      this.sun,
      this.sun.target,
      this.staticRoot,
      this.cropRoot,
    );
    host.before(this.canvas);
    this.canvas.addEventListener("webglcontextlost", this.lostListener);
    this.canvas.addEventListener("webglcontextrestored", this.restoredListener);
  }

  get available(): boolean {
    return !this.lost && !this.disposed;
  }
  set visible(value: boolean) {
    this.canvas.style.display = value ? "block" : "none";
  }
  private geometry(key: string, build: () => BufferGeometry): BufferGeometry {
    let g = this.geometries.get(key);
    if (!g) {
      g = build();
      this.geometries.set(key, g);
    }
    return g;
  }
  private add(
    key: string,
    build: () => BufferGeometry,
    x: number,
    z: number,
    pick?: MeshPick,
    scale = 1,
  ): Mesh {
    const m = new Mesh(this.geometry(key, build), this.material);
    m.position.set(x, 0, z);
    m.scale.setScalar(scale);
    m.castShadow = true;
    m.receiveShadow = true;
    this.staticRoot.add(m);
    if (pick) {
      m.userData.pick = pick;
      this.pickables.push(m);
    }
    return m;
  }
  private dynamic(
    id: string,
    key: string,
    build: () => BufferGeometry,
    x: number,
    z: number,
    angle = 0,
    pick?: MeshPick,
    scale = 1,
  ): Mesh {
    this.dynamicSeen.add(id);
    let item = this.moving.get(id);
    if (!item) {
      item = { mesh: new Mesh(this.geometry(key, build), this.material), key };
      item.mesh.castShadow = true;
      item.mesh.receiveShadow = true;
      this.scene.add(item.mesh);
      this.moving.set(id, item);
    }
    if (item.key !== key) {
      item.mesh.geometry = this.geometry(key, build);
      item.key = key;
    }
    item.mesh.position.set(x, 0, z);
    item.mesh.rotation.set(0, angle, 0);
    item.mesh.scale.setScalar(scale);
    item.mesh.userData.pick = pick;
    return item.mesh;
  }
  private label(
    text: string,
    x: number,
    z: number,
    height: number,
    pick?: MeshPick,
  ): void {
    this.labels.push({ text, x, z, height, pick });
  }
  private signGeometry(): BufferGeometry {
    return new ModelBuilder()
      .box(PALETTE.wood, 0, 0.65, 0, 0.12, 1.3, 0.12)
      .box(PALETTE.cream, 0, 1.3, 0, 1.8, 0.55, 0.13)
      .finish();
  }
  private fenceGeometry(): BufferGeometry {
    const b = new ModelBuilder();
    for (const x of [-1.2, 1.2]) b.box(PALETTE.wood, x, 0.5, 0, 0.12, 1, 0.12);
    for (const y of [0.4, 0.8]) b.box("#c5ad7b", 0, y, 0, 2.5, 0.1, 0.09);
    return b.finish();
  }

  private rebuildStatic(snapshot: RenderScene): void {
    const f = snapshot.farm,
      t = snapshot.town;
    const key = t
      ? "town"
      : JSON.stringify([
          f?.farmhouseTier,
          f?.barnLoftOwned,
          f?.grainSiloOwned,
          f?.roadsideStand.owned,
          snapshot.placements,
        ]);
    if (key === this.staticKey) return;
    this.staticKey = key;
    this.staticRoot.clear();
    this.environmentGeometries.forEach((g) => g.dispose());
    this.environmentGeometries = [];
    this.pickables = [];
    this.labels = [];
    this.cropKey = "";
    this.cropRoot.children.forEach((m) => {
      if (m instanceof InstancedMesh) m.dispose();
    });
    this.cropRoot.clear();
    this.moving.forEach(({ mesh }) => this.scene.remove(mesh));
    this.moving.clear();
    this.add(
      "ground",
      () =>
        new ModelBuilder().box("#879d65", 0, -0.35, 0, 240, 0.65, 240).finish(),
      25,
      22,
    ).castShadow = false;
    if (t) {
      this.buildTown();
      this.batchEnvironment();
      return;
    }
    if (!f) return;
    const lane = new ModelBuilder(),
      road = farmDriveLane();
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1],
        b = road[i],
        dx = b.x - a.x,
        dz = b.y - a.y;
      lane.box(
        "#b8ac87",
        (a.x + b.x) / 2,
        -0.015,
        (a.y + b.y) / 2,
        Math.hypot(dx, dz) + 0.2,
        0.035,
        1.55,
        0,
        -Math.atan2(dz, dx),
      );
      lane.box(
        "#d5c59f",
        (a.x + b.x) / 2,
        0.008,
        (a.y + b.y) / 2,
        Math.hypot(dx, dz),
        0.035,
        1.18,
        0,
        -Math.atan2(dz, dx),
      );
    }
    this.add("farm-road", () => lane.finish(), 0, 0).castShadow = false;
    const landmarks = farmLandmarks(),
      home = farmWorldPoint(landmarks.farmhouse);
    this.add(
      `house-${f.farmhouseTier}`,
      () => houseModel(f.farmhouseTier),
      home.x,
      home.y,
      { kind: "farmhouse", ...landmarks.farmhouse },
      1.12,
    );
    for (const p of snapshot.placements)
      if (p.defId === "bld_storage") {
        const d = buildingDef(p.defId),
          logical = { x: p.x + (d.w - 1) / 2, y: p.y + (d.h - 1) / 2 },
          v = farmWorldPoint(logical);
        this.add(
          `barn-${f.barnLoftOwned}`,
          () => barnModel(f.barnLoftOwned),
          v.x,
          v.y,
          { kind: "barn", ...logical },
          1,
        );
        if (f.grainSiloOwned)
          this.add(
            "silo",
            () =>
              new ModelBuilder()
                .cylinder("#b3b6a4", 0, 2, 0, 1.05, 4)
                .cylinder("#63776b", 0, 4.3, 0, 1.14, 0.65, 0.12)
                .box("#726e5d", 1.05, 2, 0, 0.09, 4, 0.13)
                .finish(),
            v.x + 3.1,
            v.y - 1.5,
            { kind: "barn", ...logical },
          );
        this.label("BARN", v.x, v.y, 6.2);
      }
    const dog = farmWorldPoint(landmarks.doghouse);
    this.add(
      "doghouse",
      () =>
        new ModelBuilder()
          .box("#c08b4c", 0, 0.42, 0, 1.05, 0.84, 0.95)
          .box("#584439", 0, 0.31, 0.49, 0.42, 0.6, 0.06)
          .box("#977b50", -0.3, 0.98, 0, 0.75, 0.12, 1.2, 0, 0, 0.5)
          .box("#977b50", 0.3, 0.98, 0, 0.75, 0.12, 1.2, 0, 0, -0.5)
          .finish(),
      dog.x,
      dog.y,
      { kind: "doghouse", ...landmarks.doghouse },
    );
    const gate = farmWorldPoint(FARM_TOWN_GATE);
    this.add(
      "sign",
      () => this.signGeometry(),
      gate.x,
      gate.y,
      { kind: "town-gate", ...FARM_TOWN_GATE },
      1.3,
    );
    this.label("COUNTY ROAD", gate.x, gate.y, 2.5, {
      kind: "town-gate",
      ...FARM_TOWN_GATE,
    });
    const trees = farmWindbreakAnchors();
    for (let i = 0; i < trees.length; i++) {
      const p = trees[i];
      const stand = farmWorldPoint(landmarks.roadsideStand);
      if (
        Math.hypot(p.x - gate.x, p.y - gate.y) < 4 ||
        Math.hypot(p.x - stand.x, p.y - stand.y) < 3.5
      )
        continue;
      this.add(
        `tree-${i % 3}`,
        () => treeModel(i % 3),
        p.x,
        p.y,
        undefined,
        1 + (i % 4) * 0.12,
      );
    }
    for (const p of FARM_FENCE_MANIFEST) {
      const m = this.add("fence", () => this.fenceGeometry(), p.x, p.y);
      m.rotation.y = p.direction === "north-south" ? Math.PI / 2 : 0;
    }
    for (const p of FARM_DECOR_MANIFEST) {
      const v = farmWorldPoint(p);
      this.add(
        `prop-${p.type}`,
        () => this.propModel(p.type),
        v.x,
        v.y,
        p.type === "hand-pump" ? { kind: "pump", x: p.x, y: p.y } : undefined,
      );
    }
    for (const p of FARM_HOMESTEAD_DECOR_MANIFEST) {
      const v = farmWorldPoint(p);
      this.add(`prop-${p.type}`, () => this.propModel(p.type), v.x, v.y);
    }
    for (const p of FARM_WORLD_CUE_MANIFEST) {
      const v = farmWorldPoint(p);
      this.add(
        `cue-${p.type}`,
        () => {
          const b = new ModelBuilder(0);
          if (p.type === "utility-pole")
            b.box("#9a8053", 0, 1.8, 0, 0.13, 3.6, 0.13).box(
              "#8c7856",
              0,
              3.25,
              0,
              1.1,
              0.11,
              0.11,
            );
          else if (p.type === "field-marker")
            b.box("#c4af79", 0, 0.32, 0, 0.08, 0.64, 0.08).box(
              "#e3cf96",
              0,
              0.64,
              0,
              0.24,
              0.18,
              0.04,
            );
          else if (p.type === "stone-cluster")
            b.ball("#9ca187", 0, 0.08, 0, 0.24, 0.15, 0.16).ball(
              "#b6b298",
              0.27,
              0.04,
              0.14,
              0.14,
              0.08,
              0.17,
            );
          else
            for (let i = 0; i < 5; i++)
              b.box(
                "#718e4f",
                (i - 2) * 0.08,
                0.15,
                0,
                0.035,
                0.3,
                0.04,
                0,
                0,
                (i - 2) * 0.16,
              );
          return b.finish();
        },
        v.x,
        v.y,
      );
    }
    // Terrain volume remains outside the unchanged playable mainland.
    for (const [i, p] of [
      { x: -15, y: 14 },
      { x: 12, y: -15 },
      { x: 46, y: -16 },
      { x: 76, y: 24 },
      { x: 36, y: 65 },
    ].entries())
      this.add(
        `hill-${i % 2}`,
        () =>
          new ModelBuilder(1)
            .ball(i % 2 ? "#92a876" : "#a0ad7d", 0, -0.9, 0, 11, 3.5, 9)
            .finish(),
        p.x,
        p.y,
      ).castShadow = false;
    const pond = farmWorldPoint({ x: 2.25, y: 4.2 });
    this.add(
      "pond",
      () =>
        new ModelBuilder()
          .ball("#a9ac82", 0, -0.13, 0, 1.75, 0.23, 1.15)
          .ball("#759f9e", 0, -0.02, 0, 1.5, 0.13, 0.95)
          .finish(),
      pond.x,
      pond.y,
    ).castShadow = false;
    if (f.roadsideStand.owned) {
      const p = farmWorldPoint(landmarks.roadsideStand);
      this.add("stand", () => this.standModel(), p.x, p.y, {
        kind: "roadside-stand",
        ...landmarks.roadsideStand,
      });
      this.label("FARM STAND", p.x, p.y, 2.8);
    }
    for (const [label, p] of [
      ["CARGO PAD", landmarks.cargoPad],
      ["TRACTOR PARKING", landmarks.tractorParking],
    ] as const) {
      const v = farmWorldPoint(p);
      this.add(
        `pad-${label}`,
        () =>
          new ModelBuilder()
            .box("#b5b092", 0, -0.01, 0, 4.9, 0.025, 3.3)
            .finish(),
        v.x,
        v.y,
      ).castShadow = false;
      this.label(label, v.x, v.y + 2, 0);
    }
    this.batchEnvironment();
  }

  private batchEnvironment(): void {
    // Merge only noninteractive static dressing. Picking meshes stay independent.
    for (const casts of [false, true]) {
      const meshes = this.staticRoot.children.filter(
        (m): m is Mesh =>
          m instanceof Mesh && !m.userData.pick && m.castShadow === casts,
      );
      if (!meshes.length) continue;
      const parts = meshes.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const geometry = mergeGeometries(parts, false)!;
      parts.forEach((g) => g.dispose());
      this.environmentGeometries.push(geometry);
      meshes.forEach((m) => this.staticRoot.remove(m));
      const merged = new Mesh(geometry, this.material);
      merged.castShadow = casts;
      merged.receiveShadow = true;
      this.staticRoot.add(merged);
    }
  }

  private propModel(kind: string): BufferGeometry {
    const b = new ModelBuilder();
    if (kind === "hand-pump") {
      b.cylinder("#5b796b", 0, 0.6, 0, 0.13, 1.2)
        .box("#5b796b", 0.22, 1.03, 0, 0.55, 0.12, 0.12)
        .box("#525e50", -0.15, 1.22, 0, 0.55, 0.08, 0.09, 0, 0, 0.25)
        .cylinder("#b7a889", 0, 0.07, 0, 0.4, 0.14);
    } else if (kind === "orchard-tree") return treeModel(2);
    else if (kind === "trellis-fence") return this.fenceGeometry();
    else if (kind === "water-trough") {
      b.box("#929c91", 0, 0.28, 0, 1.35, 0.56, 0.65).box(
        "#76a09c",
        0,
        0.58,
        0,
        1.16,
        0.025,
        0.48,
      );
    } else if (kind === "flower-bed") {
      b.box("#9b8260", 0, 0.1, 0, 1.4, 0.2, 0.75);
      for (let i = 0; i < 7; i++) {
        const x = (i % 4) * 0.32 - 0.5,
          z = Math.floor(i / 4) * 0.3 - 0.15;
        b.cylinder("#6e8b4c", x, 0.3, z, 0.025, 0.4).ball(
          i % 2 ? "#f1ce76" : "#cf896e",
          x,
          0.51,
          z,
          0.12,
          0.07,
          0.12,
        );
      }
    } else if (kind === "wash-line") {
      for (const x of [-0.8, 0.8])
        b.box(PALETTE.wood, x, 0.8, 0, 0.07, 1.6, 0.07);
      b.box("#968668", 0, 1.55, 0, 1.65, 0.02, 0.02);
      for (const x of [-0.5, 0, 0.5])
        b.box("#e0d5b6", x, 1.2, 0, 0.35, 0.65, 0.03);
    } else if (kind === "sitting-set") {
      b.box("#a78050", 0, 0.5, 0, 1.3, 0.12, 0.5);
      for (const x of [-0.5, 0.5]) b.box("#59634e", x, 0.25, 0, 0.09, 0.5, 0.4);
      b.box("#a78050", 0, 0.8, -0.21, 1.3, 0.35, 0.09);
    } else if (kind === "hay-bale") {
      b.box("#d4b365", 0, 0.4, 0, 0.95, 0.8, 0.72);
      for (const x of [-0.25, 0.25])
        b.box("#ab8a47", x, 0.41, 0, 0.045, 0.82, 0.74);
    } else {
      b.box("#aa8652", 0, 0.3, 0, 1, 0.6, 0.72);
      for (const x of [-0.44, 0.44])
        b.box("#c9a66d", x, 0.3, 0.38, 0.08, 0.65, 0.07);
    }
    return b.finish();
  }
  private standModel(): BufferGeometry {
    const b = new ModelBuilder();
    b.box(PALETTE.wood, 0, 0.6, 0, 1.9, 0.95, 0.9);
    for (const x of [-0.9, 0.9])
      b.box(PALETTE.wood, x, 1.3, 0, 0.09, 2.6, 0.09);
    for (let i = 0; i < 6; i++)
      b.box(
        i % 2 ? "#eee0b6" : "#71925b",
        -0.85 + i * 0.34,
        2.25,
        0,
        0.34,
        0.13,
        1.5,
        0.12,
      );
    for (const x of [-0.55, 0, 0.55])
      b.ball("#d99a49", x, 1.12, 0, 0.17, 0.12, 0.16);
    return b.finish();
  }

  private buildTown(): void {
    this.add(
      "town-paving",
      () =>
        new ModelBuilder()
          .box("#b3ae94", 16, -0.04, 11.5, 26, 0.08, 11)
          .box("#9b9d8b", 16, 0.005, 12.7, 26, 0.03, 3.8)
          .box("#dfd1ab", 16, 0.032, 10.5, 26, 0.035, 0.35)
          .box("#dfd1ab", 16, 0.032, 14.9, 26, 0.035, 0.35)
          .finish(),
      0,
      0,
    ).castShadow = false;
    TOWN_BUILDINGS.forEach((b, i) => {
      const x = b.x + b.w / 2,
        z = b.y + b.h / 2;
      this.add(`town-shop-${i}`, () => townBuildingModel(b.w, b.h, i), x, z, {
        kind: "town-building",
        x,
        y: z,
        id: b.id,
      });
      this.label(b.sign, x, z, 5.1, {
        kind: "town-building",
        x,
        y: z,
        id: b.id,
      });
    });
    TOWN_EDGE_HOMES.forEach((h, i) =>
      this.add(
        `town-house-${i}`,
        () => houseModel(i === 2 ? "expanded" : "starter", i),
        h.x,
        h.y,
        undefined,
        0.7,
      ),
    );
    for (const p of TOWN_DECOR)
      this.add(
        `town-prop-${p.kind}`,
        () =>
          p.kind === "lamp"
            ? new ModelBuilder()
                .cylinder("#536556", 0, 1.3, 0, 0.075, 2.6)
                .box("#eee0a6", 0, 2.65, 0, 0.32, 0.4, 0.32)
                .finish()
            : this.propModel(
                p.kind === "bench" ? "sitting-set" : "crate-pallet",
              ),
        p.x,
        p.y,
      );
    for (const [i, p] of [
      { x: 2, y: 8 },
      { x: 2, y: 13 },
      { x: 6, y: 19 },
      { x: 21, y: 19 },
      { x: 29, y: 3 },
      { x: 30, y: 18 },
    ].entries())
      this.add(
        `tree-${i % 3}`,
        () => treeModel(i % 3),
        p.x,
        p.y,
        undefined,
        1.1,
      );
    this.add("sign", () => this.signGeometry(), TOWN_EXIT.x, TOWN_EXIT.y, {
      kind: "town-exit",
      ...TOWN_EXIT,
    });
    this.label("HOME FARM", TOWN_EXIT.x, TOWN_EXIT.y, 2.1, {
      kind: "town-exit",
      ...TOWN_EXIT,
    });
  }

  private rebuildCrops(snapshot: RenderScene, now: number): void {
    if (!snapshot.farm) return;
    const f = snapshot.farm;
    const key =
      snapshot.plots
        .map(
          (p) =>
            `${p.uid}:${p.crop?.defId}:${farmCropStage(p.crop, now)}:${f.fieldConditions[String(p.uid)]?.soil}`,
        )
        .join("|") + `/${f.lockedTiles.length}`;
    if (key === this.cropKey) return;
    this.cropKey = key;
    this.cropRoot.children.forEach((m) => {
      if (m instanceof InstancedMesh) m.dispose();
    });
    this.cropRoot.clear();
    const groups = new Map<
      string,
      { x: number; z: number; scale: number; pick?: MeshPick }[]
    >();
    const add = (
      key: string,
      x: number,
      z: number,
      scale = 1,
      pick?: MeshPick,
    ): void => {
      const list = groups.get(key) ?? [];
      list.push({ x, z, scale, pick });
      groups.set(key, list);
    };
    for (const p of [
      ...snapshot.plots,
      ...f.lockedTiles.map((p) => ({ ...p, uid: -1, crop: null })),
    ]) {
      const v = farmWorldPoint(p),
        soil =
          p.uid === -1
            ? "locked"
            : (f.fieldConditions[String(p.uid)]?.soil ?? "rough");
      add(`soil:${soil}`, v.x, v.y);
      if (p.crop) {
        const stage = farmCropStage(p.crop, now),
          id = p.crop.defId;
        if (stage === "needs-water")
          add("cue:water", v.x + 0.85, v.y + 0.85, 0.8, {
            kind: "field",
            x: p.x,
            y: p.y,
            plotUid: p.uid,
          });
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 3; col++)
            add(
              `crop:${id}:${stage}`,
              v.x + (col - 1) * 0.71,
              v.y + (row - 1) * 0.71,
              1 + ((col + row) % 3) * 0.05,
              { kind: "field", x: p.x, y: p.y, plotUid: p.uid },
            );
      }
    }
    for (const [key, points] of groups) {
      const bits = key.split(":");
      const geometry = this.geometry(key, () => {
        if (bits[0] === "crop") return cropModel(bits[1], bits[2]);
        if (bits[0] === "cue")
          return new ModelBuilder(0)
            .cylinder("#7ab2ce", 0, 0.7, 0, 0.025, 1.4)
            .ball("#a9dae9", 0, 1.45, 0, 0.16, 0.25, 0.16)
            .finish();
        const soil = bits[1],
          b = new ModelBuilder(0),
          c =
            soil === "locked"
              ? "#8c9169"
              : soil === "rough"
                ? "#ae8961"
                : soil === "stubble"
                  ? "#ab8856"
                  : "#856548";
        b.box(c, 0, -0.018, 0, 2.61, 0.065, 2.61);
        for (let i = 0; i < 6; i++)
          b.box(
            soil === "rough" ? "#b99b73" : "#72583f",
            (i - 2.5) * 0.4,
            0.022,
            0,
            0.07,
            0.03,
            2.46,
          );
        if (soil === "rough" || soil === "stubble")
          for (let i = 0; i < 7; i++)
            b.ball(
              soil === "rough" ? "#927858" : "#d3b673",
              ((i % 3) - 1) * 0.7,
              0.06,
              (Math.floor(i / 3) - 1) * 0.7,
              0.055,
              0.035,
              0.07,
            );
        return b.finish();
      });
      const mesh = new InstancedMesh(geometry, this.material, points.length);
      points.forEach((p, i) => {
        this.matrix.makeScale(p.scale, p.scale, p.scale);
        this.matrix.setPosition(p.x, 0, p.z);
        mesh.setMatrixAt(i, this.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = bits[0] === "crop";
      mesh.receiveShadow = true;
      mesh.userData.instancePicks =
        bits[0] === "crop" || bits[0] === "cue"
          ? points.map((p) => p.pick)
          : undefined;
      this.cropRoot.add(mesh);
    }
  }

  private actor(
    id: string,
    actor: SceneActor,
    now: number,
    farm: boolean,
    pick?: MeshPick,
  ): void {
    const p = farm ? farmWorldPoint(actor) : actor,
      shirt = actor.variant === "farmhand" ? "#a78663" : "#7399a3";
    const stride = actor.walking ? (Math.sin(now / 125) > 0 ? 1 : -1) : 0;
    const skin =
      actor.avatar?.skin === "cl_skin_deep"
        ? "#996b4f"
        : actor.avatar?.skin === "cl_skin_tan"
          ? "#bf8c63"
          : "#e9b887";
    const key = `person-${shirt}-${!!actor.carryingBasket}-${stride}-${skin}`;
    const facing = {
      south: 0,
      east: Math.PI / 2,
      north: Math.PI,
      west: -Math.PI / 2,
    }[actor.facing ?? "south"];
    const mesh = this.dynamic(
      id,
      key,
      () => personModel(shirt, true, actor.carryingBasket, stride, skin),
      p.x,
      p.y,
      facing,
      pick,
    );
    mesh.position.y = actor.walking ? Math.abs(Math.sin(now / 125)) * 0.075 : 0;
  }

  private rollingWheels(
    id: string,
    x: number,
    z: number,
    angle: number,
    phase: number,
    tractor: boolean,
  ): void {
    for (const localX of [-1.1, 1.12])
      for (const localZ of [-1.04, 1.04]) {
        const radius = tractor ? (localX < 0 ? 0.7 : 0.46) : 0.43;
        const spoke = this.dynamic(
          `${id}-wheel-${localX}-${localZ}`,
          `wheel-spoke-${radius}`,
          () =>
            new ModelBuilder(0)
              .box("#705c3f", 0, 0, 0, radius * 0.75, 0.045, 0.025)
              .box("#705c3f", 0, 0, 0, 0.045, radius * 0.75, 0.025)
              .finish(),
          x + Math.cos(angle) * localX + Math.sin(angle) * localZ,
          z - Math.sin(angle) * localX + Math.cos(angle) * localZ,
          angle,
        );
        spoke.position.y = radius;
        spoke.rotation.set(0, angle, -phase, "YXZ");
      }
  }

  private cargo(
    id: string,
    x: number,
    z: number,
    angle: number,
    used: number,
    trailer: boolean,
  ): void {
    if (used <= 0) return;
    const offset = trailer && used > 72 ? 4.25 : 1.27;
    const load = this.dynamic(
      id,
      "cargo-crates",
      () =>
        new ModelBuilder()
          .box("#b98c56", 0, 0.22, 0, 0.85, 0.44, 0.87)
          .box("#dcba7a", 0, 0.45, 0, 0.91, 0.07, 0.93)
          .box("#819758", 0.12, 0.57, 0.1, 0.4, 0.2, 0.4)
          .finish(),
      x - Math.cos(angle) * offset,
      z + Math.sin(angle) * offset,
      angle,
    );
    load.position.y = 0.86;
    load.scale.y = 0.6 + Math.min(1, used / 72) * 0.55;
  }

  render(
    snapshot: RenderScene,
    source: Camera,
    ctx: CanvasRenderingContext2D,
    now: number,
    dpr: number,
  ): boolean {
    if (!this.available) return false;
    const started = performance.now();
    this.visible = true;
    const width = source.viewW,
      height = source.viewH;
    const ratio = Math.min(dpr, width < 900 ? 1.35 : 1.6);
    if (
      this.gpu.getPixelRatio() !== ratio ||
      this.canvas.clientWidth !== width ||
      this.canvas.clientHeight !== height
    ) {
      this.gpu.setPixelRatio(ratio);
      this.gpu.setSize(width, height);
    }
    syncThreeCamera(this.camera, source);
    this.rebuildStatic(snapshot);
    this.rebuildCrops(snapshot, now);
    this.dynamicSeen.clear();
    const f = snapshot.farm,
      t = snapshot.town,
      minute = (t ?? f)!.clockMinute,
      night = farmNightAlpha(minute),
      rain = (t ?? f)!.weather === "rain";
    this.sky.intensity = 2.1 - night * 2.2;
    this.sun.intensity = (rain ? 1.3 : 3.2) * (1 - night * 1.8);
    this.gpu.toneMappingExposure = 1.13 - night * 0.5;
    this.sun.target.position.set(t ? 15 : 26, 0, t ? 10 : 22);
    this.sun.position.set(t ? -8 : 0, 45, t ? 0 : 14);
    this.sun.target.updateMatrixWorld();
    if (f) {
      const tr = f.tractor,
        pu = f.pickup,
        tp = farmWorldPoint(tr),
        pp = farmWorldPoint(pu),
        ta = -Math.atan2(tr.headingY ?? 0, tr.headingX ?? 1),
        pa = -Math.atan2(pu.headingY ?? 0, pu.headingX ?? 1);
      this.dynamic(
        "tractor",
        `tractor-${tr.status}`,
        () => vehicleModel(true, tr.status === "maintenance"),
        tp.x,
        tp.y,
        ta,
        { kind: "tractor", x: tr.x, y: tr.y },
      );
      this.dynamic(
        "pickup",
        "pickup",
        () => vehicleModel(false),
        pp.x,
        pp.y,
        pa,
        { kind: "pickup", x: pu.x, y: pu.y },
      );
      this.cargo(
        "pickup-load",
        pp.x,
        pp.y,
        pa,
        pu.cargoUsed ?? 0,
        pu.trailerOwned,
      );
      if (tr.moving)
        this.rollingWheels(
          "tractor",
          tp.x,
          tp.y,
          ta,
          tr.wheelPhase ?? now / 160,
          true,
        );
      if (pu.moving)
        this.rollingWheels(
          "pickup",
          pp.x,
          pp.y,
          pa,
          pu.wheelPhase ?? now / 160,
          false,
        );
      if (tr.operating) {
        const driver = this.dynamic(
          "tractor-driver",
          "driver",
          () => personModel("#7399a3"),
          tp.x - Math.cos(ta) * 0.7,
          tp.y + Math.sin(ta) * 0.7,
          ta + Math.PI / 2,
          undefined,
          0.62,
        );
        driver.position.y = 0.82;
      }
      if (pu.trailerOwned) {
        const distance = 4.25;
        this.dynamic(
          "trailer",
          "trailer",
          () => wagonModel(false, true),
          pp.x - Math.cos(pa) * distance,
          pp.y + Math.sin(pa) * distance,
          pa,
          { kind: "pickup", x: pu.x, y: pu.y },
        );
      }
      if (tr.harvestWagon?.attached) {
        const county = tr.harvestWagon.tier === "county",
          distance = tr.workKind === "plant" ? 6.4 : 4.6,
          wx = tp.x - Math.cos(ta) * distance,
          wz = tp.y + Math.sin(ta) * distance;
        this.dynamic(
          "wagon",
          `wagon-${county}`,
          () => wagonModel(county),
          wx,
          wz,
          ta,
          { kind: "tractor", x: tr.x, y: tr.y },
        );
        const fill = Math.min(1, tr.harvestWagon.used / (county ? 480 : 240));
        if (fill > 0) {
          const load = this.dynamic(
            "wagon-load",
            "grain-load",
            () =>
              new ModelBuilder()
                .ball("#d8b960", 0, 0, 0, 1, 0.32, 0.65)
                .finish(),
            wx,
            wz,
            ta,
          );
          load.position.y = 0.87 + fill * 0.36;
          load.scale.set(county ? 1.6 : 1.2, Math.max(0.12, fill), 1);
        }
      }
      if (tr.working && tr.workKind !== "harvest") {
        const wx = tp.x - Math.cos(ta) * 2.8,
          wz = tp.y + Math.sin(ta) * 2.8;
        this.dynamic(
          "implement",
          `implement-${tr.workKind}`,
          () => {
            const b = new ModelBuilder().box(
              "#758c58",
              0,
              0.44,
              0,
              0.8,
              0.15,
              2.3,
            );
            for (let i = -2; i <= 2; i++)
              b.box("#49564a", 0, 0.2, i * 0.45, 0.55, 0.35, 0.07);
            if (tr.workKind === "plant")
              b.box("#bc6549", 0, 0.78, 0, 0.55, 0.55, 1.7);
            return b.finish();
          },
          wx,
          wz,
          ta,
          { kind: "tractor", x: tr.x, y: tr.y },
        );
      }
      snapshot.actors.forEach((a, i) =>
        this.actor(
          `actor-${i}`,
          a,
          now,
          true,
          a.variant === "farmhand"
            ? { kind: "farmhand", x: a.x, y: a.y }
            : undefined,
        ),
      );
      const sp = farmWorldPoint(f.scout),
        dog = this.dynamic(
          "scout",
          "scout",
          scoutModel,
          sp.x,
          sp.y,
          { east: 0, south: -Math.PI / 2, west: Math.PI, north: Math.PI / 2 }[
            f.scout.facing
          ],
          { kind: "scout", x: f.scout.x, y: f.scout.y },
        );
      dog.position.y = f.scout.moving
        ? Math.abs(Math.sin(now / 110)) * 0.06
        : 0;
      if (f.scout.scratching) dog.rotation.z = Math.sin(now / 95) * 0.08;
      if (f.frisbee) {
        const frisbee = f.frisbee,
          progress = frisbeeThrowProgress(
            frisbee.phase,
            frisbee.phaseStartedAt,
            now,
          );
        const p = farmWorldPoint(
          frisbee.phase === "returning"
            ? frisbee.carrier
            : frisbee.phase === "outbound"
              ? {
                  x:
                    frisbee.throwFrom.x +
                    (frisbee.to.x - frisbee.throwFrom.x) * progress,
                  y:
                    frisbee.throwFrom.y +
                    (frisbee.to.y - frisbee.throwFrom.y) * progress,
                }
              : frisbee.to,
        );
        const disc = this.dynamic(
          "frisbee",
          "frisbee",
          () =>
            new ModelBuilder().cylinder("#d8a74b", 0, 0, 0, 0.2, 0.04).finish(),
          p.x,
          p.y,
        );
        disc.position.y =
          frisbee.phase === "returning"
            ? 0.5
            : 0.1 + Math.sin(progress * Math.PI) * 1.3;
      }
      for (const [id, action] of [
        ["owner-tool", f.manualAction],
        ["worker-tool", f.farmhandAction],
      ] as const) {
        if (!action) continue;
        const p = farmWorldPoint(action);
        const tool = this.dynamic(
          id,
          `tool-${action.kind}`,
          () => {
            const b = new ModelBuilder();
            if (action.kind === "water")
              b.cylinder("#7699a0", 0, 0.25, 0, 0.2, 0.45).box(
                "#7699a0",
                0.3,
                0.2,
                0,
                0.4,
                0.09,
                0.09,
                0,
                0,
                -0.3,
              );
            else if (action.kind === "plant")
              b.box("#c4a876", 0, 0.22, 0, 0.33, 0.44, 0.24);
            else
              b.box("#aa8052", 0, 0.55, 0, 0.055, 1.1, 0.055, 0, 0, 0.35).box(
                "#69786d",
                0.17,
                0.06,
                0,
                0.4,
                0.08,
                0.16,
              );
            return b.finish();
          },
          p.x + 0.42,
          p.y + 0.4,
        );
        tool.position.y = 0.15 + Math.sin(action.progress * Math.PI) * 0.3;
        tool.rotation.z = Math.sin(action.progress * Math.PI * 4) * 0.25;
      }
      if (f.harvestFeedback) {
        const feedback = f.harvestFeedback,
          p = farmWorldPoint(feedback),
          age = Math.min(1, (now - feedback.startedAt) / 760);
        const puff = this.dynamic(
          "harvest-feedback",
          "harvest-feedback",
          () =>
            new ModelBuilder(0)
              .ball("#efd591", 0, 0, 0, 0.16)
              .ball("#d5bf69", 0.25, 0.2, 0, 0.11)
              .ball("#efd591", -0.2, 0.12, 0.2, 0.09)
              .finish(),
          p.x,
          p.y,
        );
        puff.position.y = 0.7 + age;
        puff.scale.setScalar(1 - age * 0.8);
      }
      roadsideCustomerActors(
        snapshot.seed,
        f.clockDay,
        f.clockMinute,
        now,
        f.roadsideStand.owned && !f.roadsideStand.completedToday,
      ).forEach((a, i) =>
        this.actor(
          `customer-${i}`,
          { ...a, avatar: snapshot.actors[0]?.avatar },
          now,
          true,
        ),
      );
    }
    if (t) {
      this.actor("town-owner", t.actor, now, false);
      TOWN_NPCS.forEach((n, i) => {
        this.dynamic(
          `npc-${n.id}`,
          `npc-${i}`,
          () =>
            personModel(
              ["#829969", "#927653", "#6b939a", "#b87863"][i],
              i !== 3,
            ),
          n.x,
          n.y,
          0,
          { kind: "town-npc", id: n.id, x: n.x, y: n.y },
        );
      });
      townCountyLifeActors(t.seed, t.clockDay, t.clockMinute, now).forEach(
        (a, i) =>
          this.actor(
            `resident-${i}`,
            { ...a, avatar: t.actor.avatar },
            now,
            false,
          ),
      );
      if (t.pickup) {
        this.dynamic(
          "town-pickup",
          "pickup",
          () => vehicleModel(false),
          t.pickup.x,
          t.pickup.y,
          0,
          { kind: "pickup", ...t.pickup },
        );
        if (t.pickup.trailerOwned)
          this.dynamic(
            "town-trailer",
            "trailer",
            () => wagonModel(false, true),
            t.pickup.x - 4.25,
            t.pickup.y,
            0,
            { kind: "pickup", ...t.pickup },
          );
      }
      if (t.pickup)
        this.cargo(
          "town-load",
          t.pickup.x,
          t.pickup.y,
          0,
          t.pickup.cargoUsed ?? 0,
          t.pickup.trailerOwned,
        );
    }
    this.moving.forEach(({ mesh }, id) => {
      if (!this.dynamicSeen.has(id)) {
        this.scene.remove(mesh);
        this.moving.delete(id);
      }
    });
    this.gpu.render(this.scene, this.camera);
    ctx.clearRect(0, 0, width, height);
    this.overlays(snapshot, source, ctx, now);
    const elapsed = performance.now() - started;
    this.frames++;
    this.totalMs += elapsed;
    this.maxMs = Math.max(this.maxMs, elapsed);
    this.recentMs.push(elapsed);
    if (this.recentMs.length > 180) this.recentMs.shift();
    if (this.previousFrame && started - this.previousFrame < 250) {
      this.intervals.push(started - this.previousFrame);
      if (this.intervals.length > 180) this.intervals.shift();
    }
    this.previousFrame = started;
    return true;
  }

  pick(sx: number, sy: number, width: number, height: number): MeshPick | null {
    if (!this.available) return null;
    const label = this.labelHits.find(
      (r) => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h,
    );
    if (label) return label.pick;
    this.pointer.set((sx / width) * 2 - 1, 1 - (sy / height) * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    const meshes = [
      ...this.pickables,
      ...this.cropRoot.children.filter((m) => m.userData.instancePicks),
      ...[...this.moving.values()]
        .filter((i) => i.mesh.userData.pick)
        .map((i) => i.mesh),
    ];
    const hit = this.ray.intersectObjects(meshes, false)[0];
    return hit
      ? ((hit.instanceId !== undefined
          ? hit.object.userData.instancePicks[hit.instanceId]
          : hit.object.userData.pick) as MeshPick)
      : null;
  }
  private overlays(
    snapshot: RenderScene,
    source: Camera,
    ctx: CanvasRenderingContext2D,
    now: number,
  ): void {
    const project = (x: number, z: number, h = 0) =>
      projectThreePoint(this.camera, source.viewW, source.viewH, x, z, h);
    const badge = (
      text: string,
      x: number,
      z: number,
      h: number,
      important = false,
      pick?: MeshPick,
    ): void => {
      const p = project(x, z, h);
      if (p.x < 0 || p.x > source.viewW || p.y < 70 || p.y > source.viewH - 45)
        return;
      ctx.font = `${important ? "700" : "600"} ${important ? 12 : 11}px Segoe UI`;
      const w = ctx.measureText(text).width + 14;
      p.x = Math.max(w / 2 + 8, Math.min(source.viewW - w / 2 - 8, p.x));
      ctx.fillStyle = important ? "#f6efd9" : "#f4eadbcf";
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, p.y - 10, w, 20, 6);
      ctx.fill();
      ctx.fillStyle = "#46583f";
      ctx.textAlign = "center";
      ctx.fillText(text, p.x, p.y + 4);
      if (pick)
        this.labelHits.push({ x: p.x - w / 2, y: p.y - 10, w, h: 20, pick });
    };
    const f = snapshot.farm;
    this.labelHits = [];
    for (const l of this.labels)
      if (source.zoom > 0.42 || l.pick)
        badge(l.text, l.x, l.z, l.height, false, l.pick);
    if (f) {
      for (const a of [
        ...(f.manualSelection ?? []),
        ...(f.farmhandSelection ?? []),
      ]) {
        const p = farmWorldPoint(a),
          half = (FARM_PLOT_SPAN - 0.14) / 2;
        ctx.beginPath();
        for (const [i, v] of [
          [p.x - half, p.y - half],
          [p.x + half, p.y - half],
          [p.x + half, p.y + half],
          [p.x - half, p.y + half],
        ].entries()) {
          const s = project(v[0], v[1], 0.07);
          if (i) ctx.lineTo(s.x, s.y);
          else ctx.moveTo(s.x, s.y);
        }
        ctx.closePath();
        ctx.strokeStyle = "#ffe4a0";
        ctx.lineWidth = 2;
        ctx.fillStyle = "#ffdda12b";
        ctx.fill();
        ctx.stroke();
      }
      if (f.starterGuideTarget) {
        const p = farmWorldPoint(f.starterGuideTarget),
          s = project(p.x, p.y, 0.09);
        ctx.strokeStyle = "#f4d690";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(
          s.x,
          s.y,
          15 + Math.sin(now / 350) * 2,
          7,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      if (f.lockedTiles.length) {
        const p = farmWorldPoint(
          f.lockedTiles[Math.floor(f.lockedTiles.length / 2)],
        );
        badge(
          source.viewW < 600
            ? "NEIGHBORING ACREAGE"
            : `NEIGHBORING ACREAGE · ${f.parcelLabel}`,
          p.x,
          p.y,
          0.2,
        );
      }
      if (f.interactionHint) {
        const h = f.interactionHint,
          p = farmWorldPoint(h);
        badge(h.label, p.x, p.y, 2.9, true);
      }
      if (f.destination) {
        const p = farmWorldPoint(f.destination),
          s = project(p.x, p.y, 0.04);
        ctx.strokeStyle = "#fff1bc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, 9, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (f.manualAction) {
        const a = f.manualAction,
          p = farmWorldPoint(a),
          s = project(p.x, p.y, 1);
        ctx.fillStyle = "#514b37";
        ctx.fillRect(s.x - 22, s.y - 3, 44, 6);
        ctx.fillStyle = "#efcb79";
        ctx.fillRect(s.x - 22, s.y - 3, 44 * a.progress, 6);
      }
    } else if (snapshot.town?.interactionHint) {
      const h = snapshot.town.interactionHint;
      badge(h.label, h.x, h.y, 2.8, true);
    }
    if ((snapshot.town ?? f)?.weather === "rain") {
      ctx.strokeStyle = "#e8f0db55";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 65; i++) {
        const x = (i * 137.3 + now * 0.012) % source.viewW,
          y = (i * 93.7 + now * 0.38) % source.viewH;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 10);
      }
      ctx.stroke();
    }
  }
  diagnostics(): object {
    const sorted = [...this.recentMs].sort((a, b) => a - b);
    return {
      frames: this.frames,
      meanRenderMs: this.frames ? this.totalMs / this.frames : 0,
      recentP95RenderMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      recentFps: this.intervals.length
        ? 1000 /
          (this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length)
        : 0,
      maxRenderMs: this.maxMs,
      drawCalls: this.gpu.info.render.calls,
      triangles: this.gpu.info.render.triangles,
      geometries: this.gpu.info.memory.geometries,
      textures: this.gpu.info.memory.textures,
      modelCache: this.geometries.size,
      mode: "three",
      contextLost: this.lost,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.lostListener);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.restoredListener,
    );
    this.cropRoot.children.forEach((m) => {
      if (m instanceof InstancedMesh) m.dispose();
    });
    this.geometries.forEach((g) => g.dispose());
    this.geometries.clear();
    this.environmentGeometries.forEach((g) => g.dispose());
    this.material.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.clear();
    this.gpu.dispose();
    this.gpu.forceContextLoss();
    this.canvas.remove();
  }
}
