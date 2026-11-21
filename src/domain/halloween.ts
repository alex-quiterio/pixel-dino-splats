import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, shadeBand, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#06040c"), eyeWhite: hex("#f4f0ff"), pupil: hex("#0a0610") };

/**
 * body = pumpkin, belly = candlelight, plate = stone and iron;
 * extras = [grass dark, grass light, vine, moon, moon shade, leaf red, bark dark, bark, witch hat]
 */
export const HALLOWEEN_PALETTES: readonly Palette[] = [
  {
    name: "moonlit",
    body: ramp("#5a1e08", "#a2400e", "#e06a1a", "#ffa040"),
    belly: ramp("#7a3a08", "#c87010", "#f4b020", "#fff080"),
    plate: ramp("#141824", "#262e3e", "#465266", "#7a88a0"),
    extras: ramp("#0a1016", "#18242c", "#2e4a36", "#eef0e0", "#b4bab4", "#a01e1e", "#06060a", "#1a1a22", "#2a1a3a", "#3a7ae0"),
    ...common,
  },
  {
    name: "witchlight",
    body: ramp("#5a2a0a", "#9a4a12", "#d4782a", "#f4a850"),
    belly: ramp("#14501a", "#30962a", "#72dc40", "#d8ff90"),
    plate: ramp("#1a2426", "#30403e", "#4e6460", "#7a948c"),
    extras: ramp("#0a1210", "#16241e", "#2e5a22", "#e4f4c8", "#a8c098", "#8a1a3a", "#060808", "#181c1a", "#3a1a4a", "#c040e0"),
    ...common,
  },
  {
    name: "bloodmoon",
    body: ramp("#5a1206", "#962a0c", "#d0501a", "#f08838"),
    belly: ramp("#7a1a08", "#c0400c", "#f08020", "#ffd060"),
    plate: ramp("#2a1a1e", "#462e34", "#6a4a50", "#94707a"),
    extras: ramp("#120a0c", "#241818", "#3a4a1c", "#f06a40", "#a8301e", "#c01a1a", "#0a0606", "#201414", "#2a1030", "#e8d040"),
    ...common,
  },
];

export const HALLOWEEN_VIEW = { target: [0, 3.0, 0] as Vec3, span: 12.5, pitch: 0.16 };

const BAT_ORBIT: Vec3 = [-0.8, 5.6, -1.6];
const MOON: Vec3 = [-2.3, 6.3, -4.4];
const GHOST_HOME: Vec3 = [1.9, 3.3, 0.7];

/** Animated bits keep their rest data here, keyed by splat, so pose() stays a pure function of t. */
type Motion =
  | { kind: "glow"; w: number; bright: Rgb; dim: Rgb }
  | { kind: "candle"; w: number }
  | { kind: "bat"; local: Vec3; phase: number; r: number; h: number; speed: number; wing: number }
  | { kind: "ghost"; local: Vec3; arm: boolean }
  | { kind: "fog"; w: number; speed: number }
  | { kind: "leaf"; w: number; top: number }
  | { kind: "blink" }
  | { kind: "spider"; f: number }
  | { kind: "wisp"; w: number }
  | { kind: "bulb"; i: number; on: Rgb; off: Rgb }
  | { kind: "snow"; w: number; top: number };
const motion = new WeakMap<Splat, Motion>();

type Face = "grin" | "angry" | "spooked";
const tri = (x: number) => Math.abs((((x % 2) + 2) % 2) - 1);

/** Is (u, v), in units of the pumpkin's radii from its centre, cut out of the face? */
function carved(face: Face, u: number, v: number): boolean {
  if (face === "grin") {
    for (const u0 of [-0.36, 0.36]) {
      const dv = v - 0.26;
      if (dv > -0.14 && dv < 0.17 && Math.abs(u - u0) < (0.17 - dv) * 0.85) return true;
    }
    const dn = v - 0.02;
    if (dn > -0.07 && dn < 0.08 && Math.abs(u) < (0.08 - dn) * 0.75) return true;
    if (Math.abs(u) < 0.62) {
      let top = -0.13 + 0.4 * u * u;
      let bottom = -0.44 + 0.55 * u * u;
      if (Math.abs(u) > 0.12 && Math.abs(u) < 0.24) top -= 0.11; // upper teeth
      if (Math.abs(u) < 0.07 || (Math.abs(u) > 0.36 && Math.abs(u) < 0.45)) bottom += 0.1; // lower teeth
      if (v < top && v > bottom) return true;
    }
    return false;
  }
  if (face === "angry") {
    for (const u0 of [-0.34, 0.34]) {
      const du = u - u0;
      const dv = v - 0.24;
      const inner = du * -Math.sign(u0);
      if ((du * du) / 0.045 + (dv * dv) / 0.02 < 1 && dv < 0.04 - inner * 0.55) return true;
    }
    if (Math.abs(u) < 0.06 && v > -0.04 && v < 0.08) return true;
    if (Math.abs(u) < 0.55) {
      const top = -0.14 - 0.09 * tri(u * 9) + 0.25 * u * u;
      const bottom = -0.4 + 0.09 * tri(u * 9 + 1) + 0.35 * u * u;
      if (v < top && v > bottom) return true;
    }
    return false;
  }
  for (const u0 of [-0.3, 0.3]) if ((u - u0) ** 2 + (v - 0.25) ** 2 < 0.02) return true;
  return u * u / 0.025 + (v + 0.22) ** 2 / 0.04 < 1;
}

export function buildHalloween(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 8000);
  const { splats, shell, limb, dot } = createSculptor(rng, 120);
  const [GD, GL, VINE, MOON_LIT, MOON_SHADE, LEAF, BARK_D, BARK, HAT, BULB] = palette.extras as [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb];
  const [, GLOW1, GLOW2, GLOW3] = palette.belly as [Rgb, Rgb, Rgb, Rgb];
  const remap = (from: number, f: (s: Splat) => Splat) => {
    for (let i = from; i < splats.length; i++) splats[i] = f(splats[i]!);
  };
  const tag = (from: number, m: (s: Splat, i: number) => Motion | undefined) => {
    for (let i = from; i < splats.length; i++) {
      const mm = m(splats[i]!, i);
      if (mm) motion.set(splats[i]!, mm);
    }
  };
  /** Lean everything built since `from` around a pivot: ax tips toward the camera, az tips sideways. */
  const lean = (from: number, pivot: Vec3, ax: number, az: number) =>
    remap(from, (s) => {
      let [x, y, z] = [s.position[0] - pivot[0], s.position[1] - pivot[1], s.position[2] - pivot[2]];
      [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
      [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
      return { ...s, position: [x + pivot[0], y + pivot[1], z + pivot[2]] };
    });

  const bark: ColorFn = (_n, p, b) => (Math.sin(p[1] * 22 + Math.sin(p[0] * 9) * 2) > 0.5 ? BARK_D : b > 1 ? BARK : BARK_D);
  const stone: ColorFn = (_n, p, b) => {
    const pit = Math.sin(p[0] * 31) * Math.sin(p[1] * 27 + p[2] * 19) > 0.8;
    return palette.plate[clampBand(pit ? b - 1 : b)]!;
  };
  const iron: ColorFn = (_n, _p, b) => (b > 2 ? palette.plate[1]! : palette.plate[0]!);
  const wax: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.plate[3]!);
  const bone: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.plate[3]!);

  // ---- ground: dark grass, a pool of candlelight in front of the lanterns, scattered leaves
  const lights: [Vec3, number][] = [[[0.3, 0, 2.2], 1.6], [[-1.9, 0, 2.4], 1.1]];
  for (let i = 0; i < 1300; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = Math.cos(a) * rr * 5.6;
    const z = Math.sin(a) * rr * 3.8;
    const lit = lights.some(([c, r]) => Math.hypot(x - c[0], (z - c[2]) * 1.4) < r * rng.range(0.7, 1));
    const c = lit ? (rng.next() < 0.5 ? palette.body[0]! : palette.belly[0]!) : rng.next() < 0.3 ? GL : GD;
    dot([x, 0.02, z], 0.2, c, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 90; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 0.95;
    const x = Math.cos(a) * rr * 5.4;
    const z = Math.sin(a) * rr * 3.6;
    for (let k = 0; k < 4; k++) {
      const lean = rng.range(-0.18, 0.18);
      const h = rng.range(0.2, 0.42);
      for (let f = 0; f <= 1; f += 0.15) dot([x + k * 0.04 + (lean - k * 0.04) * f, h * f, z + lean * 0.4 * f], 0.03, f > 0.5 ? GL : GD);
    }
  }
  const leafColors = [LEAF, palette.body[1]!, palette.body[2]!, palette.belly[1]!];
  for (let i = 0; i < 160; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 0.95;
    dot([Math.cos(a) * rr * 5.3, 0.05, Math.sin(a) * rr * 3.6], 0.08, leafColors[Math.floor(rng.next() * 4)]!, { tall: 0.3 });
  }

  // ---- pumpkins: ribbed, dimpled shells; carved faces glow and flicker
  function pumpkin(c: Vec3, r: Vec3, face: Face | null, density = 120): void {
    const avg = (r[0] + r[1] + r[2]) / 3;
    const count = Math.round(4 * Math.PI * avg * avg * density);
    const sz = Math.min(0.12, r[1] * 0.16);
    const from = splats.length;
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const ang = Math.atan2(u[2], u[0]);
      const groove = Math.pow(1 - Math.abs(Math.cos(ang * 4)), 4);
      const k = (1 - 0.1 * groove) * rng.range(0.95, 1);
      const dimple = 1 - 0.35 * Math.exp(-((u[0] * u[0] + u[2] * u[2]) / 0.06)) * (u[1] > 0 ? 1 : 0.6);
      const p: Vec3 = [c[0] + u[0] * r[0] * k, c[1] + u[1] * r[1] * k * dimple, c[2] + u[2] * r[2] * k];
      const n = normalize([u[0] / r[0], u[1] / r[1], u[2] / r[2]]);
      let b = shadeBand(n);
      if (groove > 0.35) b = clampBand(b - 1);
      if (Math.sin(p[0] * 37) * Math.sin(p[1] * 41 + p[2] * 23) > 0.85) b = clampBand(b + 1); // waxy blemishes
      let color = palette.body[b]!;
      if (face && n[2] > 0.3) {
        const fu = (p[0] - c[0]) / r[0];
        const fv = (p[1] - c[1]) / r[1];
        if (carved(face, fu, fv)) {
          const edge = [[0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04]].some(([du, dv]) => !carved(face, fu + du!, fv + dv!));
          color = edge ? GLOW1 : n[2] > 0.75 ? GLOW3 : GLOW2;
        }
      }
      const s = sz * rng.range(0.85, 1.2);
      splats.push({ position: p, scale: [s, s, s], color, opacity: rng.range(0.85, 0.95) });
    }
    if (face) {
      dot([c[0], c[1], c[2]], Math.min(r[0], r[2]) * 0.6, GLOW2, { opacity: 0.9 }); // the fire inside
      tag(from, (s) => (s.color === GLOW3 || s.color === GLOW2 || s.color === GLOW1 ? { kind: "glow", w: rng.next(), bright: s.color, dim: s.color === GLOW3 ? GLOW2 : GLOW1 } : undefined));
    }
    // a gnarled stem and a curling vine with a leaf
    const top: Vec3 = [c[0], c[1] + r[1] * 0.68, c[2]];
    const stem: ColorFn = (_n, _p, b) => (b > 1 ? VINE : BARK_D);
    limb([top, [top[0] + 0.05, top[1] + r[1] * 0.35, top[2]], [top[0] + r[0] * 0.18, top[1] + r[1] * 0.5, top[2] + 0.05]], r[0] * 0.12, r[0] * 0.07, stem);
    const curl: Vec3[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = i * 0.7;
      const rr = r[0] * (0.35 - i * 0.018);
      curl.push([top[0] - 0.1 + Math.cos(a) * rr, top[1] + 0.05 + i * 0.012, top[2] + Math.sin(a) * rr]);
    }
    limb(curl, 0.025, 0.012, stem);
    shell([top[0] - r[0] * 0.35, top[1] + 0.02, top[2] - r[2] * 0.25], [r[0] * 0.25, 0.03, r[0] * 0.18], (_n, p, b) => (Math.abs(p[2] - top[2] + r[2] * 0.25) < 0.02 ? GL : b > 1 ? VINE : GL));
  }
  pumpkin([0.3, 0.88, 1.0], [1.2, 0.88, 1.1], "grin");
  pumpkin([-1.9, 0.58, 1.6], [0.74, 0.58, 0.7], "angry");
  pumpkin([2.3, 0.4, 2.0], [0.5, 0.4, 0.48], "spooked");
  pumpkin([3.0, 0.27, 1.2], [0.34, 0.27, 0.33], null, 140);
  pumpkin([-3.2, 0.3, 2.1], [0.38, 0.3, 0.36], null, 140);
  // a ground vine stringing the patch together
  const vine: Vec3[] = [];
  for (let i = 0; i <= 24; i++) vine.push([-3.6 + i * 0.3, 0.06, 2.6 + Math.sin(i * 0.9) * 0.35]);
  limb(vine, 0.04, 0.03, (_n, _p, b) => (b > 1 ? VINE : GL));
  for (let i = 2; i < 24; i += 3) shell([vine[i]![0], 0.1, vine[i]![2] + 0.15], [0.16, 0.03, 0.12], (_n, _p, b) => (b > 1 ? VINE : GL));

  // witch hat perched crooked on the angry pumpkin
  {
    const from = splats.length;
    const hat: ColorFn = (_n, p, b) => (Math.abs(p[1] - 1.24) < 0.06 ? HAT : Math.floor(p[1] * 7) % 2 === 0 ? (b > 0 ? palette.eyeWhite : palette.plate[3]!) : b > 2 ? palette.plate[0]! : palette.outline);
    shell([-1.9, 1.1, 1.6], [0.78, 0.04, 0.74], hat);
    const cone: Vec3[] = [[-1.9, 1.12, 1.6], [-1.9, 1.7, 1.6], [-1.78, 2.15, 1.6]];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + i * 0.5;
      const rr = 0.32 * (1 - i / 14);
      cone.push([-1.78 + 0.32 + Math.cos(a) * rr, 2.15 + Math.sin(a) * rr * -1 + 0.0, 1.6]);
    }
    limb(cone, 0.45, 0.025, hat);
    dot([-1.9, 1.24, 2.06], 0.08, GLOW3, { tall: 0.9 }); // buckle
    dot([-1.9, 1.24, 2.08], 0.04, LEAF);
    lean(from, [-1.9, 1.1, 1.6], 0.08, -0.18);
  }

  // ---- candles: one by the big lantern, a cluster on the grave
  function candle(x: number, z: number, h: number): void {
    limb([[x, 0, z], [x, h, z]], 0.075, 0.07, wax);
    for (const d of [-1, 1]) limb([[x + d * 0.07, h, z + 0.02], [x + d * 0.075, h - rng.range(0.1, 0.25), z + 0.03]], 0.025, 0.015, wax); // drips
    dot([x, h + 0.02, z], 0.015, palette.outline, { tall: 4 }); // wick
    const from = splats.length;
    dot([x, h + 0.14, z], 0.05, GLOW3, { tall: 2.2 });
    dot([x, h + 0.12, z], 0.08, GLOW2, { tall: 1.6, opacity: 0.75 });
    tag(from, () => ({ kind: "candle", w: rng.next() }));
  }
  candle(1.75, 1.75, 0.45);
  candle(1.95, 1.45, 0.3);
  candle(-0.4, -0.65, 0.5);
  candle(-0.15, -0.55, 0.32);
  candle(-1.3, -0.7, 0.4);

  // ---- graves: arched headstones with engraved crosses, moss and cracks; a stone cross
  function headstone(base: Vec3, w: number, h: number, d: number, tiltX: number, tiltZ: number): void {
    const from = splats.length;
    const rIn = w / 2;
    const engrave = (u: number, v: number) =>
      (Math.abs(u) < 0.035 && v > h * 0.38 && v < h * 0.86) ||
      (Math.abs(v - h * 0.72) < 0.035 && Math.abs(u) < w * 0.22) ||
      (Math.abs(v - h * 0.27) < 0.022 && Math.abs(u) < w * 0.3) ||
      (Math.abs(v - h * 0.19) < 0.022 && Math.abs(u) < w * 0.22);
    const face = (u: number, v: number, front: boolean): Rgb => {
      if (v < 0.12 + 0.08 * Math.sin(u * 17)) return rng.next() < 0.5 ? VINE : GL; // moss creeping up
      if (front && engrave(u, v)) return palette.plate[0]!;
      if (Math.abs(u - (v - h * 0.5) * 0.5 - w * 0.2) < 0.018 && v > h * 0.45) return palette.plate[0]!; // crack
      const b = front ? 2 : 1;
      return palette.plate[clampBand(Math.sin(u * 31) * Math.sin(v * 29) > 0.75 ? b + 1 : b)]!;
    };
    const area = w * h * 2;
    for (let i = 0; i < area * 260; i++) {
      const u = rng.range(-rIn, rIn);
      const v = rng.range(0, h);
      if (v > h - rIn && u * u + (v - (h - rIn)) ** 2 > rIn * rIn) continue;
      const front = rng.next() < 0.55;
      dot([base[0] + u, base[1] + v, base[2] + (front ? d / 2 : -d / 2)], 0.05, face(u, v, front), { opacity: 0.95 });
    }
    for (let i = 0; i < (2 * h + Math.PI * rIn) * 50; i++) {
      const s = rng.range(0, 2 * (h - rIn) + Math.PI * rIn);
      let u: number;
      let v: number;
      if (s < h - rIn) [u, v] = [-rIn, s];
      else if (s < 2 * (h - rIn)) [u, v] = [rIn, s - (h - rIn)];
      else {
        const a = (s - 2 * (h - rIn)) / rIn;
        [u, v] = [Math.cos(a) * rIn, h - rIn + Math.sin(a) * rIn];
      }
      const lit = u > 0 || v > h - rIn;
      dot([base[0] + u, base[1] + v, base[2] + rng.range(-d / 2, d / 2)], 0.05, v < 0.12 ? VINE : palette.plate[lit ? 2 : 0]!, { opacity: 0.95 });
    }
    lean(from, base, tiltX, tiltZ);
    // a mound of turned earth in front
    shell([base[0], 0.02, base[2] + 0.75], [w * 0.55, 0.12, 0.6], (_n, _p, b) => (b > 2 ? BARK : BARK_D));
  }
  headstone([-0.85, 0, -1.2], 1.15, 1.55, 0.2, -0.05, 0.06);
  headstone([1.5, 0, -1.4], 0.9, 1.15, 0.18, 0.12, -0.16);
  headstone([-2.4, 0, -2.0], 0.7, 0.85, 0.16, -0.1, 0.22);
  {
    const from = splats.length;
    limb([[3.4, 0, -1.8], [3.4, 1.7, -1.8]], 0.13, 0.11, stone);
    limb([[2.95, 1.25, -1.8], [3.85, 1.25, -1.8]], 0.11, 0.11, stone);
    shell([3.4, 1.25, -1.8], [0.15, 0.15, 0.12], stone);
    for (let i = 0; i < 12; i++) dot([3.4 + rng.range(-0.1, 0.1), rng.range(0.05, 0.6), -1.8 + 0.12], 0.04, VINE); // ivy
    lean(from, [3.4, 0, -1.8], 0.05, 0.2);
  }
  // a skull in the grass and a pair of crossed bones
  shell([-0.2, 0.2, 0.0], [0.22, 0.2, 0.2], bone);
  shell([-0.15, 0.1, 0.12], [0.14, 0.08, 0.1], bone);
  for (const s of [-1, 1]) dot([-0.2 + s * 0.08, 0.22, 0.17], 0.055, palette.pupil);
  dot([-0.2, 0.13, 0.2], 0.03, palette.pupil);
  for (let i = -2; i <= 2; i++) dot([-0.15 + i * 0.035, 0.05, 0.22], 0.018, palette.pupil, { tall: 1.5 });
  limb([[0.15, 0.05, 0.25], [0.65, 0.05, 0.55]], 0.04, 0.04, bone);
  limb([[0.15, 0.05, 0.55], [0.65, 0.05, 0.25]], 0.04, 0.04, bone);
  for (const [x, z] of [[0.15, 0.25], [0.65, 0.55], [0.15, 0.55], [0.65, 0.25]] as const) shell([x, 0.06, z], [0.06, 0.05, 0.06], bone);
  // toadstools
  for (const [x, z, h] of [[-3.0, 0.6, 0.35], [-2.7, 0.9, 0.22], [3.6, 0.3, 0.3], [4.0, 0.6, 0.2]] as const) {
    limb([[x, 0, z], [x, h, z]], 0.05, 0.04, bone);
    shell([x, h, z], [h * 0.55, h * 0.3, h * 0.55], (n, p, b) => (n[1] > 0.3 && Math.sin(p[0] * 40) * Math.sin(p[2] * 40) > 0.6 ? palette.eyeWhite : b > 1 ? LEAF : palette.body[0]!));
  }

  // ---- wrought-iron fence behind the graves, a couple of bars bent
  for (let x = -3.6; x <= 4.6; x += 0.68) {
    const bend = Math.abs(x - 2.52) < 0.3 ? 0.25 : 0;
    const z = -2.9;
    limb([[x, 0, z], [x + bend * 0.4, 0.9, z], [x + bend, 1.55, z]], 0.04, 0.04, iron);
    limb([[x + bend, 1.55, z], [x + bend * 1.1, 1.82, z]], 0.075, 0.012, iron);
    shell([x + bend * 0.2, 0.42, z], [0.06, 0.06, 0.06], iron);
  }
  for (const y of [0.42, 1.3]) limb([[-3.6, y, -2.9], [4.6, y, -2.9]], 0.035, 0.035, iron);
  for (let x = -3.6; x <= 3.9; x += 1.36) {
    const pts: Vec3[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      pts.push([x + 0.34 - Math.cos(a) * 0.34, 1.3 - Math.sin(a) * 0.3, -2.9]);
    }
    limb(pts, 0.022, 0.022, iron); // scrollwork
  }

  // ---- the dead tree: twisted trunk, roots, gnarled branches, a perch and a web
  const trunkBase: Vec3 = [-3.9, 0, -1.3];
  limb([trunkBase, [-3.75, 1.0, -1.3], [-4.0, 1.9, -1.25], [-3.8, 2.8, -1.3]], 0.42, 0.24, bark);
  for (const [dx, dz] of [[0.7, 0.3], [-0.6, 0.4], [0.3, -0.6], [-0.5, -0.4]] as const) {
    limb([[-3.9, 0.3, -1.3], [-3.9 + dx * 0.6, 0.1, -1.3 + dz * 0.6], [-3.9 + dx, 0.02, -1.3 + dz]], 0.18, 0.04, bark);
  }
  shell([-3.78, 1.2, -1.0], [0.12, 0.18, 0.06], () => palette.outline); // knothole
  function branch(from: Vec3, dir: Vec3, len: number, r: number, depth: number): void {
    const j = () => rng.range(-0.25, 0.25);
    const mid: Vec3 = [from[0] + dir[0] * len * 0.5 + j() * len * 0.4, from[1] + dir[1] * len * 0.5 + j() * len * 0.4, from[2] + dir[2] * len * 0.5];
    const to: Vec3 = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
    limb([from, mid, to], r, r * 0.55, bark);
    if (depth === 0) {
      // curl the twig tip into a tight spiral
      const curl: Vec3[] = [to];
      const turn = dir[0] >= 0 ? -1 : 1;
      const a0 = Math.atan2(dir[1], dir[0]);
      const rr0 = len * 0.28;
      const c: Vec3 = [to[0] + Math.cos(a0 + turn * Math.PI / 2) * rr0, to[1] + Math.sin(a0 + turn * Math.PI / 2) * rr0, to[2]];
      for (let i = 1; i <= 16; i++) {
        const a = a0 - turn * Math.PI / 2 + turn * i * 0.55;
        const rr = rr0 * (1 - i / 20);
        curl.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2]]);
      }
      limb(curl, r * 0.55, 0.012, bark);
      return;
    }
    for (let k = 0; k < 2; k++) {
      const nd = normalize([dir[0] + (k === 0 ? -0.6 : 0.6) + j(), dir[1] + j() * 0.6, dir[2] + j()]);
      branch(to, nd, len * 0.68, r * 0.55, depth - 1);
    }
  }
  branch([-3.8, 2.8, -1.3], normalize([-0.4, 1, 0.1]), 1.3, 0.2, 3);
  branch([-3.85, 2.2, -1.3], normalize([-1, 0.5, -0.2]), 1.1, 0.16, 2);
  const perch: Vec3 = [-2.3, 3.55, -1.15];
  limb([[-3.82, 2.6, -1.3], [-3.0, 3.25, -1.2], perch, [-1.75, 3.75, -1.1]], 0.17, 0.04, bark);
  limb([[-2.1, 3.62, -1.13], [-1.8, 4.1, -1.1]], 0.05, 0.015, bark);

  // owl on the perch, blinking its burning eyes
  {
    const o: Vec3 = [perch[0], perch[1] + 0.42, perch[2]];
    const feathers: ColorFn = (n, p, b) => (n[2] > 0.4 && n[1] < 0.3 ? (Math.sin(p[1] * 40) > 0.3 ? palette.plate[3]! : palette.plate[2]!) : Math.sin(p[1] * 30 + p[0] * 10) > 0.6 ? BARK_D : b > 1 ? BARK : BARK_D);
    shell(o, [0.3, 0.4, 0.28], feathers);
    shell([o[0], o[1] + 0.42, o[2]], [0.27, 0.22, 0.24], feathers);
    for (const s of [-1, 1]) {
      limb([[o[0] + s * 0.15, o[1] + 0.55, o[2]], [o[0] + s * 0.24, o[1] + 0.76, o[2] - 0.02]], 0.06, 0.015, feathers); // ear tufts
      shell([o[0] + s * 0.11, o[1] + 0.42, o[2] + 0.18], [0.11, 0.11, 0.05], () => palette.plate[3]!); // facial disc
      shell([o[0] + s * 0.24, o[1] - 0.02, o[2] + 0.02], [0.08, 0.3, 0.2], feathers); // folded wing
      for (const dz of [-0.06, 0.06]) limb([[o[0] + s * 0.1, perch[1] + 0.06, o[2] + 0.12 + dz], [o[0] + s * 0.1, perch[1] - 0.02, o[2] + 0.2 + dz]], 0.025, 0.01, () => palette.outline); // talons
      const from = splats.length;
      dot([o[0] + s * 0.11, o[1] + 0.43, o[2] + 0.24], 0.075, GLOW3);
      dot([o[0] + s * 0.11, o[1] + 0.43, o[2] + 0.28], 0.035, palette.pupil);
      tag(from, () => ({ kind: "blink" }));
    }
    limb([[o[0], o[1] + 0.38, o[2] + 0.24], [o[0], o[1] + 0.3, o[2] + 0.3]], 0.035, 0.01, () => GLOW1); // beak
  }

  // spider web in the crook of the tree, and its spider dangling from a thread
  {
    const c: Vec3 = [-3.3, 3.0, -1.0];
    const silk = palette.plate[3]!;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      for (let d = 0.08; d < 0.62; d += 0.05) dot([c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.9, c[2]], 0.018, silk, { opacity: 0.8 });
    }
    for (let d = 0.12; d < 0.6; d += 0.09) {
      for (let a = 0; a < Math.PI * 2; a += 0.11) dot([c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d * 0.9, c[2]], 0.014, silk, { opacity: 0.7 });
    }
    const top: Vec3 = [-2.6, 3.42, -1.17];
    const from = splats.length;
    for (let y = top[1]; y > 2.3; y -= 0.04) dot([top[0], y, top[2]], 0.012, silk, { opacity: 0.8 });
    const body = splats.length;
    shell([top[0], 2.25, top[2]], [0.09, 0.1, 0.08], () => palette.outline);
    shell([top[0], 2.38, top[2]], [0.06, 0.05, 0.06], () => palette.outline);
    dot([top[0] + 0.03, 2.39, top[2] + 0.06], 0.02, LEAF);
    dot([top[0] - 0.03, 2.39, top[2] + 0.06], 0.02, LEAF);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) limb([[top[0], 2.3, top[2]], [top[0] + s * 0.18, 2.36 - i * 0.04, top[2] + (i - 1.5) * 0.05], [top[0] + s * 0.26, 2.2 - i * 0.03, top[2] + (i - 1.5) * 0.07]], 0.014, 0.008, () => palette.outline);
    tag(from, (s, i) => ({ kind: "spider", f: i >= body ? 1 : (top[1] - s.position[1]) / (top[1] - 2.3) }));
  }

  // ---- full moon with craters, hanging behind everything
  shell(MOON, [1.85, 1.85, 0.35], (_n, p, b) => {
    const [mx, my] = [p[0] - MOON[0], p[1] - MOON[1]];
    const crater = Math.sin(mx * 4 + 1) * Math.sin(my * 5) > 0.6 || Math.hypot(mx + 0.6, my - 0.5) < 0.3 || Math.hypot(mx - 0.7, my + 0.4) < 0.4 || Math.hypot(mx - 0.2, my - 0.9) < 0.18;
    return crater || b < 1 ? MOON_SHADE : MOON_LIT;
  }, undefined, 0.13);
  // thin clouds drifting across the moon's face
  for (let i = 0; i < 60; i++) {
    const y = MOON[1] + (i % 2 === 0 ? -0.6 : 0.8) + rng.range(-0.08, 0.08);
    dot([MOON[0] + rng.range(-2.6, 2.4), y, MOON[2] + 0.5], rng.range(0.12, 0.2), palette.plate[1]!, { tall: 0.35, opacity: 0.9 });
  }

  // ---- a little ghost drifting over the patch
  {
    const from = splats.length;
    const sheet = (n: Vec3): Rgb => (shadeBand(n) <= 1 ? palette.plate[3]! : palette.eyeWhite);
    for (let i = 0; i < 1500; i++) {
      const k = Math.pow(rng.next(), 0.8);
      const a = rng.range(0, Math.PI * 2);
      const cx = -0.55 * k * k + 0.15 * Math.sin(k * 5);
      const cy = 0.35 - 1.6 * k;
      const cz = -0.35 * k;
      const r = 0.46 * Math.pow(1 - k, 0.7) + 0.03;
      const n = normalize([Math.cos(a), 0.1, Math.sin(a)]);
      dot([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r], 0.07 * (1 - k * 0.5), sheet(n), { opacity: 0.92 });
    }
    for (let i = 0; i < 500; i++) {
      const u = rng.onSphere();
      if (u[1] < 0) continue;
      dot([u[0] * 0.45, 0.35 + u[1] * 0.5, u[2] * 0.45], 0.07, sheet(u), { opacity: 0.92 });
    }
    for (const s of [-1, 1]) {
      dot([s * 0.15, 0.48, 0.42], 0.085, palette.pupil, { tall: 1.9 }); // hollow, drooping eye sockets
      dot([s * 0.13, 0.52, 0.47], 0.02, palette.eyeWhite);
    }
    dot([0, 0.2, 0.45], 0.07, palette.pupil, { tall: 1.9 }); // a long, moaning mouth
    const body = splats.length;
    for (const s of [-1, 1]) limb([[s * 0.42, 0.05, 0.05], [s * 0.66, 0.2, 0.25], [s * 0.72, 0.36, 0.4]], 0.11, 0.06, (n) => sheet(n));
    for (let i = from; i < splats.length; i++) {
      const s = splats[i]!;
      const local = s.position;
      const moved: Splat = { ...s, position: [local[0] + GHOST_HOME[0], local[1] + GHOST_HOME[1], local[2] + GHOST_HOME[2]] };
      splats[i] = moved;
      motion.set(moved, { kind: "ghost", local, arm: i >= body });
    }
  }

  // ---- bats wheeling past the moon
  for (let k = 0; k < 6; k++) {
    const from = splats.length;
    const size = rng.range(0.75, 1.25);
    const fur: ColorFn = (_n, _p, b) => (b > 2 ? palette.plate[1]! : palette.plate[0]!);
    shell([0, 0, 0], [0.13, 0.1, 0.1], fur);
    shell([0.15, 0.03, 0], [0.08, 0.08, 0.08], fur);
    for (const s of [-1, 1]) {
      limb([[0.15, 0.08, s * 0.04], [0.15, 0.18, s * 0.06]], 0.035, 0.008, fur); // ears
      dot([0.22, 0.05, s * 0.04], 0.022, LEAF);
      const sh: Vec3 = [0, 0.02, s * 0.08];
      const wrist: Vec3 = [0.12, 0.1, s * 0.45];
      const tip: Vec3 = [-0.05, 0.03, s * 0.88];
      const f1: Vec3 = [-0.22, -0.02, s * 0.68];
      const f2: Vec3 = [-0.2, 0, s * 0.38];
      const root: Vec3 = [-0.13, 0, s * 0.1];
      limb([sh, wrist, tip], 0.025, 0.012, () => palette.outline);
      for (const f of [f1, f2]) limb([wrist, f], 0.015, 0.01, () => palette.outline);
      for (const [a, b, c] of [[sh, wrist, tip], [wrist, tip, f1], [wrist, f1, f2], [sh, wrist, f2], [sh, f2, root]] as [Vec3, Vec3, Vec3][]) {
        for (let i = 0; i < 26; i++) {
          let u = rng.next();
          let v = rng.next();
          if (u + v > 1) [u, v] = [1 - u, 1 - v];
          dot([a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v], 0.045, palette.plate[rng.next() < 0.3 ? 1 : 0]!);
        }
      }
    }
    const phase = (k / 6) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const meta = { phase, r: rng.range(1.6, 3.2), h: rng.range(-0.7, 1.2), speed: rng.range(0.5, 0.8) * (k % 3 === 0 ? -1 : 1) };
    for (let i = from; i < splats.length; i++) {
      const s = splats[i]!;
      const local: Vec3 = [s.position[0] * size, s.position[1] * size, s.position[2] * size];
      const m: Motion = { kind: "bat", local, wing: Math.abs(local[2]) > 0.1 * size ? Math.abs(local[2]) / size : 0, ...meta };
      const placed: Splat = { ...s, scale: [s.scale[0] * size, s.scale[1] * size, s.scale[2] * size], position: placeBat(m, 0) };
      splats[i] = placed;
      motion.set(placed, m);
    }
  }

  // ---- a crooked striped lamppost whose top curls over to hang a lantern
  {
    const from = splats.length;
    const pole: ColorFn = (_n, p, b) => (Math.floor((p[1] + p[0] * 0.3) * 5) % 2 === 0 ? (b > 1 ? palette.eyeWhite : palette.plate[3]!) : palette.outline);
    const pts: Vec3[] = [[3.7, 0, -0.5], [3.62, 1.2, -0.5], [3.75, 2.4, -0.5], [3.6, 3.2, -0.5]];
    const c: Vec3 = [3.25, 3.2, -0.5];
    for (let i = 1; i <= 14; i++) {
      const a = i * 0.42;
      const rr = 0.35 * (1 - i / 22);
      pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, c[2]]);
    }
    limb(pts, 0.09, 0.03, pole);
    shell([3.7, 0.1, -0.5], [0.2, 0.1, 0.2], () => palette.outline);
    limb([[3.25, 2.95, -0.5], [3.25, 2.7, -0.5]], 0.015, 0.015, () => palette.outline);
    shell([3.25, 2.5, -0.5], [0.16, 0.2, 0.16], (_n, p, b) => (Math.abs(p[0] - 3.25) < 0.03 || Math.abs(p[2] + 0.5) < 0.03 ? palette.outline : b > 1 ? GLOW3 : GLOW2));
    shell([3.25, 2.72, -0.5], [0.19, 0.05, 0.19], () => palette.outline);
    tag(from, (s) => (s.color === GLOW3 || s.color === GLOW2 ? { kind: "glow", w: rng.next(), bright: s.color, dim: GLOW1 } : undefined));
  }

  // ---- a lopsided, spooky gift box with a striped ribbon; something glows inside the crack
  {
    const from = splats.length;
    const g: Vec3 = [-0.45, 0, 2.55];
    const [hw, hh] = [0.32, 0.5];
    const ribbon = (p: Vec3) => Math.abs(p[0] - g[0]) < 0.07 || Math.abs(p[2] - g[2]) < 0.07;
    const wrap = (p: Vec3, b: number): Rgb => (ribbon(p) ? (Math.floor((p[1] + p[0] + p[2]) * 12) % 2 === 0 ? LEAF : palette.eyeWhite) : b > 1 ? HAT : palette.plate[0]!);
    for (let i = 0; i < 900; i++) {
      const face = Math.floor(rng.next() * 5);
      const [u, v] = [rng.range(-1, 1), rng.range(0, 1)];
      const p: Vec3 = face === 0 ? [g[0] + u * hw, hh, g[2] + rng.range(-1, 1) * hw] : face === 1 ? [g[0] + hw, v * hh, g[2] + u * hw] : face === 2 ? [g[0] - hw, v * hh, g[2] + u * hw] : face === 3 ? [g[0] + u * hw, v * hh, g[2] + hw] : [g[0] + u * hw, v * hh, g[2] - hw];
      const n: Vec3 = face === 0 ? [0, 1, 0] : face === 1 ? [1, 0, 0] : face === 2 ? [-1, 0, 0] : face === 3 ? [0, 0, 1] : [0, 0, -1];
      const crack = face === 3 && Math.abs(p[1] - hh + 0.06) < 0.03;
      dot(p, 0.05, crack ? GLOW3 : wrap(p, shadeBand(n)), { opacity: 0.95 });
    }
    lean(from, g, 0.0, 0.14);
    const bowFrom = splats.length;
    const bow: ColorFn = (_n, p, b) => (Math.floor(p[0] * 20) % 2 === 0 ? LEAF : b > 1 ? palette.eyeWhite : palette.plate[3]!);
    for (const s of [-1, 1]) limb([[g[0], hh + 0.02, g[2]], [g[0] + s * 0.15, hh + 0.22, g[2]], [g[0] + s * 0.3, hh + 0.12, g[2]], [g[0] + s * 0.1, hh + 0.04, g[2]]], 0.05, 0.03, bow);
    limb([[g[0], hh, g[2]], [g[0] + 0.12, hh - 0.1, g[2] + 0.25]], 0.035, 0.02, bow);
    lean(bowFrom, g, 0.0, 0.14);
  }

  // ---- a string of coloured bulbs sagging from the tree across to the lamppost
  {
    const strands: [Vec3, Vec3, number][] = [[[-1.8, 3.72, -1.1], [3.4, 3.05, -0.5], 1.1], [[-3.6, 3.4, -1.25], [-1.8, 3.72, -1.1], 0.45]];
    const colors = [LEAF, VINE, GLOW3, BULB];
    let n = 0;
    for (const [a, b, sag] of strands) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const steps = Math.round(len / 0.05);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const p: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f];
        dot(p, 0.018, palette.outline);
        if (i % 6 === 3) {
          const on = colors[n % 4]!;
          const from = splats.length;
          dot([p[0], p[1] - 0.09, p[2]], 0.05, on, { tall: 1.4 });
          dot([p[0], p[1] - 0.09, p[2]], 0.1, on, { opacity: 0.45 });
          tag(from, () => ({ kind: "bulb", i: n, on, off: palette.plate[1]! }));
          n++;
        }
      }
    }
  }

  // ---- low fog creeping between the graves, will-o'-wisps, and leaves falling from the tree
  for (let i = 0; i < 26; i++) {
    const cx = rng.range(-5, 5);
    const cz = rng.range(-2.4, 0.4);
    const speed = rng.range(0.6, 1.4);
    const w = rng.next();
    for (let k = 0; k < 4; k++) {
      const from = splats.length;
      dot([cx + rng.range(-0.4, 0.4), rng.range(0.06, 0.18), cz + rng.range(-0.3, 0.3)], rng.range(0.16, 0.26), palette.plate[k % 2 === 0 ? 2 : 3]!, { opacity: 0.45, tall: 0.35 });
      tag(from, () => ({ kind: "fog", w, speed }));
    }
  }
  for (const [x, y, z] of [[-1.2, 2.2, -0.2], [3.0, 2.6, -0.8], [-2.8, 1.5, 0.6]] as const) {
    const from = splats.length;
    dot([x, y, z], 0.07, palette.eyeWhite);
    dot([x, y, z], 0.16, VINE, { opacity: 0.5 });
    tag(from, () => ({ kind: "wisp", w: rng.next() }));
  }
  for (let i = 0; i < 18; i++) {
    const from = splats.length;
    const top = rng.range(3.2, 4.6);
    dot([rng.range(-4.8, -1.8), top, rng.range(-1.8, 0.5)], 0.07, leafColors[i % 4]!, { tall: 0.5 });
    tag(from, () => ({ kind: "leaf", w: rng.next(), top }));
  }
  // the first snow of the season drifting down over everything
  for (let i = 0; i < 60; i++) {
    const from = splats.length;
    const top = rng.range(5.5, 7.5);
    dot([rng.range(-4.2, 4.2), rng.range(0, top), rng.range(-2.4, 2.4)], 0.045, palette.eyeWhite);
    tag(from, () => ({ kind: "snow", w: rng.next(), top }));
  }
  return splats;
}

function placeBat(m: Extract<Motion, { kind: "bat" }>, t: number): Vec3 {
  const a = m.phase + t * m.speed;
  const cx = BAT_ORBIT[0] + Math.cos(a) * m.r;
  const cz = BAT_ORBIT[2] + Math.sin(a) * m.r * 0.55;
  const cy = BAT_ORBIT[1] + m.h + Math.sin(t * 2.3 + m.phase * 3) * 0.25;
  // nose points along the direction of travel; wings span across it
  const dir = Math.sign(m.speed);
  const hx0 = -Math.sin(a) * dir;
  const hz0 = Math.cos(a) * 0.55 * dir;
  const hl = Math.hypot(hx0, hz0) || 1;
  const [hx, hz] = [hx0 / hl, hz0 / hl];
  const [lx, ly, lz] = m.local;
  const flap = m.wing > 0 ? Math.sin(t * 15 + m.phase * 5) * 0.55 * m.wing : 0;
  return [cx + lx * hx - lz * hz, cy + ly + flap, cz + lx * hz + lz * hx];
}

/** Candlelight flickers, bats wheel, the ghost bobs, fog creeps, the owl blinks, the spider bounces. */
export function poseHalloween(splats: readonly Splat[], t: number): Splat[] {
  const ghostX = Math.sin(t * 0.8) * 0.35;
  const ghostY = Math.sin(t * 1.7) * 0.22;
  const blink = t % 3.3 < 0.18;
  return splats.map((s) => {
    const m = motion.get(s);
    if (!m) return s;
    const [x, y, z] = s.position;
    switch (m.kind) {
      case "glow": {
        const f = Math.sin(t * 13 + m.w * 17) + Math.sin(t * 7.3 + m.w * 5) + Math.sin(t * 3.1);
        return f > 1.4 ? { ...s, color: m.dim } : s;
      }
      case "candle": {
        const sway = Math.sin(t * 9 + m.w * 7) * 0.025 + Math.sin(t * 23 + m.w * 3) * 0.01;
        const k = 1 + Math.sin(t * 17 + m.w * 11) * 0.15;
        return { ...s, position: [x + sway, y + (k - 1) * 0.05, z], scale: [s.scale[0], s.scale[1] * k, s.scale[2]] };
      }
      case "bat":
        return { ...s, position: placeBat(m, t) };
      case "ghost": {
        const [lx, ly, lz] = m.local;
        const hem = ly < -0.4 ? (-0.4 - ly) * 2 : 0;
        const ang = Math.atan2(lz, lx);
        const wave = Math.sin(t * 4.5 + ang * 3) * 0.08 * hem;
        const arm = m.arm ? Math.sin(t * 3) * 0.08 * Math.max(0, Math.abs(lx) - 0.4) * 4 : 0;
        return { ...s, position: [GHOST_HOME[0] + lx + ghostX + wave * Math.cos(ang) - hem * 0.05 * Math.sin(t * 0.8), GHOST_HOME[1] + ly + ghostY + arm, GHOST_HOME[2] + lz + wave * Math.sin(ang)] };
      }
      case "fog": {
        const nx = ((((x + 5 + t * 0.35 * m.speed) % 10) + 10) % 10) - 5;
        const fade = Math.min(1, (5 - Math.abs(nx)) / 1.2);
        return { ...s, position: [nx, y + Math.sin(t * 0.9 + m.w * 6) * 0.05, z], opacity: s.opacity * Math.max(0, fade) * (0.85 + 0.15 * Math.sin(t * 1.3 + m.w * 9)) };
      }
      case "leaf": {
        const a = (t * 0.18 + m.w) % 1;
        return { ...s, position: [x + Math.sin(a * 12 + m.w * 9) * 0.3 + a * 0.8, m.top - a * (m.top - 0.06), z + Math.cos(a * 9) * 0.15], opacity: a > 0.93 ? (1 - a) * 14 : 1 };
      }
      case "blink":
        return blink ? { ...s, opacity: 0 } : s;
      case "spider":
        return { ...s, position: [x + Math.sin(t * 0.9) * 0.04 * m.f, y + Math.sin(t * 1.4) * 0.28 * m.f, z] };
      case "bulb": {
        const lit = Math.floor(t * 3) % 3 !== m.i % 3 || Math.sin(t * 11 + m.i) > 0.95;
        return lit ? s : { ...s, color: m.off, opacity: s.opacity * 0.7 };
      }
      case "snow": {
        const a = (t * 0.07 + m.w) % 1;
        return { ...s, position: [x + Math.sin(a * 14 + m.w * 20) * 0.2, m.top * (1 - a), z + Math.cos(a * 11 + m.w * 7) * 0.12] };
      }
      case "wisp": {
        const a = t * 0.9 + m.w * 6;
        return { ...s, position: [x + Math.sin(a) * 0.4, y + Math.sin(a * 1.7) * 0.25, z + Math.cos(a) * 0.3] };
      }
    }
  });
}
