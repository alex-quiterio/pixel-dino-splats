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
  { name: "savanna", body: ramp("#4e4a58", "#76727f", "#9d98a6", "#c6c1cc"), belly: ramp("#5e5260", "#85777f", "#ab9a9c", "#d2c0bc"), plate: ivory, extras: ground("#6b4f2a", "#a47a3c", "#e8c888"), ...common },
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
  const { splats, shell, limb, dot } = createSculptor(rng, 100);
  const [G0, G1, DUSTC] = palette.extras as [Rgb, Rgb, Rgb];

  const skin: ColorFn = (n, p, b) => {
    const wrinkle = Math.sin(p[1] * 9 + Math.sin(p[0] * 3) * 1.5) + Math.sin(p[0] * 7 + p[2] * 5) * 0.5;
    const bb = wrinkle > 1.1 ? clampBand(b - 1) : b;
    return n[1] < -0.45 ? palette.belly[bb]! : palette.body[bb]!;
  };
  const earInner: ColorFn = (_n, _p, b) => palette.belly[clampBand(b + 1)]!;
  const tusk: ColorFn = (_n, _p, b) => palette.plate[b]!;
  const nail: ColorFn = (_n, _p, b) => palette.plate[clampBand(b - 1)]!;

  // massive body, domed head
  shell([-0.9, 3.0, 0], [1.35, 1.2, 0.95], skin);
  shell([0.5, 3.15, 0], [1.1, 1.1, 0.9], skin);
  shell([-2.0, 2.9, 0], [0.7, 0.85, 0.72], skin); // rump
  shell([1.65, 3.55, 0], [0.8, 0.95, 0.72], skin); // head
  shell([1.9, 4.2, 0], [0.55, 0.5, 0.5], skin); // forehead dome
  shell([-2.6, 2.7, 0], [0.12, 0.12, 0.1], skin); // tail root
  limb([[-2.65, 2.7, 0], [-2.8, 2.1, 0], [-2.78, 1.5, 0]], 0.07, 0.04, skin, TAIL);
  shell([-2.78, 1.4, 0], [0.1, 0.18, 0.1], (_n, _p, b) => palette.outline ?? palette.body[b]!, { group: TAIL, weight: 1 });

  // trunk: thick root tapering to a curled tip, swings as one rig
  const trunk: Vec3[] = [[2.2, 3.5, 0], [2.65, 2.7, 0], [2.8, 1.8, 0], [2.95, 0.95, 0], [3.35, 0.55, 0], [3.7, 0.85, 0]];
  limb(trunk, 0.4, 0.13, skin, TRUNK);

  for (const side of [-1, 1]) {
    // legs: pillars with toenails
    for (const [x, z] of [[1.0, 0.55], [-1.6, 0.55]] as const) {
      limb([[x, 2.4, z * side], [x + 0.03, 1.3, z * side], [x, 0.25, z * side]], 0.46, 0.4, skin);
      shell([x + 0.08, 0.15, z * side], [0.5, 0.18, 0.46], skin);
      for (const nz of [-0.22, 0, 0.22]) shell([x + 0.5, 0.15, z * side + nz], [0.08, 0.09, 0.07], nail);
    }
    // ears: big flaps, pink-ish inside
    const ear = (c: Vec3, r: Vec3, col: ColorFn, w: number) => shell(c, r, col, { group: EAR, weight: w });
    ear([0.95, 3.9, side * 0.98], [0.08, 0.85, 0.72], skin, 0.5);
    ear([0.95, 3.9, side * 1.05], [0.05, 0.7, 0.6], earInner, 0.9);
    // tusks
    limb([[2.1, 3.0, side * 0.34], [2.65, 2.55, side * 0.42], [3.15, 2.5, side * 0.38], [3.5, 2.85, side * 0.3]], 0.14, 0.04, tusk);
    // eyes
    dot([2.05, 3.85, side * 0.62], 0.1, palette.eyeWhite);
    dot([2.1, 3.85, side * 0.66], 0.055, palette.pupil);
  }

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
      const flap = Math.sin(t * 2.4) * 0.22;
      return { ...s, position: [x, y, z + Math.sign(z) * flap * (0.6 + g.weight * 0.4)] };
    }
    if (g?.group === TAIL) return { ...s, position: [x, y, z + Math.sin(t * 2.2) * 0.25 * g.weight] };
    return s;
  });
}
