import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/data";
import { createFarmGame } from "../src/core/state";
import { Camera } from "../src/render/camera";
import { sceneFromState, type RenderScene } from "../src/render/renderer";
import { ThreeFarmRenderer } from "../src/render/threeFarmRenderer";

const gpu = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  forceContextLoss: vi.fn(),
}));
vi.mock("three", async (importOriginal) => {
  const real = await importOriginal<typeof import("three")>();
  return {
    ...real,
    WebGLRenderer: class {
      shadowMap = {};
      info = {
        render: { calls: 0, triangles: 0 },
        memory: { geometries: 0, textures: 0 },
      };
      ratio = 1;
      canvas: FakeCanvas;
      constructor(options: { canvas: FakeCanvas }) {
        this.canvas = options.canvas;
      }
      setClearColor() {}
      setPixelRatio(ratio: number) {
        this.ratio = ratio;
      }
      getPixelRatio() {
        return this.ratio;
      }
      setSize(w: number, h: number) {
        this.canvas.clientWidth = w;
        this.canvas.clientHeight = h;
      }
      render = gpu.render;
      dispose = gpu.dispose;
      forceContextLoss = gpu.forceContextLoss;
    },
  };
});
class FakeCanvas extends EventTarget {
  style: Record<string, string> = {};
  className = "";
  clientWidth = 0;
  clientHeight = 0;
  removed = false;
  setAttribute() {}
  before() {}
  remove() {
    this.removed = true;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("3D resource ownership", () => {
  it("recovers context availability, keeps scene caches bounded, and disposes once without mutating snapshots", () => {
    vi.stubGlobal("document", { createElement: () => new FakeCanvas() });
    const state = createFarmGame("Resource QA", 5, 1000),
      camera = new Camera();
    const base = sceneFromState(state);
    const town: RenderScene = {
      ...base,
      town: {
        seed: 5,
        actor: {
          avatar: state.player.avatar,
          x: 12,
          y: 12,
          walking: false,
          facing: "south",
          name: "QA",
        },
        clockDay: 1,
        clockMinute: 720,
        weather: "clear",
        gesturingNpcId: null,
        gestureUntil: 0,
        pickup: { x: 8, y: 12, trailerOwned: true, cargoUsed: 10 },
      },
    };
    const farm: RenderScene = {
      ...base,
      farm: {
        lockedTiles: [],
        fieldConditions: state.farm!.fieldConditions,
        parcelLabel: "QA",
        tractor: { ...state.farm!.equipment.tractor },
        pickup: {
          ...state.farm!.pickup,
          operating: false,
          moving: false,
          trailerOwned: false,
        },
        scout: {
          x: 6,
          y: 6,
          moving: false,
          mode: "home",
          facing: "south",
          scratching: false,
        },
        farmhouseTier: "starter",
        barnLoftOwned: false,
        grainSiloOwned: false,
        roadsideStand: { owned: false, completedToday: false },
        clockDay: 1,
        clockMinute: 720,
        weather: "clear",
      },
    };
    const before = JSON.stringify([town, farm]);
    const ctx = new Proxy(
      { measureText: () => ({ width: 50 }) },
      {
        get: (target, key) =>
          key in target ? target[key as keyof typeof target] : () => {},
      },
    ) as unknown as CanvasRenderingContext2D;
    const renderer = new ThreeFarmRenderer(
      new FakeCanvas() as unknown as HTMLCanvasElement,
    );
    renderer.render(farm, camera, ctx, 1000, 1);
    renderer.render(town, camera, ctx, 1000, 1);
    const warm = renderer.diagnostics() as { modelCache: number };
    for (let i = 0; i < 4; i++) {
      renderer.render(farm, camera, ctx, 1000, 1);
      renderer.render(town, camera, ctx, 1000, 1);
    }
    expect((renderer.diagnostics() as { modelCache: number }).modelCache).toBe(
      warm.modelCache,
    );
    expect(JSON.stringify([town, farm])).toBe(before);
    const loss = new Event("webglcontextlost", { cancelable: true });
    renderer.canvas.dispatchEvent(loss);
    expect(loss.defaultPrevented).toBe(true);
    expect(renderer.available).toBe(false);
    const frames = gpu.render.mock.calls.length;
    expect(renderer.render(town, camera, ctx, 1000, 1)).toBe(false);
    expect(gpu.render).toHaveBeenCalledTimes(frames);
    renderer.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(renderer.render(town, camera, ctx, 1000, 1)).toBe(true);
    renderer.dispose();
    renderer.dispose();
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
    expect(gpu.forceContextLoss).toHaveBeenCalledTimes(1);
    expect((renderer.canvas as unknown as FakeCanvas).removed).toBe(true);
    renderer.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(renderer.available).toBe(false);
  });
});
