import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, shadeBand, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#120c08"), eyeWhite: hex("#f4ecd8"), pupil: hex("#080404") };

/**
 * Natural, bird-like plumage: body = feathers, belly = pale underside, plate = dark barring;
 * extras = [sand dark, sand light, egg, dry grass, amber iris, bare scaly skin]
 */
export const RAPTOR_PALETTES: readonly Palette[] = [
  { name: "steppe", body: ramp("#3e2a1c", "#6a4a2e", "#9a7044", "#c49a62"), belly: ramp("#8a7a62", "#b4a284", "#d8caa8", "#f2e8cc"), plate: ramp("#1e140e", "#3a2416", "#6a3a1e", "#a85a2a"), extras: ramp("#8a6a44", "#b8945e", "#e4dcc4", "#a88a4a", "#e0a020", "#5a4a3a"), ...common },
  { name: "forest", body: ramp("#26221a", "#423a28", "#665a3c", "#8e8058"), belly: ramp("#6a665a", "#948e7c", "#bcb6a0", "#e4dec8"), plate: ramp("#0e0c0a", "#1e1a14", "#3a2a1e", "#7a5a3a"), extras: ramp("#3a3020", "#5a4a30", "#d8d4c0", "#6a6a34", "#d8b030", "#3a3428"), ...common },
  { name: "ash", body: ramp("#2e2c2c", "#4a4846", "#72706a", "#9e9a92"), belly: ramp("#8a8884", "#b2b0aa", "#d6d4ce", "#f4f2ec"), plate: ramp("#0c0c0c", "#1c1a1a", "#3a2a24", "#8a4a2a"), extras: ramp("#5a5450", "#86807a", "#e8e4d8", "#8a7a5a", "#e8c040", "#4a4440"), ...common },
];

export const RAPTOR_VIEW = { target: [-0.6, 1.9, 0] as Vec3, span: 10, pitch: 0.18 };

const HEAD = 1;
const TAIL = 2;
const CLAW = 3;
const ARM = 4;
const CREST = 5;
const BODY = 6;
const EYE = 7;
const NECK_START = 1.0;

export function buildVelociraptor(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 7000);
  const { splats, shell, limb, dot } = createSculptor(rng, 150);
  const [S0, S1, EGG, GRASS, IRIS, BARE] = palette.extras as [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb];
  const head = { group: HEAD, weight: 1 };
  /** Neck and head follow the head rig, weighted by how far up the neck they sit. */
  const rigAt = (p: Vec3): Splat["rig"] =>
    p[0] > NECK_START && p[1] > 2.5 ? { group: HEAD, weight: Math.min(1, (p[0] - NECK_START) / 1.0) } : p[0] < -1.3 ? { group: TAIL, weight: 0 } : { group: BODY, weight: 0 };

  const noise = (p: Vec3) => Math.sin(p[0] * 23.1 + p[2] * 7) * Math.sin(p[1] * 19.7 + p[0] * 5) * Math.sin(p[2] * 17.3 + p[1] * 3);
  /** Plumage colour: dark bars across the back and tail, mottled flanks, pale throat and belly. */
  const plumage = (n: Vec3, p: Vec3, b: number): Rgb => {
    const m = noise(p);
    const bb = clampBand(b + (m > 0.35 ? 1 : m < -0.35 ? -1 : 0));
    if (n[1] < -0.3) return palette.belly[clampBand(bb + 1)]!;
    const bar = Math.sin(p[0] * 9 + Math.sin(p[2] * 6 + p[1] * 3) * 0.7);
    if (n[1] > -0.05 && bar > 0.62) return palette.plate[clampBand(bb - 1)]!;
    if (n[1] > 0.5 && m > 0.55) return palette.plate[2]!;
    return palette.body[bb]!;
  };
  const scaly: ColorFn = (_n, p, b) => (noise([p[0] * 2.5, p[1] * 2.5, p[2] * 2.5]) > 0.2 ? BARE : palette.body[clampBand(b - 1)]!);
  const claw: ColorFn = (_n, _p, b) => (b > 2 ? palette.belly[1]! : palette.outline);

  /** Shingled contour feathers over an ellipsoid: small soft splats laid back along -x. */
  function feathers(center: Vec3, radii: Vec3, density: number, len: number, rig?: (p: Vec3) => Splat["rig"]): void {
    const avg = (radii[0] + radii[1] + radii[2]) / 3;
    const count = Math.round(4 * Math.PI * avg * avg * density);
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const n = normalize([u[0] / radii[0], u[1] / radii[1], u[2] / radii[2]]);
      const k = rng.range(1.0, 1.08);
      const p: Vec3 = [center[0] + u[0] * radii[0] * k - len * 0.4, center[1] + u[1] * radii[1] * k - len * 0.12, center[2] + u[2] * radii[2] * k];
      const l = len * rng.range(0.8, 1.25);
      const r = rig?.(p) ?? rigAt(p);
      splats.push({ position: p, scale: [l, l * 0.42, l * 0.5], color: plumage(n, p, shadeBand(n)), opacity: rng.range(0.85, 0.97), ...(r ? { rig: r } : {}) });
    }
  }
  /** Feathers along a polyline (neck, tail) so every point gets a tube of plumage. */
  function featherTube(points: readonly Vec3[], r0: number, r1: number, len: number, perRing: number): void {
    const seg = points.length - 1;
    const steps = seg * 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const si = Math.min(seg - 1, Math.floor(t * seg));
      const f = t * seg - si;
      const a = points[si]!;
      const b = points[si + 1]!;
      const c: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      const r = r0 + (r1 - r0) * t;
      feathers(c, [r, r, r], perRing / (4 * Math.PI * r * r), len * (1 - t * 0.4));
    }
  }

  // ---- body: slung low and level between high hips, every surface feathered
  shell([-0.05, 2.3, 0], [1.0, 0.52, 0.42], plumageFn());
  shell([0.65, 2.25, 0], [0.48, 0.48, 0.38], plumageFn());
  shell([-0.8, 2.45, 0], [0.55, 0.48, 0.4], plumageFn());
  feathers([-0.05, 2.3, 0], [1.0, 0.52, 0.42], 160, 0.1);
  feathers([0.65, 2.25, 0], [0.48, 0.48, 0.38], 170, 0.09);
  feathers([-0.8, 2.45, 0], [0.55, 0.48, 0.4], 170, 0.1);
  function plumageFn(): ColorFn {
    return (n, p, b) => plumage(n, p, b);
  }

  // ---- neck: slender S-curve, feathered
  const neck: Vec3[] = [[1.0, 2.45, 0], [1.3, 2.85, 0], [1.55, 3.2, 0], [1.85, 3.36, 0]];
  limb(neck, 0.3, 0.17, plumageFn(), HEAD);
  featherTube(neck, 0.3, 0.18, 0.08, 34);

  // ---- skull: long, low and narrow, snout slightly dished and upturned, lips over the teeth
  const skin: ColorFn = (n, p, b) => {
    if (n[1] < -0.4) return palette.belly[clampBand(b)]!;
    const scale = Math.sin(p[0] * 60) * Math.sin(p[1] * 60 + p[2] * 40) > 0.5;
    return scale ? palette.body[clampBand(b - 1)]! : palette.body[b]!;
  };
  shell([2.1, 3.4, 0], [0.32, 0.22, 0.2], skin, head); // braincase
  shell([2.5, 3.34, 0], [0.34, 0.15, 0.14], skin, head);
  shell([2.85, 3.3, 0], [0.26, 0.11, 0.11], skin, head);
  shell([3.08, 3.33, 0], [0.09, 0.075, 0.08], skin, head); // upturned tip
  shell([2.52, 3.19, 0], [0.5, 0.065, 0.12], skin, head); // lower jaw
  shell([2.0, 3.24, 0], [0.18, 0.1, 0.16], skin, head); // jaw muscle
  feathers([2.0, 3.45, 0], [0.24, 0.2, 0.19], 300, 0.07, () => head); // feathered back of the head
  for (const side of [-1, 1]) {
    // lip line, with only the front tooth tips showing
    for (let x = 2.2; x < 3.05; x += 0.035) dot([x, 3.235 + (x - 2.2) * 0.04, side * (0.12 - (x - 2.2) * 0.06)], 0.014, palette.outline, { rig: head });
    for (const x of [2.85, 2.93, 3.0]) dot([x, 3.235, side * 0.08], 0.016, palette.eyeWhite, { tall: 1.6, rig: head });
    dot([3.1, 3.36, side * 0.06], 0.028, palette.outline, { tall: 0.7, rig: head }); // nostril
    shell([2.42, 3.35, side * 0.12], [0.12, 0.06, 0.03], () => palette.body[0]!, head); // antorbital hollow
    shell([2.17, 3.53, side * 0.15], [0.16, 0.035, 0.06], skin, head); // brow
    const eye: Splat["rig"] = { group: EYE, weight: 1 };
    dot([2.15, 3.45, side * 0.165], 0.085, palette.body[0]!, { rig: head }); // eyelid ring
    dot([2.15, 3.45, side * 0.18], 0.065, IRIS, { rig: eye });
    dot([2.16, 3.45, side * 0.205], 0.03, palette.pupil, { rig: eye });
    dot([2.13, 3.47, side * 0.215], 0.012, palette.eyeWhite, { rig: eye }); // catchlight
    dot([1.93, 3.38, side * 0.17], 0.025, palette.outline, { rig: head }); // ear opening
  }
  // a low crest of longer feathers along the nape
  for (let i = 0; i < 10; i++) {
    const x = 2.0 - i * 0.12;
    const y = 3.58 - i * 0.07;
    limb([[x, y, 0], [x - 0.2, y + 0.1 - i * 0.004, 0]], 0.035, 0.012, (_n, p, b) => plumage([0, 1, 0], p, b), CREST);
  }

  // ---- wing-arms folded against the flanks, with long primaries and secondaries
  for (const side of [-1, 1]) {
    const sh: Vec3 = [0.85, 2.35, side * 0.38];
    const el: Vec3 = [0.6, 2.0, side * 0.46];
    const wr: Vec3 = [1.1, 1.95, side * 0.48];
    const hand: Vec3 = [1.3, 1.88, side * 0.47];
    limb([sh, el, wr, hand], 0.12, 0.05, plumageFn(), ARM);
    for (const [dy, dz, l] of [[0.04, 0.03, 0.16], [0, 0, 0.2], [-0.05, -0.03, 0.12]] as const) {
      limb([hand, [hand[0] + l, hand[1] + dy - 0.02, hand[2] + side * dz], [hand[0] + l + 0.05, hand[1] + dy - 0.1, hand[2] + side * dz]], 0.025, 0.006, claw, ARM);
    }
    // coverts then flight feathers, trailing back and down, quills pale
    for (let i = 0; i < 14; i++) {
      const f = i / 13;
      const base: Vec3 = [el[0] + (hand[0] - el[0]) * f, el[1] + (hand[1] - el[1]) * f, side * 0.52];
      const len = 0.35 + f * 0.35;
      const tip: Vec3 = [base[0] - len, base[1] - 0.25 - f * 0.05, side * (0.56 + f * 0.04)];
      const vane: ColorFn = (_n, p, b) => (Math.sin(p[0] * 26) > 0.55 ? palette.plate[clampBand(b - 1)]! : palette.body[clampBand(b - (f > 0.6 ? 1 : 0))]!);
      limb([base, tip], 0.05, 0.018, vane, ARM);
      dot([(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, side * 0.6], 0.012, palette.belly[3]!, { tall: 1, rig: { group: ARM, weight: 0.5 } });
    }
    feathers([0.75, 2.12, side * 0.48], [0.25, 0.18, 0.06], 380, 0.06, () => ({ group: ARM, weight: 0.3 })); // coverts

    // ---- legs: feathered thigh and shin, bare scaly feet, sickle claw held off the ground
    const s = side * 0.36;
    shell([-0.6, 2.05, s], [0.45, 0.55, 0.24], plumageFn());
    feathers([-0.6, 2.0, s], [0.45, 0.55, 0.25], 200, 0.09, () => ({ group: BODY, weight: 0 }));
    const shin: Vec3[] = [[-0.45, 1.65, s], [-0.15, 0.98, s], [-0.32, 0.55, s]];
    limb(shin, 0.21, 0.1, plumageFn());
    featherTube(shin, 0.2, 0.12, 0.07, 26);
    limb([[-0.32, 0.55, s], [-0.1, 0.1, s]], 0.085, 0.07, scaly);
    for (let i = 0; i < 10; i++) dot([-0.31 + i * 0.022, 0.53 - i * 0.043, s + side * 0.08], 0.024, palette.body[0]!, { tall: 0.6 }); // scutes down the front of the shank
    for (const dz of [-0.08, 0.08]) {
      const toe: Vec3[] = [[-0.1, 0.08, s + dz * 0.5], [0.15, 0.06, s + dz * 1.2], [0.36, 0.035, s + dz * 1.6]];
      limb(toe, 0.055, 0.035, scaly);
      for (const p of toe) shell([p[0], 0.025, p[2]], [0.05, 0.025, 0.04], () => BARE); // toe pads
      limb([toe[2]!, [0.47, 0.02, s + dz * 1.7], [0.5, -0.0, s + dz * 1.7]], 0.026, 0.005, claw);
    }
    limb([[-0.16, 0.12, s - side * 0.02], [-0.28, 0.07, s - side * 0.04]], 0.03, 0.01, scaly); // hallux
    // digit II: the retractable sickle, curved and held up
    limb([[-0.05, 0.14, s + side * 0.07], [0.06, 0.24, s + side * 0.07]], 0.05, 0.04, scaly, CLAW);
    limb([[0.06, 0.24, s + side * 0.07], [0.18, 0.34, s + side * 0.07], [0.32, 0.33, s + side * 0.07], [0.4, 0.22, s + side * 0.07]], 0.04, 0.006, claw, CLAW);
  }

  // ---- tail: long, stiff and level, ending in a broad frond of feathers
  const tail: Vec3[] = [[-1.25, 2.5, 0], [-2.2, 2.6, 0], [-3.2, 2.55, 0], [-4.1, 2.45, 0]];
  limb(tail, 0.32, 0.06, plumageFn(), TAIL);
  featherTube(tail, 0.32, 0.08, 0.08, 30);
  for (let i = 0; i < 22; i++) {
    const x = -2.0 - i * 0.1;
    const y = 2.6 - Math.max(0, i - 10) * 0.012;
    const len = 0.12 + i * 0.022;
    const bar: ColorFn = (_n, p, b) => (Math.sin(p[0] * 14) > 0.4 ? palette.plate[clampBand(b - 1)]! : i > 18 ? palette.plate[1]! : palette.body[b]!);
    for (const side of [-1, 1]) limb([[x, y, side * 0.04], [x - len * 0.7, y - 0.03, side * (0.08 + len)]], 0.04, 0.016, bar, TAIL);
  }
  limb([[-4.1, 2.45, 0], [-4.75, 2.42, 0]], 0.07, 0.025, (_n, _p, b) => palette.plate[clampBand(b - 1)]!, TAIL);

  // ---- sandy ground with wind ripples, pebbles, sparse dry grass
  for (let i = 0; i < 1100; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = -0.5 + Math.cos(a) * rr * 5.4;
    const z = Math.sin(a) * rr * 3.4;
    const ripple = Math.sin(x * 2.2 + z * 1.1 + Math.sin(z * 0.8)) > 0.55;
    dot([x, 0.02, z], 0.2, ripple ? S1 : rng.next() < 0.15 ? S1 : S0, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 0.92;
    const r = rng.range(0.03, 0.08);
    shell([-0.5 + Math.cos(a) * rr * 5.2, r * 0.6, Math.sin(a) * rr * 3.2], [r, r * 0.7, r], (_n, _p, b) => palette.belly[clampBand(b - 2)]!);
  }
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.55, 0.95);
    const bx = -0.5 + Math.cos(a) * r * 5;
    const bz = Math.sin(a) * r * 3.1;
    if (Math.abs(bx + 0.5) < 2.5 && Math.abs(bz) < 1.0) continue;
    for (let k = 0; k < 6; k++) {
      const lean = rng.range(-0.25, 0.25);
      const h = rng.range(0.25, 0.5);
      for (let f = 0; f <= 1; f += 0.12) dot([bx + k * 0.04 + (lean - k * 0.04) * f, h * f, bz + lean * 0.5 * f], 0.022, f > 0.4 ? GRASS : S1);
    }
  }
  const rock: ColorFn = (_n, p, b) => palette.belly[clampBand(b - 2 + (Math.sin(p[0] * 30) * Math.sin(p[2] * 27) > 0.6 ? 1 : 0))]!;
  shell([2.6, 0.2, -1.8], [0.45, 0.3, 0.38], rock);
  shell([2.95, 0.12, -1.4], [0.22, 0.14, 0.2], rock);
  shell([-3.6, 0.18, -1.6], [0.36, 0.24, 0.3], rock);
  // a half-buried, sun-bleached skull of an earlier meal
  const bone: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.belly[2]!);
  shell([-3.0, 0.15, 1.6], [0.4, 0.2, 0.25], bone);
  shell([-2.6, 0.12, 1.6], [0.25, 0.12, 0.15], bone);
  dot([-3.0, 0.2, 1.82], 0.08, palette.outline);
  limb([[-3.35, 0.2, 1.6], [-3.55, 0.45, 1.6]], 0.12, 0.05, bone); // frill
  for (let i = 0; i < 5; i++) limb([[-1.6 + i * 0.22, 0.03, 2.4], [-1.55 + i * 0.22, 0.25, 2.2], [-1.5 + i * 0.22, 0.05, 1.95]], 0.03, 0.025, bone); // ribs
  // nest: a scraped bowl rimmed with sand, holding a ring of elongated eggs
  const nest: Vec3 = [2.3, 0.08, 1.7];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    shell([nest[0] + Math.cos(a) * 0.62, 0.08, nest[2] + Math.sin(a) * 0.46], [0.12, 0.08, 0.1], (_n, _p, b) => (b > 1 ? S1 : S0));
  }
  const egg: ColorFn = (_n, p, b) => (Math.sin(p[0] * 40) * Math.sin(p[1] * 37 + p[2] * 29) > 0.8 ? palette.body[1]! : b > 0 ? EGG : palette.belly[2]!);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    shell([nest[0] + Math.cos(a) * 0.3, 0.2, nest[2] + Math.sin(a) * 0.22], [0.11, 0.17, 0.11], egg);
  }
  return splats;
}

/** Bird-like head jerks, breathing, a blink, ruffled nape, tail counter-balance and a tapping sickle claw. */
export function poseVelociraptor(splats: readonly Splat[], t: number): Splat[] {
  const beat = Math.floor(t * 1.4);
  const glance = Math.sin(beat * 2.7);
  const tilt = Math.sin(beat * 1.9) * 0.1;
  const breathe = Math.sin(t * 3) * 0.025;
  const blink = t % 2.9 < 0.12;
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (!g) return s;
    switch (g.group) {
      case HEAD:
      case EYE: {
        if (g.group === EYE && blink) return { ...s, opacity: 0 };
        const w = g.weight;
        return { ...s, position: [x, y + (tilt + breathe) * w, z + glance * 0.3 * w + (y - 3.35) * tilt * w] };
      }
      case CREST:
        return { ...s, position: [x, y + tilt * 0.6 + breathe + Math.max(0, Math.sin(t * 0.7)) * 0.06, z + glance * 0.18] };
      case BODY:
        return { ...s, position: [x, y + breathe * Math.max(0, (y - 1.8) / 0.8), z * (1 + breathe * 0.6)] };
      case TAIL: {
        const d = Math.max(0, (-1.3 - x) / 3.4);
        return { ...s, position: [x, y + Math.sin(t * 1.2) * 0.07 * d, z - glance * 0.25 * d + Math.sin(t * 1.7) * 0.12 * d] };
      }
      case CLAW: {
        const tap = Math.max(0, Math.sin(t * 5)) ** 4 * 0.07;
        return { ...s, position: [x + tap * 0.4, y + tap, z] };
      }
      case ARM:
        return { ...s, position: [x, y + Math.sin(t * 2.2) * 0.03 * g.weight + breathe, z] };
      default:
        return s;
    }
  });
}
