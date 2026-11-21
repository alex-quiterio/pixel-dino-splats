import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, shadeBand, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#020204"), eyeWhite: hex("#e4ece4"), pupil: hex("#000000") };

/**
 * body = ghost-light, belly = fire and candlelight, plate = stone and iron;
 * extras = [ground dark, ground light, moss, moon, moon shade, blood, bark dark, bark, pumpkin dark, pumpkin mid, pumpkin light, robe]
 */
export const HALLOWEEN_PALETTES: readonly Palette[] = [
  {
    name: "wraith",
    body: ramp("#1a3a4a", "#3a7a8a", "#7ac8d0", "#d8fcff"),
    belly: ramp("#6a2a08", "#b05a10", "#f09a20", "#ffe070"),
    plate: ramp("#121418", "#24282e", "#40464e", "#6a727a"),
    extras: ramp("#08090c", "#151a1c", "#2a3a2a", "#d8e4e4", "#9aa8ac", "#e01818", "#040405", "#16161a", "#4a1a06", "#8a3a0c", "#c8661a", "#0c0c12"),
    ...common,
  },
  {
    name: "ectoplasm",
    body: ramp("#14401a", "#2e8a2a", "#7ad84a", "#e0ffb0"),
    belly: ramp("#6a2a08", "#b05a10", "#f09a20", "#ffe070"),
    plate: ramp("#10140f", "#20281e", "#3a4636", "#64705c"),
    extras: ramp("#070a06", "#121a10", "#2a4a1e", "#d8ecb0", "#98ac78", "#e02020", "#040504", "#141812", "#4a1a06", "#8a3a0c", "#c8661a", "#0a0c0a"),
    ...common,
  },
  {
    name: "bloodmoon",
    body: ramp("#4a1414", "#8a3a3a", "#d08a8a", "#ffe0e0"),
    belly: ramp("#6a1a08", "#b0400c", "#f08020", "#ffd060"),
    plate: ramp("#140c0e", "#2a1c1e", "#4a3436", "#76585a"),
    extras: ramp("#0a0606", "#1a1012", "#3a3a1c", "#d83a24", "#7a1810", "#ff2a2a", "#050304", "#1a1014", "#4a1406", "#8a2a0c", "#c8501a", "#0c0608"),
    ...common,
  },
];

export const HALLOWEEN_VIEW = { target: [0, 3.0, 0] as Vec3, span: 12.5, pitch: 0.16 };

const WRAITH: Vec3 = [2.5, 4.1, 0.3];
const MOON: Vec3 = [-1.6, 6.7, -4.5];
const BAT_ORBIT: Vec3 = [-0.6, 6.0, -1.8];
const CAGE_PIVOT: Vec3 = [-2.45, 3.55, -1.1];

/** Animated bits keep their rest data here, keyed by splat, so pose() stays a pure function of t. */
type Motion =
  | { kind: "glow"; w: number; bright: Rgb; dim: Rgb }
  | { kind: "candle"; w: number }
  | { kind: "bat"; local: Vec3; phase: number; r: number; h: number; speed: number; wing: number }
  | { kind: "wraith"; local: Vec3; tatter: number; arm: number }
  | { kind: "spirit"; local: Vec3; base: Vec3; phase: number; k: number }
  | { kind: "skull"; local: Vec3; phase: number }
  | { kind: "hand"; f: number; w: number }
  | { kind: "swing"; local: Vec3 }
  | { kind: "fog"; w: number; speed: number }
  | { kind: "blink"; w: number }
  | { kind: "wisp"; w: number };
const motion = new WeakMap<Splat, Motion>();

const tri = (x: number) => Math.abs((((x % 2) + 2) % 2) - 1);

/** Is (u, v), in units of the pumpkin's radii from its centre, cut out of the face? */
function carved(face: "fangs" | "slash", u: number, v: number): boolean {
  for (const u0 of [-0.34, 0.34]) {
    const du = u - u0;
    const dv = v - 0.24;
    const inner = du * -Math.sign(u0);
    if ((du * du) / 0.045 + (dv * dv) / 0.02 < 1 && dv < 0.04 - inner * 0.6) return true;
  }
  if (Math.abs(u) < 0.05 && v > -0.04 && v < 0.08) return true;
  if (Math.abs(u) > 0.6) return false;
  if (face === "fangs") {
    const top = -0.1 + 0.3 * u * u;
    const bottom = -0.5 + 0.2 * u * u;
    return v < top - tri(u * 7 + 1) * 0.16 && v > bottom + tri(u * 7) * 0.16;
  }
  const top = -0.14 - 0.1 * tri(u * 11) + 0.2 * u;
  const bottom = -0.36 + 0.1 * tri(u * 11 + 1) + 0.2 * u - 0.15 * (1 - u * u);
  return v < top && v > bottom;
}

export function buildHalloween(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 8000);
  const { splats, shell, limb, dot } = createSculptor(rng, 120);
  const [GD, GL, MOSS, MOON_LIT, MOON_SHADE, BLOOD, BARK_D, BARK, PD, PM, PL, ROBE] = palette.extras as [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb, Rgb];
  const [GH0, GH1, GH2, GH3] = palette.body as [Rgb, Rgb, Rgb, Rgb];
  const [, F1, F2, F3] = palette.belly as [Rgb, Rgb, Rgb, Rgb];
  const [ST0, ST1, ST2, ST3] = palette.plate as [Rgb, Rgb, Rgb, Rgb];

  const remap = (from: number, f: (s: Splat) => Splat) => {
    for (let i = from; i < splats.length; i++) splats[i] = f(splats[i]!);
  };
  const tag = (from: number, m: (s: Splat) => Motion | undefined) => {
    for (let i = from; i < splats.length; i++) {
      const mm = m(splats[i]!);
      if (mm) motion.set(splats[i]!, mm);
    }
  };
  /** Move everything built (around the origin) since `from` to `home`, remembering local offsets for pose(). */
  const attach = (from: number, home: Vec3, m: (local: Vec3) => Motion, place?: (m: Motion) => Vec3) => {
    for (let i = from; i < splats.length; i++) {
      const s = splats[i]!;
      const local = s.position;
      const mm = m(local);
      const placed: Splat = { ...s, position: place ? place(mm) : [local[0] + home[0], local[1] + home[1], local[2] + home[2]] };
      splats[i] = placed;
      motion.set(placed, mm);
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
  const dimOf = (c: Rgb): Rgb | undefined => (c === GH3 ? GH2 : c === GH2 ? GH1 : c === F3 ? F2 : c === F2 ? F1 : undefined);
  const glowTag = (from: number) =>
    tag(from, (s) => {
      if (motion.has(s)) return undefined;
      const dim = dimOf(s.color);
      return dim ? { kind: "glow", w: rng.next(), bright: s.color, dim } : undefined;
    });

  const pit = (p: Vec3) => Math.sin(p[0] * 31) * Math.sin(p[1] * 27 + p[2] * 19) > 0.8;
  const stone: ColorFn = (_n, p, b) => (p[1] < 0.14 + 0.08 * Math.sin(p[0] * 13 + p[2] * 7) ? MOSS : palette.plate[clampBand(pit(p) ? b - 1 : b)]!);
  const bark: ColorFn = (_n, p, b) => (Math.sin(p[1] * 22 + Math.sin(p[0] * 9) * 2) > 0.5 ? BARK_D : b > 1 ? BARK : BARK_D);
  const iron: ColorFn = (_n, _p, b) => (b > 2 ? ST1 : ST0);
  const bone: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : ST3);
  const dirt: ColorFn = (_n, _p, b) => (b > 2 ? BARK : b > 0 ? GL : BARK_D);

  /** Sample the surface of an axis-aligned box resting on `base` (bottom face skipped). */
  function box(base: Vec3, hw: number, hh: number, hd: number, color: (n: Vec3, p: Vec3, b: number) => Rgb, density = 260): void {
    const faces: [Vec3, number][] = [[[0, 1, 0], hw * hd * 4], [[1, 0, 0], hd * hh * 2], [[-1, 0, 0], hd * hh * 2], [[0, 0, 1], hw * hh * 2], [[0, 0, -1], hw * hh * 2]];
    const total = faces.reduce((a, f) => a + f[1], 0);
    for (let i = 0; i < total * density; i++) {
      let r = rng.next() * total;
      let fi = 0;
      while (fi < faces.length - 1 && r > faces[fi]![1]) r -= faces[fi++]![1];
      const n = faces[fi]![0];
      const [a, b] = [rng.range(-1, 1), rng.range(0, 1)];
      const p: Vec3 =
        n[1] === 1 ? [base[0] + a * hw, base[1] + hh, base[2] + rng.range(-1, 1) * hd]
        : n[0] !== 0 ? [base[0] + n[0] * hw, base[1] + b * hh, base[2] + a * hd]
        : [base[0] + a * hw, base[1] + b * hh, base[2] + n[2] * hd];
      dot(p, 0.055, color(n, p, shadeBand(n)), { opacity: 0.95 });
    }
  }

  // ---- ground: dead grass and bare earth; ghost-light spills from the crypt door
  for (let i = 0; i < 1300; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.08 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = Math.cos(a) * rr * 5.6;
    const z = Math.sin(a) * rr * 3.8;
    const spill = Math.abs(x - 0.4) < 0.5 + (z + 1.2) * 0.35 && z > -1.2 && z < 1.0;
    const c = spill ? (rng.next() < 0.6 ? GH0 : GL) : rng.next() < 0.25 ? GL : rng.next() < 0.1 ? BARK : GD;
    dot([x, 0.02, z], 0.2, c, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 80; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 0.95;
    const x = Math.cos(a) * rr * 5.4;
    const z = Math.sin(a) * rr * 3.6;
    for (let k = 0; k < 4; k++) {
      const lean = rng.range(-0.2, 0.2);
      const h = rng.range(0.15, 0.35);
      for (let f = 0; f <= 1; f += 0.15) dot([x + k * 0.04 + (lean - k * 0.04) * f, h * f, z + lean * 0.4 * f], 0.026, f > 0.5 ? MOSS : GL);
    }
  }

  // ---- the crypt: columns, pediment roof, a skull over the door, the door hanging open on ghost-light
  {
    const c: Vec3 = [0.4, 0, -2.0];
    const [hw, hh, hd] = [1.25, 1.9, 0.8];
    const door = (p: Vec3) => Math.abs(p[0] - c[0]) < 0.42 && p[1] < 1.4 && p[1] > 0.25;
    const from = splats.length;
    box(c, hw, hh, hd, (n, p, b) => {
      if (n[2] === 1 && door(p)) return p[1] < 0.6 ? GH2 : p[1] < 1.0 ? GH1 : GH0; // light pouring out of the dark
      if (n[2] === 1 && Math.abs(p[1] - 1.62) < 0.035 && Math.abs(p[0] - c[0]) > 0.3 && Math.abs(p[0] - c[0]) < 0.9 && Math.floor(p[0] * 9) % 3 !== 0) return ST0; // weathered inscription
      if (Math.abs(p[0] - c[0] - 0.75 + (p[1] - 1) * 0.35) < 0.025 && p[1] > 0.5) return ST0; // crack
      return stone(n, p, b);
    });
    glowTag(from);
    dot([c[0], 0.75, c[2] + hd + 0.02], 0.35, GH1, { opacity: 0.5, tall: 1.6 });
    // the iron door, swung half open toward the viewer
    const doorFrom = splats.length;
    for (let y = 0.28; y < 1.38; y += 0.12) limb([[c[0] - 0.4, y, c[2] + hd + 0.02], [c[0] + 0.35, y, c[2] + hd + 0.02]], 0.025, 0.025, iron);
    for (let x = -0.4; x <= 0.36; x += 0.15) limb([[c[0] + x, 0.25, c[2] + hd + 0.02], [c[0] + x, 1.4, c[2] + hd + 0.02]], 0.03, 0.03, iron);
    remap(doorFrom, (s) => {
      const dx = s.position[0] - (c[0] - 0.42);
      const a = 1.1;
      return { ...s, position: [c[0] - 0.42 + dx * Math.cos(a), s.position[1], c[2] + hd + 0.02 + dx * Math.sin(a)] };
    });
    // pediment roof: two sloping planes and a triangular gable on the front
    for (let i = 0; i < 2200; i++) {
      const u = rng.range(-hw - 0.18, hw + 0.18);
      const z = rng.range(-hd - 0.18, hd + 0.18);
      const y = hh + 0.06 + (1 - Math.abs(u) / (hw + 0.18)) * 0.75;
      const n = normalize([Math.sign(u) * 0.7, 1, 0]);
      const p: Vec3 = [c[0] + u, y, c[2] + z];
      dot(p, 0.06, stone(n, p, shadeBand(n)), { opacity: 0.95 });
    }
    for (let i = 0; i < 700; i++) {
      const u = rng.range(-1, 1);
      const v = rng.next() * (1 - Math.abs(u));
      const p: Vec3 = [c[0] + u * (hw + 0.18), hh + 0.06 + v * 0.75, c[2] + hd + 0.19];
      dot(p, 0.055, v > 0.2 && v < 0.5 && Math.abs(u) < 0.1 ? ST0 : pit(p) ? ST1 : ST2, { opacity: 0.95 });
    }
    shell([c[0], hh + 0.08, c[2] + hd + 0.12], [hw + 0.25, 0.07, 0.1], stone); // cornice
    // carved skull over the door
    shell([c[0], 1.62, c[2] + hd + 0.06], [0.2, 0.17, 0.07], bone);
    for (const s of [-1, 1]) dot([c[0] + s * 0.08, 1.64, c[2] + hd + 0.13], 0.05, palette.pupil);
    dot([c[0], 1.53, c[2] + hd + 0.13], 0.025, palette.pupil);
    // columns flanking the door and steps leading up
    for (const s of [-1, 1]) {
      const x = c[0] + s * 0.85;
      limb([[x, 0.15, c[2] + hd + 0.25], [x, hh, c[2] + hd + 0.25]], 0.15, 0.13, stone);
      shell([x, hh - 0.02, c[2] + hd + 0.25], [0.22, 0.08, 0.22], stone);
      shell([x, 0.18, c[2] + hd + 0.25], [0.22, 0.08, 0.22], stone);
    }
    box([c[0], 0, c[2] + hd + 0.45], 0.9, 0.12, 0.3, (n, p, b) => stone(n, p, b), 200);
    box([c[0], 0, c[2] + hd + 0.85], 0.75, 0.06, 0.18, (n, p, b) => stone(n, p, b), 200);
    // cobweb in the corner of the portico
    const cw: Vec3 = [c[0] + 0.85, hh - 0.1, c[2] + hd + 0.27];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + (k / 5) * (Math.PI / 2);
      for (let d = 0.06; d < 0.55; d += 0.05) dot([cw[0] + Math.cos(a) * d, cw[1] + Math.sin(a) * d, cw[2]], 0.014, ST3, { opacity: 0.8 });
    }
    for (let d = 0.12; d < 0.55; d += 0.1) for (let a = Math.PI; a < Math.PI * 1.5; a += 0.12) dot([cw[0] + Math.cos(a) * d, cw[1] + Math.sin(a) * d * 0.95, cw[2]], 0.012, ST3, { opacity: 0.7 });
  }

  // ---- headstones: tilted, cracked, one snapped in two; a weathered ringed cross
  function headstone(base: Vec3, w: number, h: number, d: number, tiltX: number, tiltZ: number, broken = false): void {
    const from = splats.length;
    const rIn = w / 2;
    const cut = (u: number, v: number) => broken && v > h * 0.55 + u * 0.4 + 0.06 * Math.sin(u * 30);
    const engrave = (u: number, v: number) =>
      (Math.abs(u) < 0.03 && v > h * 0.45 && v < h * 0.85) || (Math.abs(v - h * 0.74) < 0.03 && Math.abs(u) < w * 0.18) || (Math.abs(v - h * 0.3) < 0.02 && Math.abs(u) < w * 0.28) || (Math.abs(v - h * 0.22) < 0.02 && Math.abs(u) < w * 0.2);
    const face = (u: number, v: number, front: boolean): Rgb => {
      if (v < 0.14 + 0.08 * Math.sin(u * 17)) return rng.next() < 0.5 ? MOSS : GL;
      if (front && engrave(u, v)) return ST0;
      if (Math.abs(u - (v - h * 0.5) * 0.5 - w * 0.2) < 0.018 && v > h * 0.4) return ST0;
      return palette.plate[clampBand(Math.sin(u * 31) * Math.sin(v * 29) > 0.75 ? (front ? 3 : 2) : front ? 2 : 1)]!;
    };
    for (let i = 0; i < w * h * 2 * 260; i++) {
      const u = rng.range(-rIn, rIn);
      const v = rng.range(0, h);
      if (v > h - rIn && u * u + (v - (h - rIn)) ** 2 > rIn * rIn) continue;
      if (cut(u, v)) continue;
      const front = rng.next() < 0.55;
      dot([base[0] + u, base[1] + v, base[2] + (front ? d / 2 : -d / 2)], 0.05, face(u, v, front), { opacity: 0.95 });
    }
    for (let i = 0; i < (2 * h + Math.PI * rIn) * 50; i++) {
      const s = rng.range(0, 2 * (h - rIn) + Math.PI * rIn);
      let [u, v] = [0, 0];
      if (s < h - rIn) [u, v] = [-rIn, s];
      else if (s < 2 * (h - rIn)) [u, v] = [rIn, s - (h - rIn)];
      else {
        const a = (s - 2 * (h - rIn)) / rIn;
        [u, v] = [Math.cos(a) * rIn, h - rIn + Math.sin(a) * rIn];
      }
      if (cut(u, v)) continue;
      dot([base[0] + u, base[1] + v, base[2] + rng.range(-d / 2, d / 2)], 0.05, v < 0.12 ? MOSS : palette.plate[u > 0 ? 2 : 0]!, { opacity: 0.95 });
    }
    lean(from, base, tiltX, tiltZ);
    if (broken) {
      // the snapped-off top lying in the grass
      const top = splats.length;
      box([base[0] + 0.55, 0, base[2] + 0.5], w * 0.42, 0.08, h * 0.22, (n, p, b) => stone(n, p, b), 200);
      lean(top, [base[0] + 0.55, 0, base[2] + 0.5], 0, 0.1);
    }
  }
  headstone([-2.2, 0, -0.9], 1.0, 1.45, 0.2, -0.08, 0.14);
  headstone([1.4, 0, 0.35], 0.8, 1.1, 0.18, 0.1, -0.22);
  headstone([3.5, 0, -1.4], 0.75, 1.0, 0.16, -0.06, 0.25);
  headstone([-1.4, 0, 1.0], 0.85, 1.2, 0.18, 0.05, -0.1, true);
  {
    const from = splats.length;
    limb([[-3.1, 0, 1.0], [-3.1, 1.6, 1.0]], 0.12, 0.1, stone);
    limb([[-3.5, 1.15, 1.0], [-2.7, 1.15, 1.0]], 0.1, 0.1, stone);
    const ring: Vec3[] = [];
    for (let i = 0; i <= 24; i++) ring.push([-3.1 + Math.cos((i / 24) * Math.PI * 2) * 0.26, 1.15 + Math.sin((i / 24) * Math.PI * 2) * 0.26, 1.0]);
    limb(ring, 0.05, 0.05, stone);
    lean(from, [-3.1, 0, 1.0], -0.1, -0.3);
  }

  // ---- an open grave with its spoil heap and a shovel left standing in it
  for (let i = 0; i < 260; i++) dot([1.35 + rng.range(-0.38, 0.38), 0.03, 1.4 + rng.range(-0.7, 0.7)], 0.07, palette.pupil);
  for (let i = 0; i < 60; i++) dot([1.35 + (i % 2 === 0 ? -0.4 : 0.4), 0.05, 0.7 + (i / 60) * 1.4], 0.07, BARK_D);
  shell([2.25, 0.05, 1.3], [0.45, 0.35, 0.8], dirt);
  shell([2.5, 0.05, 1.8], [0.3, 0.22, 0.35], dirt);
  const handle: ColorFn = (_n, _p, b) => (b > 1 ? BARK : BARK_D);
  limb([[2.3, 0.3, 1.2], [2.55, 1.55, 1.05]], 0.04, 0.035, handle);
  shell([2.28, 0.25, 1.21], [0.13, 0.2, 0.03], iron);
  limb([[2.48, 1.55, 1.08], [2.62, 1.55, 1.02]], 0.035, 0.035, handle);

  // ---- bony hands clawing up out of a fresh grave
  shell([-1.4, 0.0, 1.8], [0.55, 0.16, 0.55], dirt);
  for (const [hx, hz, ang] of [[-1.65, 1.75, 0.2], [-1.15, 1.95, -0.25]] as const) {
    const wrist: Vec3 = [hx + ang * 0.3, 0.75, hz + 0.05];
    limb([[hx, 0.05, hz], [hx + ang * 0.15, 0.4, hz], wrist], 0.06, 0.045, bone);
    shell(wrist, [0.09, 0.06, 0.05], bone);
    for (let k = 0; k < 5; k++) {
      const spread = (k - 2) * 0.07;
      const from = splats.length;
      const len = k === 0 ? 0.18 : 0.3 - Math.abs(k - 2.5) * 0.03;
      const knuckle: Vec3 = [wrist[0] + spread * 1.2 + (k === 0 ? -0.08 : 0), wrist[1] + 0.06 + len * 0.5, wrist[2] + 0.02];
      const tip: Vec3 = [knuckle[0] + spread * 0.6, knuckle[1] + len * 0.45, knuckle[2] + 0.12];
      limb([[wrist[0] + spread * 0.6, wrist[1] + 0.05, wrist[2]], knuckle, tip], 0.022, 0.01, bone);
      const w = rng.next();
      tag(from, (s) => ({ kind: "hand", f: Math.max(0, (s.position[1] - wrist[1]) / (len + 0.1)), w }));
    }
  }
  shell([-0.5, 0.15, 2.3], [0.2, 0.18, 0.18], bone); // a skull half-sunk in the dirt
  for (const s of [-1, 1]) dot([-0.5 + s * 0.07, 0.18, 2.45], 0.05, palette.pupil);

  // ---- jack-o'-lanterns: two snarling, one caved in and rotting
  function pumpkin(c: Vec3, r: Vec3, face: "fangs" | "slash" | null, rot = false): void {
    const avg = (r[0] + r[1] + r[2]) / 3;
    const count = Math.round(4 * Math.PI * avg * avg * 130);
    const sz = Math.min(0.11, r[1] * 0.16);
    const from = splats.length;
    const skin = [ROBE, PD, PM, PL] as const;
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const ang = Math.atan2(u[2], u[0]);
      const groove = Math.pow(1 - Math.abs(Math.cos(ang * 4)), 4);
      const sag = rot ? 1 - 0.35 * Math.max(0, u[1]) * (0.6 + 0.4 * Math.sin(ang * 3)) : 1;
      const k = (1 - 0.1 * groove) * rng.range(0.95, 1);
      const p: Vec3 = [c[0] + u[0] * r[0] * k, c[1] + u[1] * r[1] * k * sag, c[2] + u[2] * r[2] * k];
      const n = normalize([u[0] / r[0], u[1] / r[1], u[2] / r[2]]);
      let b = shadeBand(n);
      if (groove > 0.35) b = clampBand(b - 1);
      let color: Rgb = skin[b]!;
      if (rot && Math.sin(p[0] * 9) * Math.sin(p[2] * 8 + p[1] * 5) > 0.3) color = b > 1 ? MOSS : BARK_D; // mould
      if (face && n[2] > 0.3) {
        const fu = (p[0] - c[0]) / r[0];
        const fv = (p[1] - c[1]) / r[1];
        if (carved(face, fu, fv)) {
          const edge = [[0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04]].some(([du, dv]) => !carved(face, fu + du!, fv + dv!));
          color = edge ? F1 : n[2] > 0.75 ? F3 : F2;
        }
      }
      const s = sz * rng.range(0.85, 1.2);
      splats.push({ position: p, scale: [s, s, s], color, opacity: rng.range(0.85, 0.95) });
    }
    if (face) glowTag(from);
    const top: Vec3 = [c[0], c[1] + r[1] * (rot ? 0.4 : 0.7), c[2]];
    limb([top, [top[0] + 0.06, top[1] + r[1] * 0.3, top[2]], [top[0] + r[0] * 0.2, top[1] + r[1] * 0.38, top[2] + 0.05]], r[0] * 0.11, r[0] * 0.06, (_n, _p, b) => (b > 1 ? MOSS : BARK_D));
  }
  pumpkin([0.1, 0.6, 2.4], [0.8, 0.6, 0.75], "fangs");
  pumpkin([3.6, 0.48, 1.2], [0.62, 0.48, 0.6], "slash");
  pumpkin([-2.6, 0.3, 2.3], [0.48, 0.32, 0.46], null, true);

  // ---- candles guttering on the graves
  function candle(x: number, z: number, h: number): void {
    const wax: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : ST3);
    limb([[x, 0, z], [x, h, z]], 0.065, 0.06, wax);
    for (const d of [-1, 1]) limb([[x + d * 0.06, h, z + 0.02], [x + d * 0.065, h - rng.range(0.1, 0.25), z + 0.03]], 0.022, 0.014, wax);
    const from = splats.length;
    dot([x, h + 0.13, z], 0.045, F3, { tall: 2.2 });
    dot([x, h + 0.11, z], 0.075, F2, { tall: 1.6, opacity: 0.75 });
    const w = rng.next();
    tag(from, () => ({ kind: "candle", w }));
  }
  candle(-2.0, -0.4, 0.4);
  candle(-2.35, -0.3, 0.26);
  candle(1.65, 0.75, 0.32);
  candle(3.3, -0.9, 0.38);
  candle(-0.45, -0.75, 0.3);
  candle(1.25, -0.85, 0.45);

  // ---- rusted spiked fence, one bar bent and a gap where a panel fell
  for (let x = -4.0; x <= 4.6; x += 0.6) {
    if (x > -0.9 && x < -0.2) continue;
    const bend = Math.abs(x - 2.6) < 0.3 ? 0.3 : 0;
    const z = -3.2;
    limb([[x, 0, z], [x + bend * 0.4, 0.9, z], [x + bend, 1.6, z]], 0.04, 0.04, iron);
    limb([[x + bend, 1.6, z], [x + bend * 1.1, 1.88, z]], 0.075, 0.012, iron);
  }
  for (const y of [0.4, 1.35]) {
    limb([[-4.0, y, -3.2], [-1.0, y, -3.2]], 0.035, 0.035, iron);
    limb([[-0.1, y, -3.2], [4.6, y, -3.2]], 0.035, 0.035, iron);
  }

  // ---- the gallows tree: gnarled trunk, clawing branches, an iron cage with its last prisoner
  limb([[-3.9, 0, -1.3], [-3.7, 1.0, -1.3], [-4.05, 1.9, -1.25], [-3.8, 2.9, -1.3]], 0.45, 0.24, bark);
  for (const [dx, dz] of [[0.8, 0.3], [-0.7, 0.4], [0.3, -0.7], [-0.5, -0.5]] as const) limb([[-3.9, 0.35, -1.3], [-3.9 + dx * 0.6, 0.1, -1.3 + dz * 0.6], [-3.9 + dx, 0.02, -1.3 + dz]], 0.2, 0.04, bark);
  shell([-3.72, 1.3, -0.98], [0.14, 0.2, 0.06], () => palette.pupil); // hollow
  {
    const from = splats.length;
    for (const s of [-1, 1]) dot([-3.72 + s * 0.05, 1.36, -0.92], 0.025, BLOOD); // something watching from inside
    tag(from, () => ({ kind: "blink", w: 1.7 }));
  }
  function branch(from: Vec3, dir: Vec3, len: number, r: number, depth: number): void {
    const j = () => rng.range(-0.3, 0.3);
    const mid: Vec3 = [from[0] + dir[0] * len * 0.5 + j() * len * 0.5, from[1] + dir[1] * len * 0.5 + j() * len * 0.3, from[2] + dir[2] * len * 0.5];
    const to: Vec3 = [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len];
    limb([from, mid, to], r, r * 0.5, bark);
    if (depth === 0) {
      limb([to, [to[0] + dir[0] * len * 0.3, to[1] + dir[1] * len * 0.3 - len * 0.15, to[2]]], r * 0.5, 0.01, bark); // hooked, claw-like tip
      return;
    }
    const n = depth > 1 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const nd = normalize([dir[0] + (k - (n - 1) / 2) * 0.9 + j(), dir[1] + j() * 0.6, dir[2] + j()]);
      branch(to, nd, len * 0.66, r * 0.55, depth - 1);
    }
  }
  branch([-3.8, 2.9, -1.3], normalize([-0.3, 1, 0.1]), 1.3, 0.22, 3);
  branch([-3.95, 2.2, -1.3], normalize([-1, 0.45, -0.2]), 1.1, 0.17, 2);
  limb([[-3.82, 2.65, -1.3], [-3.0, 3.35, -1.2], [-2.2, 3.65, -1.1], [-1.5, 3.95, -1.05]], 0.18, 0.04, bark);
  limb([[-1.9, 3.78, -1.08], [-1.6, 4.3, -1.05]], 0.05, 0.012, bark);
  {
    const from = splats.length;
    for (let y = 0; y > -0.6; y -= 0.06) dot([0, y, 0], 0.03, ST1); // chain
    const top = -0.6;
    const [cr, ch] = [0.32, 1.0];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      limb([[ca * cr * 0.4, top, sa * cr * 0.4], [ca * cr, top - 0.25, sa * cr], [ca * cr, top - ch, sa * cr], [ca * cr * 0.5, top - ch - 0.12, sa * cr * 0.5]], 0.02, 0.02, iron);
    }
    for (const y of [top - 0.25, top - 0.65, top - ch]) {
      const ring: Vec3[] = [];
      for (let i = 0; i <= 20; i++) ring.push([Math.cos((i / 20) * Math.PI * 2) * cr, y, Math.sin((i / 20) * Math.PI * 2) * cr]);
      limb(ring, 0.02, 0.02, iron);
    }
    // the skeleton slumped inside, one arm dangling through the bars
    shell([0.05, top - 0.35, 0.05], [0.12, 0.13, 0.12], bone);
    for (const s of [-1, 1]) dot([0.05 + s * 0.045, top - 0.34, 0.16], 0.035, palette.pupil);
    shell([0.05, top - 0.48, 0.1], [0.06, 0.04, 0.05], bone);
    for (let i = 0; i < 5; i++) limb([[-0.12, top - 0.58 - i * 0.07, 0.0], [0.0, top - 0.6 - i * 0.07, 0.1], [0.12, top - 0.58 - i * 0.07, 0.0]], 0.018, 0.018, bone);
    limb([[0.0, top - 0.55, -0.05], [0.0, top - 0.95, -0.02]], 0.022, 0.022, bone);
    limb([[0.12, top - 0.6, 0.05], [0.3, top - 0.85, 0.12], [0.45, top - 1.15, 0.15], [0.48, top - 1.35, 0.16]], 0.022, 0.015, bone);
    limb([[-0.1, top - 0.9, 0.0], [0.05, top - 0.95, 0.15], [-0.05, top - 0.95, 0.1]], 0.025, 0.02, bone);
    attach(from, CAGE_PIVOT, (local) => ({ kind: "swing", local }));
  }
  // ravens with red eyes along the branches
  for (const [rx, ry, rz, face] of [[-2.9, 3.52, -1.2, 1], [-1.75, 3.9, -1.06, -1], [-4.5, 4.2, -1.3, 1]] as const) {
    const feathers: ColorFn = (_n, _p, b) => (b > 2 ? ST1 : palette.outline);
    shell([rx, ry + 0.2, rz], [0.22, 0.16, 0.13], feathers);
    shell([rx + face * 0.2, ry + 0.36, rz], [0.1, 0.1, 0.09], feathers);
    limb([[rx + face * 0.28, ry + 0.36, rz], [rx + face * 0.45, ry + 0.32, rz]], 0.04, 0.01, () => ST1);
    limb([[rx - face * 0.15, ry + 0.2, rz], [rx - face * 0.45, ry + 0.08, rz]], 0.08, 0.03, feathers);
    const from = splats.length;
    for (const s of [-1, 1]) dot([rx + face * 0.25, ry + 0.39, rz + s * 0.08], 0.025, BLOOD);
    tag(from, () => ({ kind: "blink", w: -rx }));
  }

  // ---- a sickly moon behind torn clouds
  shell(MOON, [1.8, 1.8, 0.35], (_n, p, b) => {
    const [mx, my] = [p[0] - MOON[0], p[1] - MOON[1]];
    const crater = Math.sin(mx * 4 + 1) * Math.sin(my * 5) > 0.6 || Math.hypot(mx + 0.6, my - 0.5) < 0.3 || Math.hypot(mx - 0.7, my + 0.4) < 0.4;
    return crater || b < 1 ? MOON_SHADE : MOON_LIT;
  }, undefined, 0.13);
  for (let i = 0; i < 36; i++) {
    const band = i % 2;
    const x = MOON[0] + rng.range(-2.6, 1.6) + band * 1.0;
    const y = MOON[1] + [-0.7, 0.9][band]! + rng.range(-0.05, 0.05) + (x - MOON[0]) * 0.08;
    dot([x, y, MOON[2] + 0.5], rng.range(0.1, 0.16), ST1, { tall: 0.3, opacity: 0.9 });
  }

  // ---- the wraith: hooded, faceless, a torn robe streaming beneath it, reaching with bone hands
  {
    const from = splats.length;
    const robe: ColorFn = (_n, p, b) => (Math.sin(p[0] * 17 + p[1] * 5) * Math.sin(p[2] * 13) > 0.7 ? palette.outline : b > 2 ? GH0 : b > 1 ? ST1 : b > 0 ? ROBE : palette.outline);
    shell([0, 0, -0.04], [0.4, 0.48, 0.42], robe); // hood
    limb([[0, 0.3, -0.25], [0, 0.55, -0.45], [0, 0.45, -0.6]], 0.2, 0.04, robe); // hood point
    shell([0, -0.08, 0.27], [0.25, 0.32, 0.08], () => palette.pupil); // the void where a face should be
    for (const s of [-1, 1]) {
      dot([s * 0.1, -0.02, 0.34], 0.05, GH3, { tall: 0.7 });
      dot([s * 0.1, -0.02, 0.33], 0.11, GH2, { opacity: 0.55, tall: 0.8 });
    }
    // robe: a widening cone that ends in hanging tatters
    for (let i = 0; i < 2400; i++) {
      const y = rng.range(-2.6, -0.3);
      const r = 0.45 + ((-0.3 - y) / 2.3) * 0.4;
      const a = rng.range(0, Math.PI * 2);
      const n = normalize([Math.cos(a), 0.2, Math.sin(a)]);
      const p: Vec3 = [Math.cos(a) * r, y, Math.sin(a) * r];
      dot(p, 0.08, robe(n, p, shadeBand(n)), { opacity: 0.95 });
    }
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const len = rng.range(0.35, 1.1);
      limb([[Math.cos(a) * 0.82, -2.55, Math.sin(a) * 0.82], [Math.cos(a) * 0.8, -2.55 - len * 0.5, Math.sin(a) * 0.8], [Math.cos(a) * 0.72, -2.55 - len, Math.sin(a) * 0.72]], 0.09, 0.015, robe);
    }
    // ghost-light trailing from under the robe
    for (let i = 0; i < 120; i++) {
      const f = rng.next();
      dot([rng.range(-0.4, 0.4) * (1 - f), -2.6 - f, rng.range(-0.4, 0.4) * (1 - f)], 0.08, f < 0.5 ? GH1 : GH0, { opacity: 0.6 });
    }
    // sleeves and long skeletal fingers reaching toward the viewer
    for (const s of [-1, 1]) {
      limb([[s * 0.42, -0.45, 0], [s * 0.6, -0.75, 0.45], [s * 0.5, -0.65, 0.95]], 0.2, 0.15, robe);
      const wrist: Vec3 = [s * 0.48, -0.62, 1.1];
      limb([[s * 0.5, -0.65, 0.95], wrist], 0.05, 0.045, bone);
      for (let k = 0; k < 4; k++) {
        const spread = (k - 1.5) * 0.06;
        limb([wrist, [wrist[0] + spread, wrist[1] - 0.04, wrist[2] + 0.22], [wrist[0] + spread * 1.4, wrist[1] - 0.2, wrist[2] + 0.38], [wrist[0] + spread * 1.5, wrist[1] - 0.32, wrist[2] + 0.34]], 0.022, 0.006, bone);
      }
    }
    attach(from, WRAITH, (local) => ({
      kind: "wraith",
      local,
      tatter: Math.max(0, (-2.2 - local[1]) / 1.4),
      arm: Math.abs(local[0]) > 0.3 && local[1] > -1.3 ? Math.max(0, (local[2] - 0.3) / 1.0) : 0,
    }));
  }

  // ---- skulls circling the wraith, eye sockets burning
  for (let k = 0; k < 3; k++) {
    const from = splats.length;
    shell([0, 0, 0], [0.17, 0.16, 0.16], bone);
    shell([0.0, -0.1, 0.06], [0.11, 0.06, 0.09], bone);
    for (const s of [-1, 1]) {
      dot([s * 0.06, 0.01, 0.14], 0.045, palette.pupil);
      dot([s * 0.06, 0.01, 0.17], 0.022, GH3);
    }
    for (let i = -2; i <= 2; i++) dot([i * 0.025, -0.12, 0.15], 0.014, palette.pupil, { tall: 1.5 });
    for (let i = 0; i < 25; i++) dot([rng.range(-0.08, 0.08), rng.range(-0.1, 0.05), -0.12 - i * 0.03], 0.06 - i * 0.002, i < 12 ? GH1 : GH0, { opacity: 0.6 }); // streaming trail
    const phase = (k / 3) * Math.PI * 2;
    attach(from, WRAITH, (local) => ({ kind: "skull", local, phase }), (m) => placeSkull(m as Extract<Motion, { kind: "skull" }>, 0));
  }

  // ---- wailing spirits tearing up out of the graves
  const spiritBases: Vec3[] = [[1.35, 0, 1.4], [-2.2, 0, -0.3], [-1.4, 0, 1.8]];
  spiritBases.forEach((base, k) => {
    const from = splats.length;
    const sheet = (n: Vec3, tail: number): Rgb => {
      const b = shadeBand(n);
      return tail > 0.6 ? (b > 1 ? GH1 : GH0) : b > 2 ? GH3 : b > 0 ? GH2 : GH1;
    };
    for (let i = 0; i < 380; i++) {
      const u = rng.onSphere();
      dot([u[0] * 0.24, u[1] * 0.34, u[2] * 0.22], 0.06, sheet(u, 0), { opacity: 0.9 });
    }
    for (let i = 0; i < 700; i++) {
      const t = Math.pow(rng.next(), 0.8);
      const a = rng.range(0, Math.PI * 2);
      const r = 0.3 * Math.pow(1 - t, 0.8) + 0.02;
      const n = normalize([Math.cos(a), 0, Math.sin(a)]);
      const curl = Math.sin(t * 4.5) * 0.35 * t;
      dot([Math.cos(a) * r + curl, -0.25 - t * 1.3, Math.sin(a) * r - t * 0.25], 0.07 * (1 - t * 0.4), sheet(n, t), { opacity: 0.85 });
    }
    // stretched, screaming face
    for (const s of [-1, 1]) dot([s * 0.09, 0.08, 0.2], 0.05, palette.pupil, { tall: 2.2 });
    dot([0, -0.14, 0.21], 0.07, palette.pupil, { tall: 2.6 });
    // arms flung up as it wails
    for (const s of [-1, 1]) limb([[s * 0.2, -0.3, 0], [s * 0.45, -0.05, 0.08], [s * 0.55, 0.35, 0.05]], 0.07, 0.02, (n) => sheet(n, 0.3));
    const phase = k * 0.33 + rng.range(0, 0.05);
    attach(from, base, (local) => ({ kind: "spirit", local, base, phase, k: Math.max(0, (-0.25 - local[1]) / 1.5) }), (m) => placeSpirit(m as Extract<Motion, { kind: "spirit" }>, 0));
  });

  // ---- bats
  for (let k = 0; k < 6; k++) {
    const from = splats.length;
    const size = rng.range(0.7, 1.2);
    const fur: ColorFn = (_n, _p, b) => (b > 2 ? ST1 : ST0);
    shell([0, 0, 0], [0.13, 0.1, 0.1], fur);
    shell([0.15, 0.03, 0], [0.08, 0.08, 0.08], fur);
    for (const s of [-1, 1]) {
      limb([[0.15, 0.08, s * 0.04], [0.15, 0.18, s * 0.06]], 0.035, 0.008, fur);
      dot([0.22, 0.05, s * 0.04], 0.022, BLOOD);
      const sh: Vec3 = [0, 0.02, s * 0.08];
      const wrist: Vec3 = [0.12, 0.1, s * 0.45];
      const tip: Vec3 = [-0.05, 0.03, s * 0.88];
      const f1: Vec3 = [-0.22, -0.02, s * 0.68];
      const f2: Vec3 = [-0.2, 0, s * 0.38];
      const root: Vec3 = [-0.13, 0, s * 0.1];
      limb([sh, wrist, tip], 0.025, 0.012, () => palette.outline);
      for (const [a, b, c] of [[sh, wrist, tip], [wrist, tip, f1], [wrist, f1, f2], [sh, wrist, f2], [sh, f2, root]] as [Vec3, Vec3, Vec3][]) {
        for (let i = 0; i < 26; i++) {
          let u = rng.next();
          let v = rng.next();
          if (u + v > 1) [u, v] = [1 - u, 1 - v];
          dot([a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v], 0.045, rng.next() < 0.3 ? ST1 : ST0);
        }
      }
    }
    const meta = { phase: (k / 6) * Math.PI * 2 + rng.range(-0.3, 0.3), r: rng.range(1.6, 3.2), h: rng.range(-0.8, 1.0), speed: rng.range(0.5, 0.8) * (k % 3 === 0 ? -1 : 1) };
    for (let i = from; i < splats.length; i++) {
      const s = splats[i]!;
      const local: Vec3 = [s.position[0] * size, s.position[1] * size, s.position[2] * size];
      const m: Motion = { kind: "bat", local, wing: Math.abs(local[2]) > 0.1 * size ? Math.abs(local[2]) / size : 0, ...meta };
      const placed: Splat = { ...s, scale: [s.scale[0] * size, s.scale[1] * size, s.scale[2] * size], position: placeBat(m, 0) };
      splats[i] = placed;
      motion.set(placed, m);
    }
  }

  // ---- heavy, ghost-lit fog rolling low through the graves, and will-o'-wisps
  for (let i = 0; i < 40; i++) {
    const cx = rng.range(-5, 5);
    const cz = rng.range(-2.8, 1.6);
    const speed = rng.range(0.5, 1.2);
    const w = rng.next();
    const from = splats.length;
    for (let k = 0; k < 4; k++) dot([cx + rng.range(-0.45, 0.45), rng.range(0.05, 0.2), cz + rng.range(-0.3, 0.3)], rng.range(0.18, 0.3), k % 2 === 0 ? GH0 : ST2, { opacity: 0.45, tall: 0.35 });
    tag(from, () => ({ kind: "fog", w, speed }));
  }
  for (const [x, y, z] of [[-0.8, 1.6, -0.3], [2.9, 1.2, -0.2], [-3.0, 1.8, 0.4], [0.9, 2.4, -1.0]] as const) {
    const from = splats.length;
    dot([x, y, z], 0.06, GH3);
    dot([x, y, z], 0.14, GH1, { opacity: 0.5 });
    const w = rng.next();
    tag(from, () => ({ kind: "wisp", w }));
  }
  return splats;
}

function placeBat(m: Extract<Motion, { kind: "bat" }>, t: number): Vec3 {
  const a = m.phase + t * m.speed;
  const cx = BAT_ORBIT[0] + Math.cos(a) * m.r;
  const cz = BAT_ORBIT[2] + Math.sin(a) * m.r * 0.55;
  const cy = BAT_ORBIT[1] + m.h + Math.sin(t * 2.3 + m.phase * 3) * 0.25;
  const dir = Math.sign(m.speed);
  const hx0 = -Math.sin(a) * dir;
  const hz0 = Math.cos(a) * 0.55 * dir;
  const hl = Math.hypot(hx0, hz0) || 1;
  const [hx, hz] = [hx0 / hl, hz0 / hl];
  const [lx, ly, lz] = m.local;
  const flap = m.wing > 0 ? Math.sin(t * 15 + m.phase * 5) * 0.55 * m.wing : 0;
  return [cx + lx * hx - lz * hz, cy + ly + flap, cz + lx * hz + lz * hx];
}

const wraithBob = (t: number) => Math.sin(t * 1.1) * 0.2;
const wraithSway = (t: number) => Math.sin(t * 0.6) * 0.25;

/** Skulls orbit the wraith, each turned to face the way it flies. */
function placeSkull(m: Extract<Motion, { kind: "skull" }>, t: number): Vec3 {
  const a = t * 0.9 + m.phase;
  const [lx, ly, lz] = m.local;
  const cx = WRAITH[0] + wraithSway(t) + Math.cos(a) * 1.4;
  const cz = WRAITH[2] + Math.sin(a) * 1.1;
  const cy = WRAITH[1] + wraithBob(t) - 1.4 + Math.sin(a * 2) * 0.3;
  const hx = -Math.sin(a);
  const hz = Math.cos(a);
  return [cx + lx * hz + lz * hx, cy + ly, cz - lx * hx + lz * hz];
}

/** A spirit loops: it tears up out of its grave, wails as it climbs, and dissolves into the dark. */
function placeSpirit(m: Extract<Motion, { kind: "spirit" }>, t: number): Vec3 {
  const a = (t * 0.16 + m.phase) % 1;
  const [lx, ly, lz] = m.local;
  const wave = Math.sin(t * 3 - m.k * 6 + m.phase * 9) * 0.3 * m.k;
  const drift = Math.sin(a * 6 + m.phase * 9) * 0.35;
  const stretch = 1 + a * 0.6 * m.k; // the tail stays reaching back toward the grave as the head climbs
  return [m.base[0] + drift * (1 - m.k * 0.6) + lx + wave, m.base[1] + 0.5 + a * 3.2 + ly * stretch, m.base[2] + lz + wave * 0.4];
}

/** Light flickers, the wraith looms and reaches, spirits rise, skulls circle, the cage creaks, fog creeps. */
export function poseHalloween(splats: readonly Splat[], t: number): Splat[] {
  const bob = wraithBob(t);
  const sway = wraithSway(t);
  const reach = (Math.sin(t * 0.9) + 1) / 2;
  const swing = Math.sin(t * 0.9) * 0.14;
  return splats.map((s) => {
    const m = motion.get(s);
    if (!m) return s;
    const [x, y, z] = s.position;
    switch (m.kind) {
      case "glow": {
        const f = Math.sin(t * 13 + m.w * 17) + Math.sin(t * 7.3 + m.w * 5) + Math.sin(t * 3.1);
        return f > 1.3 ? { ...s, color: m.dim } : s;
      }
      case "candle": {
        const flick = Math.sin(t * 9 + m.w * 7) * 0.025 + Math.sin(t * 23 + m.w * 3) * 0.01;
        const k = 1 + Math.sin(t * 17 + m.w * 11) * 0.15;
        return { ...s, position: [x + flick, y + (k - 1) * 0.05, z], scale: [s.scale[0], s.scale[1] * k, s.scale[2]] };
      }
      case "bat":
        return { ...s, position: placeBat(m, t) };
      case "wraith": {
        const [lx, ly, lz] = m.local;
        const tatter = Math.sin(t * 3 + ly * 4 + lx * 3 + lz * 2) * 0.16 * m.tatter;
        const lean = ly * -0.08 * Math.sin(t * 0.6);
        return { ...s, position: [WRAITH[0] + lx + sway + tatter + lean, WRAITH[1] + ly + bob + m.arm * reach * 0.12, WRAITH[2] + lz + m.arm * reach * 0.35 + tatter * 0.5] };
      }
      case "skull":
        return { ...s, position: placeSkull(m, t) };
      case "spirit": {
        const a = (t * 0.16 + m.phase) % 1;
        const op = Math.min(1, a / 0.12, (1 - a) / 0.3);
        return { ...s, position: placeSpirit(m, t), opacity: s.opacity * Math.max(0, op) };
      }
      case "hand": {
        const claw = (Math.sin(t * 1.6 + m.w * 6) + 1) / 2;
        return { ...s, position: [x, y - claw * 0.06 * m.f, z + claw * 0.1 * m.f] };
      }
      case "swing": {
        const [lx, ly, lz] = m.local;
        return { ...s, position: [CAGE_PIVOT[0] + lx * Math.cos(swing) - ly * Math.sin(swing), CAGE_PIVOT[1] + lx * Math.sin(swing) + ly * Math.cos(swing), CAGE_PIVOT[2] + lz] };
      }
      case "fog": {
        const nx = ((((x + 5 + t * 0.3 * m.speed) % 10) + 10) % 10) - 5;
        const fade = Math.min(1, (5 - Math.abs(nx)) / 1.2);
        return { ...s, position: [nx, y + Math.sin(t * 0.9 + m.w * 6) * 0.05, z], opacity: s.opacity * Math.max(0, fade) * (0.85 + 0.15 * Math.sin(t * 1.3 + m.w * 9)) };
      }
      case "blink":
        return (t + m.w) % 3.1 < 0.15 ? { ...s, opacity: 0 } : s;
      case "wisp": {
        const a = t * 0.9 + m.w * 6;
        return { ...s, position: [x + Math.sin(a) * 0.4, y + Math.sin(a * 1.7) * 0.25, z + Math.cos(a) * 0.3] };
      }
    }
  });
}
