import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, shadeBand } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#0e0a10"), eyeWhite: hex("#fff4dc"), pupil: hex("#0a060a") };

const YELLOW = ramp("#8a5a0c", "#d09414", "#f6c82c", "#fff29a");
const CROW = ramp("#07070d", "#13131d", "#25253a", "#43476a");
const HOOD = ramp("#2a2a32", "#4a4a58", "#767686", "#a8a8b8");

/**
 * body = main plumage, belly = pale head / tail (or golden nape), plate = dark flight feathers.
 * extras = [beak & feet x4, bark x4, crow x4, hooded-crow grey x4, eagle iris, crow iris, lichen]
 */
const mk = (name: string, body: string[], belly: string[], plate: string[], wood: string[]): Palette => ({
  name,
  body: ramp(...body),
  belly: ramp(...belly),
  plate: ramp(...plate),
  extras: [...YELLOW, ...ramp(...wood), ...CROW, ...HOOD, hex("#e8a010"), hex("#3a2428"), hex("#6a9a4a")],
  ...common,
});

export const EAGLE_PALETTES: readonly Palette[] = [
  mk("bald", ["#241810", "#3e2a1c", "#5e4430", "#86644a"], ["#8a90a8", "#b8bed0", "#e8ecf4", "#ffffff"], ["#0e0a08", "#1c1410", "#30221a", "#4c3a2c"], ["#2a2018", "#4a3a2c", "#7a6650", "#a8946e"]),
  mk("golden", ["#3a2412", "#5e3c1c", "#8a5e2c", "#b88a44"], ["#7a5418", "#b08626", "#dcb046", "#f8dc88"], ["#1a1008", "#2c1a0c", "#4a2e16", "#6c4a26"], ["#2c2a2e", "#4c484e", "#7c767c", "#aaa4a6"]),
  mk("slate", ["#222a36", "#3a4658", "#586a82", "#8498b2"], ["#7a8090", "#a8aebc", "#d4d8e2", "#f4f6fa"], ["#0a0c12", "#161a24", "#282e3c", "#44506a"], ["#32241c", "#54402e", "#846a4a", "#b09468"]),
];

export const EAGLE_VIEW = { target: [1.2, 0.2, 0] as Vec3, span: 7.8, pitch: 0.12 };

type Rig = Splat["rig"];
type Colour = (n: Vec3, p: Vec3, band: number) => Rgb;

/** Per-bird placement. The local frame faces +x; yaw is 0 or PI (sign `sg`) so splat axes stay aligned. */
interface Bird {
  readonly o: Vec3;
  readonly sg: 1 | -1;
  readonly s: number;
}
const BIRDS: readonly Bird[] = [
  { o: [0, 0, 0], sg: 1, s: 1 },
  { o: [3.3, -1.15, 0], sg: -1, s: 0.6 },
];
const NECK: Vec3 = [0.3, 2.35, 0];
const JAW: Vec3 = [0.82, 2.8, 0];
const SHOULDER: Vec3 = [0.2, 2.0, 0.5];

// rig groups are bird * 10 + part
const HEAD = 1;
const LOWER = 2;
const WING_L = 3;
const WING_R = 4;
const TAIL = 5;
const EYE = 6;
const FEATHER = 91;

const argmax = (v: Vec3): 0 | 1 | 2 => {
  const a = Math.abs(v[0]);
  const b = Math.abs(v[1]);
  const c = Math.abs(v[2]);
  return a >= b && a >= c ? 0 : b >= c ? 1 : 2;
};
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const noise = (p: Vec3) => Math.sin(p[0] * 17 + p[2] * 5) * Math.sin(p[1] * 21 + p[0] * 4) * Math.sin(p[2] * 19 + p[1] * 6);

export function buildEagleCrow(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 15000);
  const splats: Splat[] = [];
  const X = palette.extras;
  const YEL = X.slice(0, 4);
  const WOOD = X.slice(4, 8);
  const CRW = X.slice(8, 12);
  const HD = X.slice(12, 16);
  const [EAGLE_IRIS, CROW_IRIS, LICHEN] = [X[16]!, X[17]!, X[18]!];
  const hooded = palette.name === "slate";
  const whiteHead = palette.name !== "golden";
  const whiteTail = palette.name === "bald";
  const golden = palette.name === "golden";

  /** Raw world-space blob, used for scenery. */
  const raw = (position: Vec3, scale: Vec3, color: Rgb, opacity = rng.range(0.9, 1)): void => {
    splats.push({ position, scale, color, opacity });
  };

  function bird(i: 0 | 1): void {
    const { o, sg, s } = BIRDS[i]!;
    const crow = i === 1;
    const bz = crow ? 0.84 : 1;
    const g = (part: number) => i * 10 + part;
    const P = (l: Vec3): Vec3 => [o[0] + sg * s * l[0], o[1] + s * l[1], o[2] + sg * s * l[2]];
    const W = (n: Vec3): Vec3 => [sg * n[0], n[1], sg * n[2]];
    const put = (l: Vec3, sc: Vec3, color: Rgb, rig?: Rig, opacity = rng.range(0.88, 1)): void => {
      splats.push({ position: P(l), scale: [sc[0] * s, sc[1] * s, sc[2] * s], color, opacity, ...(rig ? { rig } : {}) });
    };
    const jitter = (b: number): number => {
      const r = rng.next();
      return r < 0.07 ? clampBand(b + 1) : r < 0.13 ? clampBand(b - 1) : b;
    };

    /** Eagle: dark brown with scalloped breast, white (or golden) head. Crow: glossy black, grey if hooded. */
    const plumage: Colour = (_n, p, b) => {
      const m = noise(p);
      const bb = clampBand(b + (m > 0.42 ? 1 : m < -0.42 ? -1 : 0));
      if (crow) {
        if (hooded && p[1] < 2.3 && p[1] > 0.5) return HD[bb]!;
        return CRW[clampBand(bb + (b >= 2 && m > 0.2 ? 1 : 0))]!;
      }
      if (whiteHead && p[1] > 2.3 && p[0] > -0.1) return palette.belly[clampBand(b + (m > 0.5 ? 1 : m < -0.5 ? -1 : 0))]!;
      if (golden && p[1] > 2.4 && p[0] < 0.55) return palette.belly[bb]!;
      const scallop = Math.sin(p[1] * 14 + Math.sin(p[2] * 9) * 0.8);
      if (scallop > 0.55) return palette.body[clampBand(bb + 1)]!;
      if (scallop < -0.72) return palette.plate[bb]!;
      return palette.body[bb]!;
    };

    /** Shingled contour feathers on an ellipsoid, lying along `flow`. */
    function skin(c: Vec3, r: Vec3, dens: number, len: number, flow: Vec3, color: Colour, rigAt?: (p: Vec3) => Rig, keep?: (n: Vec3, p: Vec3) => boolean): void {
      const avg = (r[0] + r[1] + r[2]) / 3;
      const count = Math.round(4 * Math.PI * avg * avg * dens);
      for (let k = 0; k < count; k++) {
        const u = rng.onSphere();
        const n = normalize([u[0] / r[0], u[1] / r[1], u[2] / r[2]]);
        const q: Vec3 = [c[0] + u[0] * r[0] * rng.range(0.96, 1.04), c[1] + u[1] * r[1] * rng.range(0.96, 1.04), c[2] + u[2] * r[2] * rng.range(0.96, 1.04)];
        if (keep && !keep(n, q)) continue;
        const fd = flow[0] * n[0] + flow[1] * n[1] + flow[2] * n[2];
        const t = normalize([flow[0] - n[0] * fd, flow[1] - n[1] * fd, flow[2] - n[2] * fd]);
        const ax = argmax(t);
        const dn = argmax(n);
        const L = len * rng.range(0.8, 1.25);
        const w = len * 0.42;
        const sc: [number, number, number] = [w, w, w];
        sc[ax] = L;
        if (dn !== ax) sc[dn] = w * 0.6;
        put(q, sc, color(n, q, jitter(shadeBand(W(n)))), rigAt?.(q));
      }
    }

    /** A flight feather: a tapering chain of flat splats from base a to tip b. */
    function quill(a: Vec3, b: Vec3, w: number, normal: Vec3, colorAt: (t: number, band: number) => Rgb, rigAt: (t: number) => Rig, bow: Vec3 = [0, 0, 0]): void {
      const len = dist(a, b);
      const n = Math.max(2, Math.ceil(len / (w * 1.1)));
      const d = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      const ax = argmax(d);
      const thin = argmax(normal);
      const band0 = shadeBand(W(normal));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const bp = Math.sin(Math.PI * t);
        const q = lerp3(a, b, t);
        const ww = w * (1 - 0.35 * t);
        const sc: [number, number, number] = [ww, ww, ww];
        sc[ax] = (len / n) * 0.8;
        if (thin !== ax) sc[thin] = ww * 0.4;
        put([q[0] + bow[0] * bp, q[1] + bow[1] * bp, q[2] + bow[2] * bp], sc, colorAt(t, jitter(band0)), rigAt(t));
      }
    }

    /** Round-section tube along a polyline (beak, legs, toes). */
    function tube(points: readonly Vec3[], r0: number, r1: number, colorAt: (t: number, band: number, p: Vec3) => Rgb, rigAt?: (t: number) => Rig, dens = 900): void {
      const lens = points.slice(1).map((p, k) => dist(p, points[k]!));
      const total = lens.reduce((a, b) => a + b, 0);
      for (let d = 0; d <= total; ) {
        let acc = 0;
        let seg = 0;
        while (seg < lens.length - 1 && acc + lens[seg]! < d) acc += lens[seg++]!;
        const t = d / total;
        const c = lerp3(points[seg]!, points[seg + 1]!, (d - acc) / (lens[seg] || 1));
        const r = r0 + (r1 - r0) * t;
        const count = Math.max(5, Math.round(4 * Math.PI * r * r * dens * 0.5));
        for (let k = 0; k < count; k++) {
          const u = rng.onSphere();
          const q: Vec3 = [c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r];
          const sz = Math.max(0.02, r * 0.5);
          put(q, [sz, sz, sz], colorAt(t, jitter(shadeBand(W(u))), q), rigAt?.(t), 0.95);
        }
        d += Math.max(0.02, r * 0.7);
      }
    }

    const headRig = (p: Vec3): Rig => (p[1] > 2.2 ? { group: g(HEAD), weight: Math.min(1, (p[1] - 2.2) / 0.7) } : undefined);
    const fullHead: Rig = { group: g(HEAD), weight: 1 };
    const flowDown: Vec3 = [-0.45, -1, 0];
    const dens = 380;

    // --- torso, chest and neck, feathered ---
    skin([-0.7, 1.0, 0], [0.72, 0.58, 0.5 * bz], dens, 0.09, flowDown, plumage);
    skin([-0.3, 1.45, 0], [0.78, 0.82, 0.62 * bz], dens, 0.09, flowDown, plumage);
    skin([0.15, 1.95, 0], [0.62, 0.72, 0.58 * bz], dens, 0.085, flowDown, plumage, headRig);
    skin([0.38, 2.5, 0], [0.4, 0.42, 0.38 * bz], dens * 1.2, crow ? 0.06 : 0.075, [-0.25, -1, 0], plumage, headRig);
    // under-tail coverts and hackles
    skin([-0.85, 0.82, 0], [0.34, 0.4, 0.3 * bz], dens, 0.09, [-0.4, -1, 0], plumage);
    if (!crow) skin([0.2, 2.45, 0], [0.5, 0.3, 0.46], dens * 0.8, 0.13, [-1, -0.7, 0], plumage, headRig, (n) => n[1] > -0.1);

    // --- head ---
    const headR: Vec3 = crow ? [0.35, 0.32, 0.27] : [0.36, 0.33, 0.29];
    skin([0.58, 2.95, 0], headR, dens * 1.8, crow ? 0.045 : 0.05, [-1, -0.2, 0], plumage, () => fullHead);

    // beak: hooked and yellow for the eagle, stout and black for the crow
    const upper: Vec3[] = crow ? [[0.8, 2.92, 0], [1.06, 2.9, 0], [1.34, 2.84, 0], [1.4, 2.76, 0]] : [[0.8, 2.9, 0], [1.02, 2.9, 0], [1.2, 2.82, 0], [1.27, 2.66, 0]];
    tube(upper, crow ? 0.15 : 0.16, crow ? 0.05 : 0.04, (t, b) => (crow ? CRW[b]! : YEL[t > 0.82 ? 0 : t < 0.3 ? clampBand(b + 1) : b]!), () => fullHead);
    const lower: Vec3[] = crow ? [[0.8, 2.78, 0], [1.08, 2.76, 0], [1.3, 2.76, 0]] : [[0.82, 2.76, 0], [1.05, 2.72, 0], [1.18, 2.66, 0]];
    tube(lower, crow ? 0.1 : 0.09, 0.04, (t, b) => (crow ? CRW[b]! : YEL[t > 0.85 ? 0 : b]!), (t) => ({ group: g(LOWER), weight: t }));
    if (crow) {
      skin([0.9, 2.9, 0], [0.2, 0.15, 0.2], 900, 0.05, [1, 0, 0], (_n, _p, b) => CRW[b]!, () => fullHead); // nasal bristles
    } else {
      for (const sd of [-1, 1]) {
        put([0.9, 2.95, sd * 0.1], [0.03, 0.03, 0.03], palette.plate[0]!, fullHead); // nostril
        skin([0.7, 3.13, sd * 0.2], [0.2, 0.06, 0.1], 1500, 0.04, [1, 0, 0], (_n, _p, b) => palette.plate[b]!, () => fullHead); // brow ridge
      }
    }
    for (const sd of [-1, 1]) {
      const eye: Rig = { group: g(EYE), weight: 1 };
      put([0.8, 3.0, sd * 0.25], [0.085, 0.085, 0.085], crow ? CROW_IRIS : EAGLE_IRIS, eye, 1);
      put([0.86, 3.0, sd * 0.29], [0.04, 0.045, 0.04], palette.pupil, eye, 1);
      put([0.9, 3.04, sd * 0.3], [0.016, 0.014, 0.014], palette.eyeWhite, eye, 1);
    }

    // --- legs and feet ---
    for (const sd of [-1, 1]) {
      const z = sd * 0.33;
      if (!crow) skin([-0.1, 0.95, sd * 0.36], [0.38, 0.55, 0.26], dens, 0.085, [-0.2, -1, 0], plumage);
      else skin([-0.1, 0.9, sd * 0.3], [0.28, 0.42, 0.2], dens, 0.07, [-0.2, -1, 0], plumage);
      const leg = crow ? CRW : YEL;
      tube([[0.05, 0.55, z], [0.12, 0.08, z]], crow ? 0.055 : 0.12, crow ? 0.045 : 0.1, (_t, b, p) => leg[clampBand(b + (Math.sin(p[1] * 40) > 0.6 ? -1 : 0))]!);
      for (const splay of [-0.13, 0, 0.14]) {
        const tip: Vec3 = [crow ? 0.55 : 0.62, 0.05, z + splay * 1.4 * (crow ? 0.7 : 1)];
        tube([[0.12, 0.07, z], tip], crow ? 0.04 : 0.065, crow ? 0.03 : 0.05, (_t, b) => leg[b]!);
        tube([tip, [tip[0] + 0.1, tip[1] - 0.09, tip[2]]], crow ? 0.03 : 0.048, 0.012, () => (crow ? CRW[0]! : palette.plate[0]!), undefined, 1500);
      }
      const back: Vec3 = [-0.25, 0.04, z];
      tube([[0.1, 0.07, z], back], crow ? 0.04 : 0.065, crow ? 0.03 : 0.05, (_t, b) => leg[b]!);
      tube([back, [back[0] - 0.08, back[1] - 0.09, z]], crow ? 0.03 : 0.05, 0.012, () => (crow ? CRW[0]! : palette.plate[0]!), undefined, 1500);
    }

    // --- wings, folded: coverts, secondaries, long primaries ---
    for (const sd of [-1, 1] as const) {
      const wg = g(sd === 1 ? WING_L : WING_R);
      const wingColor = (t: number, b: number): Rgb => {
        const m = noise([t * 5, sd, b]);
        if (t > (crow ? 0.66 : 0.7)) return crow ? CRW[clampBand(b - 1)]! : palette.plate[clampBand(b - (m > 0 ? 0 : 1))]!;
        if (crow) return CRW[clampBand(b + (b >= 2 && m > 0.1 ? 1 : 0))]!;
        return palette.body[clampBand(b + (Math.sin(t * 18) > 0.7 ? -1 : 0))]!;
      };
      const covertColor: Colour = (_n, p, b) => {
        const m = noise([p[0] * 1.3, p[1] * 1.3, p[2] * 1.3]);
        if (crow) return CRW[clampBand(b + (b >= 2 && m > 0 ? 1 : 0))]!;
        if (golden && m > 0.6) return palette.belly[clampBand(b - 1)]!;
        const row = Math.sin(p[1] * 24 + p[0] * 5 + sd);
        return palette.body[clampBand(b + (row > 0.55 ? 1 : row < -0.7 ? -1 : 0) + (m > 0.5 ? 1 : 0))]!;
      };
      skin([-0.05, 1.72, sd * 0.5], [0.66, 0.8, 0.28], dens * 1.1, 0.09, [-0.5, -1, 0], covertColor, () => ({ group: wg, weight: 0.3 }), (n) => n[2] * sd > 0.22);
      // secondaries
      for (let k = 0; k < 9; k++) {
        const u = k / 8;
        const a: Vec3 = [0.1 - 0.6 * u, 1.85 - 0.2 * u, sd * (0.64 + 0.02 * k)];
        const b: Vec3 = [-0.7 - 1.0 * u, 0.65 + 0.25 * u, sd * (0.55 - 0.1 * u)];
        quill(a, b, 0.085, [0, 0, sd], wingColor, (t) => ({ group: wg, weight: 0.3 + 0.35 * t }));
      }
      // primaries fan back across the tail
      const pl = crow ? 0.88 : 1;
      for (let k = 0; k < 8; k++) {
        const a: Vec3 = [0.3 - 0.14 * k, 2.0 - 0.05 * k, sd * (0.7 - 0.01 * k)];
        const far: Vec3 = [-1.0 - 0.16 * k, 1.15 - 0.2 * k, sd * (0.5 - 0.02 * k)];
        quill(a, lerp3(a, far, pl), 0.075, [0, 0, sd], wingColor, (t) => ({ group: wg, weight: 0.45 + 0.55 * t }), [0, 0, sd * 0.05]);
      }
    }

    // --- tail: a fan of rectrices ---
    const tl = crow ? 1.15 : 1;
    for (let k = 0; k < 11; k++) {
      const l = (k - 5) / 5;
      const a: Vec3 = [-0.9, 1.0, l * 0.12];
      const b: Vec3 = [-0.9 - (1.0 - 0.15 * Math.abs(l)) * tl, 1.0 - (1.0 - (crow ? 0.18 : 0.1) * Math.abs(l)) * tl, l * (crow ? 0.5 : 0.62)];
      quill(a, b, 0.1, [0.5, 0.8, 0.0], (t, band) => {
        if (crow) return CRW[clampBand(band + (band >= 2 && t < 0.6 ? 1 : 0))]!;
        if (whiteTail) return palette.belly[clampBand(band + (Math.abs(l) < 0.12 ? -1 : 0))]!;
        return Math.sin(t * 13) > 0.62 ? palette.body[clampBand(band + 1)]! : palette.plate[clampBand(band)]!;
      }, (t) => ({ group: g(TAIL), weight: t }));
    }
  }

  bird(0);
  bird(1);

  // --- the weathered snag they perch on ---
  const bark = (p: Vec3, n: Vec3, size: number, tall = 1): void => {
    const groove = Math.sin(Math.atan2(p[2], p[0] - 0.1) * 9 + p[1] * 1.3 + Math.sin(p[1] * 2));
    const m = noise(p);
    const b = clampBand(shadeBand(n) + (groove > 0.6 ? 1 : groove < -0.6 ? -1 : 0));
    const lichen = m > 0.58 && p[1] > -2.4;
    raw(p, [size, size * tall, size], lichen ? LICHEN : WOOD[b]!, 1);
  };
  for (let y = -2.9; y <= 0; y += 0.075) {
    const flare = Math.max(0, (-y - 1.5) / 1.4) ** 1.6 * 0.8;
    const r = 0.8 + 0.08 * Math.sin(y * 2.3) + flare;
    const count = Math.ceil((2 * Math.PI * r) / 0.085);
    for (let j = 0; j < count; j++) {
      const a = ((j + rng.next()) / count) * Math.PI * 2;
      const rr = r * (1 + 0.05 * Math.sin(a * 9 + y * 1.3));
      bark([0.1 + rr * Math.cos(a), y, rr * Math.sin(a)], [Math.cos(a), 0, Math.sin(a)], 0.075, 1.7);
    }
  }
  for (let rho = 0; rho < 0.8; rho += 0.07) {
    const count = Math.max(1, Math.ceil((2 * Math.PI * rho) / 0.08));
    for (let j = 0; j < count; j++) {
      const a = ((j + rng.next()) / count) * Math.PI * 2;
      raw([0.1 + rho * Math.cos(a), -0.03 + rng.range(-0.02, 0.02), rho * Math.sin(a)], [0.07, 0.04, 0.07], WOOD[Math.floor(rho * 9) % 2 ? 3 : 2]!, 1);
    }
  }
  const branch = (pts: readonly Vec3[], r0: number, r1: number): void => {
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k]!;
      const b = pts[k + 1]!;
      const steps = Math.ceil(dist(a, b) / 0.06);
      for (let j = 0; j <= steps; j++) {
        const t = (k + j / steps) / (pts.length - 1);
        const c = lerp3(a, b, j / steps);
        const r = r0 + (r1 - r0) * t;
        for (let q = 0; q < Math.max(6, Math.round(r * 60)); q++) {
          const u = rng.onSphere();
          bark([c[0] + u[0] * r, c[1] + u[1] * r, c[2] + u[2] * r], u, Math.max(0.04, r * 0.3));
        }
      }
    }
  };
  branch([[0.7, -2.0, 0], [1.9, -1.72, 0.05], [2.9, -1.45, 0], [4.1, -1.2, -0.05]], 0.28, 0.13);
  branch([[3.1, -1.4, 0], [3.5, -0.6, 0.3], [3.65, -0.3, 0.3]], 0.06, 0.022);
  branch([[2.0, -1.8, 0], [2.4, -2.4, -0.3], [2.3, -2.8, -0.35]], 0.07, 0.025);
  // gnarled roots and a mossy mound
  branch([[0.7, -2.7, 0.3], [1.5, -2.95, 0.8], [2.2, -3.0, 1.0]], 0.26, 0.09);
  branch([[-0.5, -2.7, -0.3], [-1.3, -2.95, -0.8], [-2.0, -3.0, -1.0]], 0.26, 0.09);
  for (let k = 0; k < 700; k++) {
    const a = rng.range(0, Math.PI * 2);
    const rho = Math.sqrt(rng.next()) * 2.4;
    raw([0.1 + Math.cos(a) * rho, -3.05 + rng.range(0, 0.15) * (1 - rho / 2.6), Math.sin(a) * rho], [0.14, 0.06, 0.14], rng.next() < 0.55 ? LICHEN : WOOD[rng.next() < 0.5 ? 1 : 0]!, 0.95);
  }

  // a few loose feathers drifting down, looping with fade
  for (let f = 0; f < 3; f++) {
    const phase = f / 3;
    const at: Vec3 = [-0.6 - f * 0.35, 3.4, 0.5 - f * 0.4];
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const w = 0.05 * (1 - 0.4 * t);
      const color = palette.belly[clampBand(2 + (k % 2))]!;
      splats.push({ position: [at[0] - t * 0.4, at[1] - t * 0.1, at[2]], scale: [0.07, w * 0.5, w * 0.5], color, opacity: 1, rig: { group: FEATHER, weight: phase } });
    }
  }
  return splats;
}

const rotX = (l: Vec3, p: Vec3, a: number): Vec3 => {
  const dy = l[1] - p[1];
  const dz = l[2] - p[2];
  return [l[0], p[1] + dy * Math.cos(a) - dz * Math.sin(a), p[2] + dy * Math.sin(a) + dz * Math.cos(a)];
};
const rotY = (l: Vec3, p: Vec3, a: number): Vec3 => {
  const dx = l[0] - p[0];
  const dz = l[2] - p[2];
  return [p[0] + dx * Math.cos(a) + dz * Math.sin(a), l[1], p[2] - dx * Math.sin(a) + dz * Math.cos(a)];
};
const rotZ = (l: Vec3, p: Vec3, a: number): Vec3 => {
  const dx = l[0] - p[0];
  const dy = l[1] - p[1];
  return [p[0] + dx * Math.cos(a) - dy * Math.sin(a), p[1] + dx * Math.sin(a) + dy * Math.cos(a), l[2]];
};
const pulse = (x: number, sharp: number) => Math.max(0, Math.sin(x)) ** sharp;

/**
 * The eagle ignores the crow (head slowly turns away and back, an occasional screech, a slow wing flare, blinks);
 * the crow caws, tips its head up and flicks its wings; spare feathers drift past.
 */
export function poseEagleCrow(splats: readonly Splat[], t: number): Splat[] {
  const act = [
    { turn: 0.9 * Math.sin(t * 0.55), pitch: 0, gape: 0.5 * pulse(t * 1.3 + 1, 12), lift: 0.9 * pulse(t * 0.8 + 2.2, 10), blink: Math.sin(t * 1.7 + 0.5) > 0.97 },
    { turn: 0.12 * Math.sin(t * 5.2) * pulse(t * 2.6, 2), pitch: 0.3 * pulse(t * 2.6, 2), gape: 0.55 * pulse(t * 2.6, 2), lift: 0.35 * pulse(t * 2.6, 2), blink: Math.sin(t * 2.1 + 1) > 0.96 },
  ];
  return splats.map((s) => {
    const r = s.rig;
    if (!r) return s;
    if (r.group === FEATHER) {
      const f = (t * 0.09 + r.weight) % 1;
      const [x, y, z] = s.position;
      return { ...s, position: [x + Math.sin(f * 14 + r.weight * 9) * 0.35, y - f * 6.5, z + Math.cos(f * 11 + r.weight * 5) * 0.3], opacity: Math.min(1, 5 * f, 5 * (1 - f)) };
    }
    const bi = Math.floor(r.group / 10) as 0 | 1;
    const part = r.group % 10;
    const { o, sg, s: sc } = BIRDS[bi]!;
    const a = act[bi]!;
    let l: Vec3 = [(s.position[0] - o[0]) * sg / sc, (s.position[1] - o[1]) / sc, (s.position[2] - o[2]) * sg / sc];
    let scale = s.scale;
    const headed = part === HEAD || part === LOWER || part === EYE;
    if (part === LOWER) l = rotZ(l, JAW, -a.gape * r.weight);
    if (headed) {
      const w = part === HEAD ? r.weight : 1;
      l = rotZ(l, NECK, a.pitch * w);
      l = rotY(l, NECK, a.turn * w);
    }
    if (part === EYE && a.blink) scale = [scale[0], scale[1] * 0.12, scale[2]];
    if (part === WING_L || part === WING_R) {
      const sd = part === WING_L ? 1 : -1;
      l = rotX(l, [SHOULDER[0], SHOULDER[1], sd * SHOULDER[2]], -sd * a.lift * (0.35 + 0.65 * r.weight));
    }
    if (part === TAIL) {
      l = [l[0], l[1] + 0.12 * a.lift * r.weight, l[2] * (1 + 0.35 * a.lift * r.weight) + Math.sin(t * 1.7 + bi) * 0.03 * r.weight];
      if (bi === 1) l = [l[0], l[1] + 0.2 * a.pitch * r.weight, l[2]];
    }
    return { ...s, scale, position: [o[0] + sg * sc * l[0], o[1] + sc * l[1], o[2] + sg * sc * l[2]] };
  });
}
