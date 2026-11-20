import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#14101a"), eyeWhite: hex("#fff6e0"), pupil: hex("#120a0c") };
const ivory = ramp("#a89a7a", "#cfc4a2", "#ece3c6", "#fffaea");

/** extras = [savanna dark, savanna light, dust] */
const ground = (a: string, b: string, c: string) => ramp(a, b, c);

export const ELEPHANT_PALETTES: readonly Palette[] = [
  { name: "savanna", body: ramp("#4c423e", "#75685f", "#9d8e82", "#c8b9aa"), belly: ramp("#5a4a44", "#82706a", "#a89488", "#d0bfb0"), plate: ivory, extras: ground("#6b4f2a", "#a47a3c", "#e8c888"), ...common },
  { name: "rose", body: ramp("#7a4a5a", "#b0707e", "#d99aa0", "#f6c8c8"), belly: ramp("#8a5a62", "#c08a8a", "#e4b0a8", "#fbd8cc"), plate: ivory, extras: ground("#5a3a4a", "#8a5a6a", "#f0c8d0"), ...common },
  { name: "twilight", body: ramp("#2c3566", "#46549a", "#6f82d0", "#a8baf4"), belly: ramp("#3a3c70", "#5c5c9c", "#8a88c8", "#bcb8ee"), plate: ivory, extras: ground("#1a1f3e", "#2c3466", "#8ae0e0"), ...common },
];

export const ELEPHANT_VIEW = { target: [0, 2.9, 0] as Vec3, span: 9.2, pitch: 0.2 };

const TRUNK = 1;
const EAR = 2;
const TAIL = 3;
const DUST = 4;
const DUST_COUNT = 40;

export function buildElephant(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 4000);
  const { splats, shell, limb, dot } = createSculptor(rng, 140);
  const [G0, G1, DUSTC] = palette.extras as [Rgb, Rgb, Rgb];

  const skin: ColorFn = (n, p, b) => {
    const crease = Math.sin(p[1] * 9 + Math.sin(p[0] * 3) * 1.5) + Math.sin(p[0] * 7 + p[2] * 5) * 0.5;
    const cross = Math.sin(p[0] * 15 - p[1] * 11 + p[2] * 4);
    let bb = crease > 1.1 || cross > 0.93 ? clampBand(b - 1) : b;
    if (n[1] > 0.55 && cross < -0.6) bb = clampBand(bb + 1); // sun-dried dust on the back
    if (p[1] < 0.9 && p[1] > 0.1) return palette.belly[clampBand(bb - 1 + (cross > 0.3 ? 1 : 0))]!; // mud-caked ankles
    return n[1] < -0.45 ? palette.belly[bb]! : palette.body[bb]!;
  };
  const fold: ColorFn = (_n, _p, b) => palette.body[clampBand(b - 1)]!;
  const dark: ColorFn = () => palette.outline;
  const tusk: ColorFn = (_n, _p, b) => palette.plate[b]!;
  const nail: ColorFn = (_n, _p, b) => palette.plate[clampBand(b - 1)]!;

  // massive body: highest at the shoulders, a dipped back, sloping rump
  shell([0.6, 3.3, 0], [1.15, 1.2, 0.95], skin); // shoulders
  shell([-0.9, 2.85, 0], [1.3, 1.1, 0.92], skin); // dipped barrel
  shell([-2.0, 2.75, 0], [0.8, 0.85, 0.74], skin); // rump
  shell([1.75, 3.5, 0], [0.85, 1.0, 0.75], skin); // head
  for (const side of [-1, 1]) shell([1.95, 4.15, side * 0.24], [0.45, 0.5, 0.34], skin); // twin forehead domes
  shell([-2.7, 2.7, 0], [0.12, 0.12, 0.1], skin); // tail root
  limb([[-2.75, 2.7, 0], [-2.95, 2.0, 0], [-2.93, 1.2, 0]], 0.08, 0.05, skin, TAIL);
  shell([-2.93, 1.0, 0], [0.12, 0.3, 0.12], (_n, _p, bd) => palette.body[clampBand(bd - 2)]!, { group: TAIL, weight: 1 }); // tail tuft

  // heavy skin folds at the neck, shoulder and thigh
  for (const side of [-1, 1]) {
    shell([1.3, 2.7, side * 0.78], [0.5, 0.1, 0.2], fold); // neck fold
    shell([0.4, 2.75, side * 0.9], [0.6, 0.08, 0.16], fold); // shoulder crease
    shell([-1.5, 2.3, side * 0.88], [0.55, 0.09, 0.16], fold); // thigh crease
    shell([-0.5, 2.0, side * 0.9], [0.7, 0.07, 0.14], fold); // belly crease
  }
  // sparse bristles along the spine and forehead
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-2.3, 2.1);
    const y = x > 1.2 ? 4.6 + (x - 1.2) * -0.5 : 3.95 - Math.abs(x - 0.6) * 0.15 - (x < -1.4 ? (-1.4 - x) * 0.5 : 0);
    dot([x, y + rng.range(0, 0.12), rng.range(-0.2, 0.2)], 0.025, palette.body[0]!);
  }

  // trunk: thick root tapering to a curled tip, swings as one rig
  const trunk: Vec3[] = [[2.2, 3.5, 0], [2.65, 2.7, 0], [2.8, 1.8, 0], [2.95, 0.95, 0], [3.35, 0.55, 0], [3.7, 0.85, 0]];
  const ringed: ColorFn = (n, p, bd) => (Math.sin(p[1] * 24 + p[0] * 5) > 0.35 ? palette.body[clampBand(bd - 1)]! : n[0] > 0.4 ? palette.belly[clampBand(bd)]! : palette.body[clampBand(bd)]!);
  limb(trunk, 0.48, 0.15, ringed, TRUNK);
  dot([3.88, 1.05, 0.0], 0.07, palette.outline, { rig: { group: TRUNK, weight: 1 } }); // nostril
  limb([[3.62, 0.9, 0.06], [3.95, 1.2, 0.08]], 0.09, 0.04, skin, TRUNK); // two-fingered tip
  limb([[3.62, 0.9, -0.06], [3.82, 1.25, -0.08]], 0.08, 0.04, skin, TRUNK);

  for (const side of [-1, 1]) {
    // legs: pillars with toenails
    for (const [x, z] of [[1.0, 0.55], [-1.6, 0.55]] as const) {
      limb([[x, 2.4, z * side], [x + 0.03, 1.3, z * side], [x, 0.25, z * side]], 0.46, 0.4, skin);
      shell([x + 0.08, 0.15, z * side], [0.5, 0.18, 0.46], skin);
      const toes = x > 0 ? [-0.3, -0.1, 0.1, 0.3] : [-0.2, 0, 0.2];
      for (const nz of toes) shell([x + 0.52, 0.14, z * side + nz], [0.09, 0.1, 0.08], nail);
      shell([x + 0.05, 1.3, z * side], [0.5, 0.06, 0.48], fold); // knee crease
      shell([x + 0.04, 0.55, z * side], [0.44, 0.05, 0.42], fold); // ankle fold
      shell([x + 0.04, 1.8, z * side], [0.5, 0.05, 0.48], fold);
    }
    // ears: big flaps, pink-ish inside
    const ear = (c: Vec3, r: Vec3, col: ColorFn, w: number) => shell(c, r, col, { group: EAR, weight: w });
    const earColor: ColorFn = (n, p, bd) => {
      if (Math.abs(n[2]) < 0.35) return palette.body[clampBand(bd - 1)]!; // darker rim
      return n[2] * side > 0 ? palette.belly[clampBand(bd + 1)]! : skin(n, p, bd);
    };
    ear([0.85, 4.05, side * 1.02], [1.15, 1.4, 0.09], earColor, 0.5); // fan lying against the shoulder
    ear([0.55, 2.95, side * 1.0], [0.75, 0.8, 0.08], earColor, 0.8); // lower lobe, Africa-shaped
    // ear veins fanning out from the base, and torn nicks on the rim
    for (const ty of [5.2, 4.2, 3.0]) limb([[1.7, 4.0, side * 1.1], [0.9, (4.0 + ty) / 2, side * 1.1], [-0.05, ty, side * 1.12]], 0.03, 0.012, fold, EAR);
    for (const [nx, ny] of [[-0.25, 4.3], [0.2, 5.3], [-0.1, 3.0], [0.4, 2.3]] as const) dot([nx, ny, side * 1.02], 0.07, palette.body[0]!, { rig: { group: EAR, weight: 0.8 } });
    // tusks
    limb([[2.15, 3.05, side * 0.36], [2.75, 2.35, side * 0.55], [3.4, 2.2, side * 0.62], [3.95, 2.7, side * 0.5]], 0.18, 0.04, tusk);
    shell([2.2, 3.0, side * 0.36], [0.22, 0.2, 0.2], skin); // lip over the tusk base
    dot([3.95, 2.7, side * 0.5], 0.05, palette.plate[0]!); // worn tip
    // eyes
    shell([2.05, 3.9, side * 0.68], [0.16, 0.11, 0.08], fold); // heavy eyelid
    dot([2.1, 3.85, side * 0.74], 0.085, palette.eyeWhite);
    dot([2.14, 3.85, side * 0.78], 0.05, palette.pupil);
    for (let l = -1; l <= 1; l++) limb([[2.1 + l * 0.06, 3.95, side * 0.74], [2.14 + l * 0.06, 4.05, side * 0.78]], 0.012, 0.006, fold); // lashes
    limb([[1.9, 3.8, side * 0.73], [1.85, 3.5, side * 0.75]], 0.035, 0.02, fold); // temporal gland streak
    shell([2.0, 4.02, side * 0.62], [0.2, 0.06, 0.12], fold); // brow
  }

  for (let i = 0; i < 6; i++) limb([[-2.93, 1.05, 0], [-2.93 + (i - 2.5) * 0.05, 0.6, (i - 2.5) * 0.04]], 0.02, 0.008, dark, TAIL);

  // dusty ground patch with grass tufts
  for (let i = 0; i < 700; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    dot([Math.cos(a) * rr * 5, 0.02, Math.sin(a) * rr * 3.6], 0.22, rng.next() < 0.25 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.55, 0.95);
    const bx = Math.cos(a) * r * 4.6;
    const bz = Math.sin(a) * r * 3.3;
    for (let k = -1; k <= 1; k++) limb([[bx + k * 0.06, 0, bz], [bx + k * 0.14, 0.3, bz + k * 0.05]], 0.03, 0.012, (_n, _p, b) => G1 ?? palette.body[b]!);
  }
  // footprints and a few rocks
  for (const [fx, fz] of [[2.5, 1.6], [0.2, 1.9], [-2.3, 1.7], [3.0, -1.7], [-0.9, -2.1]] as const) shell([fx, 0.02, fz], [0.38, 0.03, 0.3], (_n, _p, b) => (b > 1 ? G0 : palette.outline));
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.7, 0.95);
    shell([Math.cos(a) * r * 4.6, 0.12, Math.sin(a) * r * 3.2], [rng.range(0.15, 0.3), 0.14, rng.range(0.12, 0.25)], (_n, _p, b) => palette.belly[clampBand(b)]!);
  }
  // dust motes puffing up
  for (let i = 0; i < DUST_COUNT; i++) {
    dot([rng.range(1.5, 4.2), rng.range(0.1, 1.5), rng.range(-1.2, 1.2)], 0.05, DUSTC, { opacity: 0.8, rig: { group: DUST, weight: rng.next() } });
  }
  return splats;
}

/** Trunk sways, ears flap, tail swishes, dust drifts. */
export function poseElephant(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (g?.group === DUST) {
      const ny = 0.1 + ((((y - 0.1 + t * 0.25 * (0.5 + g.weight)) % 1.4) + 1.4) % 1.4);
      return { ...s, position: [x + Math.sin(t * 1.2 + g.weight * 6) * 0.1, ny, z] };
    }
    if (g?.group === TRUNK) {
      const w = g.weight * g.weight;
      return { ...s, position: [x + Math.sin(t * 1.6) * 0.35 * w, y + Math.sin(t * 1.6 + 1) * 0.12 * w, z + Math.sin(t * 0.8) * 0.3 * w] };
    }
    if (g?.group === EAR) {
      const flap = Math.sin(t * 2.4) * 0.32;
      const lift = Math.max(0, Math.min(1.2, (1.85 - x) / 1.8));
      return { ...s, position: [x, y, z + Math.sign(z) * flap * lift] };
    }
    if (g?.group === TAIL) return { ...s, position: [x, y, z + Math.sin(t * 2.2) * 0.25 * g.weight] };
    return s;
  });
}
