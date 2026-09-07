import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
  Euler,
  Shape,
  ExtrudeGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Original colored geometry. One merged mesh per model, no external assets. */
export class ModelBuilder {
  private parts: BufferGeometry[] = [];
  constructor(private readonly roundDetail = 1) {}
  add(
    geometry: BufferGeometry,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    g.deleteAttribute("uv");
    g.applyMatrix4(
      new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
        new Vector3(sx, sy, sz),
      ),
    );
    const c = new Color(color);
    const colors = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }
  box(
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ): this {
    return this.add(new BoxGeometry(1, 1, 1), c, x, y, z, w, h, d, rx, ry, rz);
  }
  ball(
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h = w,
    d = w,
  ): this {
    return this.add(
      new IcosahedronGeometry(1, this.roundDetail),
      c,
      x,
      y,
      z,
      w,
      h,
      d,
    );
  }
  cylinder(
    c: string,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    top = r,
    rx = 0,
    rz = 0,
  ): this {
    return this.add(
      new CylinderGeometry(top, r, h, r < 0.12 ? 5 : 10),
      c,
      x,
      y,
      z,
      1,
      1,
      1,
      rx,
      0,
      rz,
    );
  }
  finish(): BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }
}

export const PALETTE = {
  cream: "#f0dfb6",
  trim: "#fff0cf",
  wood: "#9d7046",
  dark: "#423e35",
  roof: "#566b63",
  brick: "#bb6245",
  red: "#ba4438",
  blue: "#5b858d",
  leaf: "#6f944d",
  grass: "#829960",
  gold: "#dbb456",
};

function pitchedRoof(
  b: ModelBuilder,
  w: number,
  d: number,
  base: number,
  color: string,
): void {
  const rise = w * 0.34,
    angle = Math.atan2(rise, w / 2),
    len = Math.hypot(w / 2, rise);
  for (const side of [-1, 1])
    b.box(
      color,
      (side * w) / 4,
      base + rise / 2,
      0,
      len + 0.18,
      0.16,
      d + 0.5,
      0,
      0,
      -side * angle,
    );
  // Solid gable, so no hollow paper roof from the side.
  const shape = new Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  b.add(
    new ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }),
    color,
    0,
    base,
    -d / 2,
  );
}

export function houseModel(tier: string, style = 0): BufferGeometry {
  const b = new ModelBuilder(),
    expanded = tier !== "starter",
    w = expanded ? 4.5 : 3.3,
    h = expanded ? 3 : 2.3,
    d = 2.9;
  const wall = [PALETTE.cream, "#d2c3a4", "#c48868", "#dfd6b7"][style % 4];
  b.box("#9c937b", 0, 0.15, 0, w + 0.3, 0.3, d + 0.3).box(
    wall,
    0,
    h / 2 + 0.3,
    0,
    w,
    h,
    d,
  );
  for (let y = 0.55; y < h + 0.25; y += 0.3)
    b.box("#c4b597", 0, y, d / 2 + 0.015, w, 0.035, 0.035);
  pitchedRoof(b, w, d, h + 0.3, PALETTE.roof);
  b.box(PALETTE.brick, -w * 0.3, h + 1, -0.5, 0.48, 1.7, 0.5);
  b.box(PALETTE.wood, 0.45, 1, d / 2 + 0.05, 0.72, 1.4, 0.1).ball(
    PALETTE.gold,
    0.68,
    0.94,
    d / 2 + 0.13,
    0.04,
  );
  for (const x of [-w * 0.32, w * 0.32])
    for (const y of expanded ? [1.2, 2.65] : [1.4]) {
      b.box(PALETTE.trim, x, y, d / 2 + 0.065, 0.83, 0.83, 0.12).box(
        PALETTE.blue,
        x,
        y,
        d / 2 + 0.14,
        0.63,
        0.64,
        0.035,
      );
      b.box(PALETTE.trim, x, y, d / 2 + 0.17, 0.055, 0.7, 0.05).box(
        PALETTE.trim,
        x,
        y,
        d / 2 + 0.17,
        0.7,
        0.055,
        0.05,
      );
    }
  b.box(PALETTE.wood, 0, 0.32, d / 2 + 0.65, w + 0.45, 0.16, 1.2);
  for (const x of [-w / 2, w / 2])
    b.box(PALETTE.trim, x, 1.35, d / 2 + 1, 0.11, 2.05, 0.11);
  b.box(PALETTE.roof, 0, 2.4, d / 2 + 0.6, w + 0.5, 0.14, 1.4, 0.12);
  b.box("#ac9a7e", 0.4, 0.12, d / 2 + 1.35, 1.1, 0.2, 0.5);
  if (tier === "crew-quarters") {
    b.box("#ddcbaa", -3.2, 1.1, 0.3, 2.1, 2.2, 2.8);
    b.box(PALETTE.roof, -3.2, 2.3, 0.3, 2.4, 0.2, 3.1, 0, 0, -0.17);
    b.box(PALETTE.blue, -3.2, 1.3, 1.73, 0.8, 0.7, 0.04);
  }
  return b.finish();
}

export function barnModel(loft: boolean): BufferGeometry {
  const b = new ModelBuilder();
  const w = 4.1,
    d = 3.6,
    h = 3.05;
  b.box("#9e927a", 0, 0.13, 0, w + 0.3, 0.26, d + 0.3).box(
    PALETTE.red,
    0,
    1.65,
    0,
    w,
    3,
    d,
  );
  for (let x = -1.9; x < 2; x += 0.32)
    b.box("#d66c50", x, 1.65, d / 2 + 0.02, 0.05, 2.95, 0.03);
  for (const x of [-2, 2])
    b.box(PALETTE.trim, x, 1.65, d / 2 + 0.06, 0.12, 3.05, 0.12);
  b.box(PALETTE.dark, 0, 1.2, d / 2 + 0.07, 1.85, 2.2, 0.08);
  for (const x of [-0.47, 0.47]) {
    b.box("#7f4936", x, 1.17, d / 2 + 0.13, 0.86, 2.1, 0.08);
    b.box(PALETTE.trim, x, 1.17, d / 2 + 0.19, 0.065, 2.1, 0.04);
  }
  b.box(PALETTE.trim, 0, 2.29, d / 2 + 0.2, 2, 0.13, 0.08);
  for (const side of [-1, 1])
    b.box(
      PALETTE.trim,
      side * 0.47,
      1.2,
      d / 2 + 0.23,
      0.08,
      2.13,
      0.04,
      0,
      0,
      side * 0.42,
    );
  pitchedRoof(b, w, d, h + 0.1, "#674f44");
  b.box(PALETTE.trim, 0, 3.65, d / 2 + 0.06, 0.7, 0.65, 0.12).box(
    PALETTE.blue,
    0,
    3.65,
    d / 2 + 0.14,
    0.52,
    0.46,
    0.035,
  );
  b.box(PALETTE.cream, 0, 4.7, 0, 0.65, 0.55, 0.65).add(
    new ConeGeometry(0.62, 0.4, 4),
    "#674f44",
    0,
    5.15,
    0,
    1,
    1,
    1,
    0,
    Math.PI / 4,
  );
  if (loft) {
    b.box("#a9573f", -3, 1, 0.2, 1.8, 2, 3.4);
    b.box("#674f44", -3, 2.15, 0.2, 2.25, 0.17, 3.8, 0, 0, -0.22);
  }
  return b.finish();
}

export function treeModel(variant = 0): BufferGeometry {
  const b = new ModelBuilder();
  b.cylinder("#775b3e", 0, 0.85, 0, 0.16, 1.7, 0.1);
  if (variant === 1) {
    for (let i = 0; i < 3; i++)
      b.add(
        new ConeGeometry(0.95 - i * 0.18, 1.45, 7),
        i === 2 ? "#8a9e61" : "#5e8051",
        0,
        1.5 + i * 0.53,
        0,
      );
    return b.finish();
  }
  b.box("#775b3e", 0.15, 1.2, 0, 0.12, 0.9, 0.12, 0, 0, -0.5);
  const leaves = ["#66834b", "#7c994f", "#96a75a"];
  b.ball(leaves[variant % 3], 0, 2.15, 0, 0.95, 1.15, 0.86)
    .ball(leaves[(variant + 1) % 3], 0.48, 1.95, 0.24, 0.65, 0.7, 0.7)
    .ball(leaves[variant % 3], -0.5, 1.75, -0.18, 0.62, 0.75, 0.65);
  if (variant === 2)
    for (const p of [
      [0.55, 1.85, 0.55],
      [-0.45, 2, 0.5],
      [0.45, 2.55, 0.2],
    ])
      b.ball("#d7a663", p[0], p[1], p[2], 0.11);
  return b.finish();
}

/** Forward is +X; the same world heading rotates body, wheels and attachments. */
export function vehicleModel(
  tractor: boolean,
  maintenance = false,
): BufferGeometry {
  const b = new ModelBuilder(),
    c = tractor ? PALETTE.red : "#67939a";
  b.box(PALETTE.dark, 0, 0.5, 0, 3.4, 0.25, 1.5);
  if (tractor) {
    b.box(c, 0.62, 1.1, 0, 1.75, 0.85, 1.05).box(
      "#d37754",
      0.58,
      1.55,
      0,
      1.7,
      0.09,
      1.12,
    );
    b.box("#323c39", 1.53, 1.11, 0, 0.05, 0.66, 0.83);
    for (let z = -0.3; z <= 0.3; z += 0.15)
      b.box("#a9aba0", 1.57, 1.1, z, 0.04, 0.53, 0.035);
    b.cylinder("#4a4540", 0.67, 2, -0.37, 0.075, 1.15).box(
      "#493c30",
      -0.83,
      1.2,
      0,
      0.58,
      0.18,
      0.7,
    );
    for (const z of [-0.73, 0.73]) b.box(c, -0.8, 1.25, z, 1.35, 0.16, 0.35);
    b.box("#303735", -0.4, 1.55, 0, 0.08, 0.62, 0.08, 0, 0, -0.35);
    b.cylinder("#333735", -0.28, 1.82, 0, 0.24, 0.055, 0.24, 0, 0.6);
    if (maintenance) {
      b.box("#ddd0a6", 0.3, 1.68, 0, 1.1, 0.1, 1.15, 0, 0, 0.2);
      b.box("#b67e44", -1.2, 0.22, 0, 0.35, 0.45, 1.3);
    }
  } else {
    b.box(c, 0.9, 0.94, 0, 1.65, 0.65, 1.6).box(c, -0.55, 1, 0, 1.3, 0.54, 1.6);
    b.box("#d1dfd2", 0.05, 1.55, 0, 1.28, 0.85, 1.45).box(
      c,
      0.05,
      2.02,
      0,
      1.5,
      0.16,
      1.68,
    );
    b.box(PALETTE.blue, 0.72, 1.67, 0, 0.045, 0.55, 1.24);
    for (const z of [-0.74, 0.74])
      b.box(PALETTE.blue, 0.03, 1.67, z, 1.04, 0.51, 0.04).box(
        c,
        0.05,
        1.67,
        z,
        0.09,
        0.63,
        0.055,
      );
    b.box("#675744", -1.28, 0.79, 0, 1, 0.15, 1.33);
    for (const z of [-0.76, 0.76]) b.box(c, -1.32, 1.12, z, 1.17, 0.52, 0.13);
    b.box(c, -1.86, 1.12, 0, 0.13, 0.52, 1.6).box(
      "#d1d2bb",
      1.81,
      0.63,
      0,
      0.16,
      0.16,
      1.74,
    );
  }
  for (const x of [-1.1, 1.12])
    for (const z of [-0.83, 0.83]) {
      const r = tractor ? (x < 0 ? 0.7 : 0.46) : 0.43;
      b.cylinder("#343936", x, r, z, r, 0.31, r, Math.PI / 2).cylinder(
        "#d7b87d",
        x,
        r,
        z + Math.sign(z) * 0.18,
        r * 0.45,
        0.04,
        r * 0.45,
        Math.PI / 2,
      );
    }
  for (const z of [-0.5, 0.5]) b.box("#fff0ba", 1.8, 1.08, z, 0.05, 0.2, 0.22);
  return b.finish();
}

export function wagonModel(county: boolean, pickup = false): BufferGeometry {
  const b = new ModelBuilder(),
    len = county ? 3.6 : 2.8,
    w = county ? 2.05 : 1.75,
    c = pickup ? "#897453" : "#8b984e";
  b.box("#45483e", 0, 0.48, 0, len, 0.2, w).box(
    PALETTE.wood,
    0,
    0.69,
    0,
    len,
    0.17,
    w,
  );
  for (const z of [-w / 2, w / 2]) {
    b.box(c, 0, 1.13, z, len, 0.76, 0.12);
    for (let x = -len / 2 + 0.15; x < len / 2; x += 0.6)
      b.box("#c5bd83", x, 1.16, z, 0.08, 0.84, 0.16);
  }
  for (const x of [-len / 2, len / 2]) b.box(c, x, 1.13, 0, 0.12, 0.76, w);
  b.box("#55584c", len / 2 + 0.58, 0.47, 0, 1.2, 0.12, 0.12);
  for (const x of county ? [-0.95, 0.95] : [0])
    for (const z of [-w / 2, w / 2])
      b.cylinder("#343936", x, 0.4, z, 0.4, 0.25, 0.4, Math.PI / 2).cylinder(
        "#c9b98a",
        x,
        0.4,
        z + Math.sign(z) * 0.15,
        0.19,
        0.04,
        0.19,
        Math.PI / 2,
      );
  return b.finish();
}

export function personModel(
  shirt = "#65869c",
  hat = true,
  basket = false,
  stride = 0,
  skin = "#e9b887",
): BufferGeometry {
  const b = new ModelBuilder();
  for (const x of [-0.19, 0.19]) {
    const step = Math.sign(x) * stride * 0.16;
    b.box("#435f70", x, 0.39, step, 0.25, 0.62, 0.28);
    b.box("#554639", x, 0.12, 0.09 + step, 0.3, 0.2, 0.44);
  }
  b.box(shirt, 0, 1.02, 0, 0.72, 0.73, 0.4).box(
    "#355a64",
    0,
    0.76,
    0.22,
    0.47,
    0.27,
    0.055,
  );
  b.ball(skin, 0, 1.68, 0, 0.35, 0.4, 0.32).ball(
    skin,
    0,
    1.61,
    0.31,
    0.075,
    0.09,
    0.075,
  );
  for (const side of [-1, 1]) {
    b.box(
      shirt,
      side * 0.46,
      1.03,
      -side * stride * 0.12,
      0.23,
      0.52,
      0.28,
      0,
      0,
      side * 0.14,
    );
    b.ball(
      skin,
      side * 0.48,
      0.73,
      0.02 - side * stride * 0.12,
      0.13,
      0.15,
      0.13,
    );
    b.ball("#39403b", side * 0.12, 1.73, 0.28, 0.035);
  }
  if (hat)
    b.cylinder("#cfab6a", 0, 1.98, 0, 0.48, 0.07).cylinder(
      "#dec183",
      0,
      2.1,
      0,
      0.3,
      0.23,
    );
  else b.ball("#68513d", 0, 1.95, -0.04, 0.35, 0.19, 0.3);
  if (basket) {
    b.box("#b68a51", 0.57, 0.68, 0.2, 0.53, 0.37, 0.42);
    b.box("#e4bd70", 0.57, 0.88, 0.2, 0.56, 0.05, 0.44);
  }
  return b.finish();
}

export function scoutModel(): BufferGeometry {
  const b = new ModelBuilder();
  b.ball("#c38b4f", 0, 0.45, 0, 0.55, 0.34, 0.27).ball(
    "#f4e7c8",
    0.32,
    0.47,
    0,
    0.2,
    0.29,
    0.25,
  );
  for (const x of [-0.31, 0.33])
    for (const z of [-0.18, 0.18])
      b.box("#f4e7c8", x, 0.19, z, 0.17, 0.33, 0.16);
  b.ball("#c38b4f", 0.45, 0.7, 0, 0.29, 0.31, 0.29).ball(
    "#fff0d6",
    0.66,
    0.64,
    0,
    0.17,
    0.15,
    0.22,
  );
  for (const z of [-0.2, 0.2]) {
    b.add(
      new ConeGeometry(0.14, 0.4, 4),
      "#ba7a42",
      0.45,
      1,
      z,
      1,
      1,
      1,
      0,
      0,
      -0.15,
    );
    b.ball("#30342f", 0.65, 0.79, z * 0.8, 0.035);
  }
  b.ball("#34342e", 0.8, 0.7, 0, 0.05, 0.06, 0.08).ball(
    "#f3e4c6",
    -0.53,
    0.59,
    0,
    0.19,
    0.18,
    0.16,
  );
  return b.finish();
}

export function cropModel(id: string, stage: string): BufferGeometry {
  const b = new ModelBuilder(0),
    ripe = stage === "ready",
    dead = stage === "withered",
    small = stage === "seed" || stage === "sprout";
  const leaf = dead ? "#9a8a63" : "#699443",
    stem = dead ? "#827251" : "#50733b";
  const s =
    small || stage === "needs-water"
      ? 0.32
      : stage === "growing"
        ? 0.7
        : dead
          ? 0.78
          : 1;
  const stalk = (x: number, z: number, h: number) =>
    b.cylinder(stem, x, h / 2, z, 0.025, h);
  if (id === "crop_corn") {
    stalk(0, 0, 1.55 * s);
    for (let i = 0; i < 5; i++) {
      const sign = i % 2 ? 1 : -1;
      b.ball(
        leaf,
        sign * 0.18 * s,
        (0.3 + i * 0.2) * s,
        sign * 0.1 * s,
        0.32 * s,
        0.075 * s,
        0.12 * s,
      );
    }
    if (!small) b.ball("#d8bd68", 0, 1.6 * s, 0, 0.055, 0.2 * s, 0.06);
    if (ripe)
      for (const z of [-0.1, 0.13])
        b.ball("#eed063", 0.12, 1.03, z, 0.09, 0.26, 0.09);
  } else if (id === "crop_wheat") {
    for (let i = 0; i < 4; i++) {
      const x = ((i % 2) - 0.5) * 0.13,
        z = (Math.floor(i / 2) - 0.5) * 0.13;
      stalk(x, z, 0.9 * s);
      if (!small)
        b.ball(
          dead ? "#948260" : ripe ? "#e6c66d" : "#a8b367",
          x,
          1 * s,
          z,
          0.075,
          0.2 * s,
          0.075,
        );
    }
  } else if (id === "crop_cabbage") {
    for (let i = 0; i < 5; i++) {
      const a = (i * 6.28) / 5;
      b.ball(
        leaf,
        Math.cos(a) * 0.15 * s,
        0.18 * s,
        Math.sin(a) * 0.15 * s,
        0.22 * s,
        0.14 * s,
        0.22 * s,
      );
    }
    b.ball(
      ripe ? "#c6d697" : leaf,
      0,
      0.3 * s,
      0,
      0.26 * s,
      0.25 * s,
      0.26 * s,
    );
  } else if (id === "crop_pumpkin") {
    b.box(stem, 0, 0.06, 0, 0.8 * s, 0.035, 0.05);
    for (const sign of [-1, 1])
      b.ball(leaf, sign * 0.25 * s, 0.1, 0.12, 0.17 * s, 0.06, 0.17 * s);
    if (ripe) {
      for (let i = 0; i < 7; i++) {
        const a = (i * 6.28) / 7;
        b.ball(
          "#dc8c35",
          Math.cos(a) * 0.11,
          0.24,
          Math.sin(a) * 0.11,
          0.17,
          0.23,
          0.17,
        );
      }
      b.cylinder("#5d7040", 0, 0.48, 0, 0.04, 0.14);
    }
  } else if (id === "crop_carrot") {
    for (let i = 0; i < 5; i++)
      b.ball(
        leaf,
        (i - 2) * 0.055 * s,
        0.29 * s,
        0,
        0.05 * s,
        0.3 * s,
        0.06 * s,
      );
    if (ripe)
      b.add(
        new ConeGeometry(0.115, 0.3, 7),
        "#ea8a3c",
        0,
        0.06,
        0,
        1,
        1,
        1,
        0,
        0,
        Math.PI,
      );
  } else {
    const h = id === "crop_tomato" ? 0.83 : 0.58;
    stalk(0, 0, h * s);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      b.ball(
        leaf,
        Math.cos(a) * 0.17 * s,
        (0.2 + i * 0.09) * s,
        Math.sin(a) * 0.17 * s,
        0.22 * s,
        0.12 * s,
        0.18 * s,
      );
    }
    if (ripe)
      for (let i = 0; i < 3; i++) {
        const a = i * 2.2;
        const c =
          id === "crop_tomato"
            ? "#d95639"
            : id === "crop_potato"
              ? "#bc9761"
              : "#bbbd69";
        b.ball(
          c,
          Math.cos(a) * 0.21,
          id === "crop_potato" ? 0.08 : 0.38,
          Math.sin(a) * 0.21,
          0.085,
          id === "crop_soybean" ? 0.16 : 0.085,
          0.085,
        );
      }
    if (id === "crop_tomato")
      b.box("#b09b69", -0.1, 0.48, 0, 0.045, 0.95, 0.045);
  }
  return b.finish();
}

export function townBuildingModel(
  w: number,
  d: number,
  style: number,
): BufferGeometry {
  const b = new ModelBuilder(),
    h = 2.8,
    c = ["#d9c79b", "#c89b74", "#bfcbc0", "#e0c9a6"][style];
  b.box("#9d9581", 0, 0.12, 0, w + 0.25, 0.24, d + 0.25).box(
    c,
    0,
    h / 2 + 0.24,
    0,
    w,
    h,
    d,
  );
  pitchedRoof(b, w, d, h + 0.24, style === 1 ? "#875e49" : PALETTE.roof);
  b.box(PALETTE.dark, 0, 1, d / 2 + 0.06, 0.8, 1.8, 0.1);
  for (const x of [-w * 0.32, w * 0.32])
    b.box(PALETTE.trim, x, 1.48, d / 2 + 0.08, 1.08, 1.17, 0.15).box(
      PALETTE.blue,
      x,
      1.48,
      d / 2 + 0.17,
      0.86,
      0.92,
      0.04,
    );
  b.box(PALETTE.trim, 0, 2.5, d / 2 + 0.23, w - 0.35, 0.52, 0.18);
  for (let i = 0; i < 8; i++)
    b.box(
      i % 2 ? PALETTE.trim : style === 3 ? "#b45f47" : "#6b8a64",
      -w / 2 + 0.25 + (i * (w - 0.5)) / 8,
      2.2,
      d / 2 + 0.55,
      (w - 0.5) / 8,
      0.12,
      0.8,
      0.12,
    );
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2])
    b.box(PALETTE.wood, x, 1.1, d / 2 + 0.85, 0.08, 2.2, 0.08);
  return b.finish();
}
