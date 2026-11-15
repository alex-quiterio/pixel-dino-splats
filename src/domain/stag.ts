import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#0b0a12"), eyeWhite: hex("#fffdf0"), pupil: hex("#150c10") };
const bark = {
  body: ramp("#6f5640", "#a08462", "#cdb28a", "#ecd9b4"),
  belly: ramp("#4a382c", "#6e543e", "#957856", "#bb9d76"),
};

/** extras = [ground dark, ground light, glow, glow bright] */
export const STAG_PALETTES: readonly Palette[] = [
  { name: "ember", ...bark, plate: ramp("#8a2e18", "#c4501f", "#ee8a3a", "#ffc070"), extras: ramp("#1a0f22", "#2e1a38", "#2fa6a0", "#a4f6e8"), ...common },
  { name: "frost", ...bark, plate: ramp("#1f3f8a", "#2f6ac4", "#5aa0ee", "#b0dcff"), extras: ramp("#0f1a2a", "#1c2c44", "#b84ad0", "#f7b8ff"), ...common },
  { name: "toxic", ...bark, plate: ramp("#6a1f6a", "#a22fa0", "#d85ad0", "#f7a8f0"), extras: ramp("#0e1f1a", "#1a3a2e", "#a8c82a", "#f4ffa0"), ...common },
];

export const STAG_VIEW = { target: [0, 2.9, 0] as Vec3, span: 9.8, pitch: 0.42 };

const SPORE = 200;
const ORB = 300;
const ANTLER = 10;
const SPORE_COUNT = 50;
const SPORE_BASE = 2.2;
const SPORE_RANGE = 4.8;

export function buildStag(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 2000);
  const { splats, shell, limb, dot } = createSculptor(rng, 100);
  const [G0, G1, GLOW, GLOW2] = palette.extras as [Rgb, Rgb, Rgb, Rgb];

  // birch-like bark with swirling grain
  const barkColor: ColorFn = (n, p, b) => {
    const grain = Math.sin(p[0] * 8 + Math.sin(p[1] * 3.5 + p[2] * 2) * 2.2);
    const bb = grain > 0.55 ? clampBand(b - 1) : grain < -0.8 ? clampBand(b + 1) : b;
    return n[1] < -0.35 ? palette.belly[bb]! : palette.body[bb]!;
  };
  const antlerColor: ColorFn = (_n, _p, b) => palette.body[clampBand(b + 1)]!;
  const hoof: ColorFn = () => palette.outline;
  const stem: ColorFn = (_n, _p, b) => palette.body[clampBand(b + 1)]!;
  const cap: ColorFn = (n, _p, b) => {
    if (n[1] < -0.3) return palette.plate[0]!;
    return rng.next() < 0.08 ? palette.plate[3]! : palette.plate[b]!;
  };

  const mushroom = (base: Vec3, capR: number, stemH: number, tilt = 0, rig?: Splat["rig"]) => {
    shell([base[0], base[1] + stemH / 2, base[2]], [capR * 0.2, stemH / 2, capR * 0.2], stem, rig);
    shell([base[0] + tilt, base[1] + stemH + capR * 0.1, base[2]], [capR, capR * 0.5, capR], cap, rig);
  };

  // body
  shell([-1.0, 2.65, 0], [0.7, 0.55, 0.44], barkColor);
  shell([-0.2, 2.5, 0], [0.95, 0.5, 0.42], barkColor);
  shell([0.7, 2.62, 0], [0.75, 0.55, 0.42], barkColor);
  shell([-1.75, 2.9, 0], [0.16, 0.14, 0.1], barkColor); // tail
  // neck + head
  shell([1.15, 3.1, 0], [0.3, 0.5, 0.28], barkColor);
  shell([1.4, 3.55, 0], [0.26, 0.45, 0.25], barkColor);
  shell([1.65, 4.0, 0], [0.23, 0.4, 0.22], barkColor);
  shell([1.97, 4.3, 0], [0.38, 0.25, 0.2], barkColor);
  shell([2.4, 4.18, 0], [0.36, 0.14, 0.13], barkColor);
  for (const side of [-1, 1]) {
    shell([1.78, 4.62, side * 0.24], [0.1, 0.22, 0.05], barkColor); // ears
    // legs: front straight, hind slightly bent
    limb([[0.8, 2.3, side * 0.3], [0.85, 1.2, side * 0.3], [0.85, 0.2, side * 0.3]], 0.15, 0.08, barkColor);
    shell([0.9, 0.08, side * 0.3], [0.15, 0.09, 0.11], hoof);
    limb([[-1.15, 2.3, side * 0.3], [-0.85, 1.4, side * 0.3], [-1.05, 0.2, side * 0.3]], 0.18, 0.08, barkColor);
    shell([-1.0, 0.08, side * 0.3], [0.15, 0.09, 0.11], hoof);
    // antlers: main beam + two branches, each tipped with a mushroom
    const s = side;
    const beam: Vec3[] = [[1.85, 4.5, 0.1 * s], [1.72, 5.1, 0.22 * s], [1.55, 5.7, 0.3 * s], [1.4, 6.3, 0.34 * s]];
    limb(beam, 0.09, 0.055, antlerColor, ANTLER);
    limb([beam[1]!, [2.1, 5.55, 0.42 * s]], 0.06, 0.04, antlerColor, ANTLER);
    limb([beam[2]!, [1.05, 6.0, 0.5 * s]], 0.06, 0.04, antlerColor, ANTLER);
    mushroom([1.4, 6.3, 0.34 * s], 0.24, 0.04, 0, { group: ANTLER, weight: 1 });
    mushroom([2.1, 5.55, 0.42 * s], 0.18, 0.04, 0, { group: ANTLER, weight: 0.8 });
    mushroom([1.05, 6.0, 0.5 * s], 0.18, 0.04, 0, { group: ANTLER, weight: 0.8 });
    // glowing eye orb with halo
    dot([2.05, 4.36, side * 0.2], 0.08, palette.eyeWhite);
    dot([2.05, 4.36, side * 0.22], 0.24, palette.eyeWhite, { opacity: 0.3 });
  }
  dot([2.74, 4.2, 0], 0.05, palette.pupil); // nose

  // mushrooms riding the back and flanks
  mushroom([-0.9, 3.05, 0.08], 0.36, 0.2, 0.05);
  mushroom([-0.35, 2.95, -0.14], 0.46, 0.25, -0.05);
  mushroom([0.2, 3.0, 0.1], 0.4, 0.22);
  mushroom([0.65, 3.08, -0.08], 0.3, 0.18);
  mushroom([-0.6, 3.1, -0.22], 0.28, 0.26);
  for (const [x, y, side] of [[-0.5, 2.7, 1], [0.1, 2.65, -1], [-1.1, 2.85, -1]] as const) {
    shell([x, y, side * 0.45], [0.2, 0.07, 0.16], cap); // bracket fungi on the flanks
  }

  // forest floor: a dark purple blob, ringed by mushrooms
  for (let i = 0; i < 760; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = Math.cos(a) * rr * 4.5;
    const z = Math.sin(a) * rr * 3.5;
    dot([x, 0.02, z], 0.22, rng.next() < 0.22 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  const ring: Vec3[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const r = rng.range(0.78, 0.93);
    ring.push([Math.cos(a) * r * 4.1, 0, Math.sin(a) * r * 3.1]);
  }
  for (const b of ring) mushroom(b, rng.range(0.2, 0.34), rng.range(0.4, 0.68), rng.range(-0.05, 0.05));
  // pale twigs
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    const base: Vec3 = [Math.cos(a) * rng.range(2, 3.4), 0, Math.sin(a) * rng.range(1.5, 2.6)];
    limb([base, [base[0] + 0.1, 0.35, base[2]], [base[0] + 0.28, 0.65, base[2] + 0.05]], 0.04, 0.02, stem);
    limb([[base[0] + 0.1, 0.35, base[2]], [base[0] - 0.15, 0.6, base[2] - 0.08]], 0.03, 0.015, stem);
  }
  // glowing orbs
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.35, 0.8);
    const x = Math.cos(a) * r * 3.6;
    const z = Math.sin(a) * r * 2.8;
    const rig = { group: ORB, weight: rng.next() };
    dot([x, 0.14, z], 0.17, GLOW2, { rig });
    dot([x, 0.05, z], 0.5, GLOW, { opacity: 0.45, tall: 0.2, rig });
  }
  // spores drifting up from the antlers
  for (let i = 0; i < SPORE_COUNT; i++) {
    dot([rng.range(-2, 2.6), rng.range(SPORE_BASE, SPORE_BASE + SPORE_RANGE), rng.range(-1.6, 1.6)], 0.032, rng.next() < 0.7 ? palette.plate[2]! : palette.plate[3]!, {
      rig: { group: SPORE, weight: rng.next() },
    });
  }
  return splats;
}

/** Spores drift upward, orbs pulse, antlers sway, head bobs. */
export function poseStag(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (g?.group === SPORE) {
      const ny = SPORE_BASE + ((((y - SPORE_BASE + t * 0.5 * (0.5 + g.weight)) % SPORE_RANGE) + SPORE_RANGE) % SPORE_RANGE);
      return { ...s, position: [x + Math.sin(t * 1.3 + g.weight * 6) * 0.15, ny, z] };
    }
    if (g?.group === ORB) {
      const k = 1 + 0.3 * Math.sin(t * 2.2 + g.weight * 6.28);
      return { ...s, scale: [s.scale[0] * k, s.scale[1] * k, s.scale[2] * k] };
    }
    let dx = 0;
    let dy = 0;
    if (x > 1.0 && y > 3.2) dy += Math.sin(t * 1.5) * 0.05 * Math.min(1.5, y - 3.2); // head bob
    if (g?.group === ANTLER) dx += Math.sin(t * 1.1 + g.weight * 2) * 0.07 * g.weight;
    if (dx === 0 && dy === 0) return s;
    return { ...s, position: [x + dx, y + dy, z] };
  });
}
