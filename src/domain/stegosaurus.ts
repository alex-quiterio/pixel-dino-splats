import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#14101a"), eyeWhite: hex("#fff8e7"), pupil: hex("#14081c") };

/** extras = [ground dark, ground light, fern green] */
export const STEGO_PALETTES: readonly Palette[] = [
  { name: "fern", body: ramp("#3a4f2a", "#587a3c", "#82a652", "#b4d27c"), belly: ramp("#8a7a4a", "#b0a064", "#d2c488", "#f0e4ac"), plate: ramp("#8a2a1c", "#c4482a", "#ee7a36", "#ffb868"), extras: ramp("#3a2a1c", "#5c4430", "#3e8a3a"), ...common },
  { name: "dusk", body: ramp("#3a2a5c", "#5a4496", "#8a70c8", "#bca4f0"), belly: ramp("#8a6a7a", "#b48a98", "#d8b0b4", "#f6d4cc"), plate: ramp("#1c6a6a", "#2a9a98", "#52cfc0", "#a4f4e0"), extras: ramp("#24203a", "#3c3660", "#5a9a8a"), ...common },
  { name: "sand", body: ramp("#7a5a30", "#a8844a", "#d0aa68", "#f0d08e"), belly: ramp("#a8946a", "#cdb88a", "#e8d6a8", "#fff0c8"), plate: ramp("#2a3a6a", "#3f5ca8", "#5f88e0", "#a0c4ff"), extras: ramp("#6a4a2a", "#9a7442", "#6a9a3a"), ...common },
];

export const STEGO_VIEW = { target: [0, 2.6, 0] as Vec3, span: 11, pitch: 0.2 };

const PLATE = 1;
const TAIL = 2;
const HEAD = 3;
const PLATES = 8;

export function buildStegosaurus(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 5000);
  const { splats, shell, limb, dot } = createSculptor(rng, 100);
  const [G0, G1, FERN] = palette.extras as [Rgb, Rgb, Rgb];

  const skin: ColorFn = (n, p, b) => {
    const bump = Math.sin(p[0] * 11) * Math.sin(p[2] * 11 + p[1] * 3);
    const bb = bump > 0.7 ? clampBand(b + 1) : b;
    return n[1] < -0.4 ? palette.belly[bb]! : palette.body[bb]!;
  };
  const plateColor: ColorFn = (n, p, b) => {
    const vein = Math.sin(p[1] * 14 + p[0] * 2) > 0.8;
    return palette.plate[clampBand(vein ? b + 1 : n[1] > 0.7 ? b + 1 : b)]!;
  };
  const spike: ColorFn = (_n, _p, b) => palette.belly[clampBand(b + 1)]!;
  const claw: ColorFn = () => palette.outline;

  // arched, heavy body: high hips, low shoulders
  shell([-0.6, 2.45, 0], [1.5, 1.05, 0.85], skin);
  shell([-1.8, 2.75, 0], [0.9, 1.0, 0.75], skin); // hips
  shell([0.9, 2.0, 0], [0.9, 0.8, 0.7], skin); // shoulders
  // neck and small head, kept low
  limb([[1.4, 2.1, 0], [1.9, 1.85, 0], [2.4, 1.5, 0]], 0.5, 0.3, skin, HEAD);
  shell([2.85, 1.3, 0], [0.5, 0.28, 0.28], skin, { group: HEAD, weight: 1 });
  shell([3.25, 1.2, 0], [0.22, 0.17, 0.17], skin, { group: HEAD, weight: 1 }); // beak
  dot([2.85, 1.45, 0.24], 0.07, palette.eyeWhite, { rig: { group: HEAD, weight: 1 } });
  dot([2.88, 1.45, 0.28], 0.04, palette.pupil, { rig: { group: HEAD, weight: 1 } });
  dot([2.85, 1.45, -0.24], 0.07, palette.eyeWhite, { rig: { group: HEAD, weight: 1 } });
  dot([2.88, 1.45, -0.28], 0.04, palette.pupil, { rig: { group: HEAD, weight: 1 } });

  // tail with thagomizer: four spikes on the tip
  const tail: Vec3[] = [[-2.5, 2.8, 0], [-3.6, 2.5, 0], [-4.6, 2.0, 0], [-5.5, 1.7, 0]];
  limb(tail, 0.5, 0.12, skin, TAIL);
  for (const side of [-1, 1]) {
    limb([[-4.6, 2.0, side * 0.1], [-4.9, 2.5, side * 0.5], [-5.0, 3.0, side * 0.8]], 0.1, 0.02, spike, TAIL);
    limb([[-5.2, 1.8, side * 0.1], [-5.6, 2.2, side * 0.55], [-5.8, 2.7, side * 0.9]], 0.09, 0.02, spike, TAIL);
  }

  // legs: short front, tall hind
  for (const side of [-1, 1]) {
    limb([[0.9, 1.6, side * 0.65], [1.0, 0.9, side * 0.65], [1.05, 0.2, side * 0.65]], 0.4, 0.28, skin);
    shell([1.15, 0.12, side * 0.65], [0.4, 0.14, 0.34], skin);
    limb([[-1.8, 2.2, side * 0.7], [-1.55, 1.2, side * 0.7], [-1.7, 0.25, side * 0.7]], 0.5, 0.3, skin);
    shell([-1.55, 0.12, side * 0.7], [0.45, 0.15, 0.36], skin);
    for (const x of [1.45, -1.1]) for (const nz of [-0.15, 0.15]) shell([x, 0.12, side * 0.65 + nz], [0.07, 0.07, 0.06], claw);
  }

  // back plates: two staggered rows, tallest over the hips
  for (let i = 0; i < PLATES; i++) {
    const f = i / (PLATES - 1);
    const x = 1.3 - f * 3.4;
    const h = 0.65 + 0.8 * Math.sin(Math.PI * Math.min(1, f * 0.9 + 0.12));
    const base = 2.0 + 0.95 * Math.sin(Math.PI * Math.min(1, f * 0.8 + 0.2)) + (i > 3 ? 0.0 : 0);
    const z = (i % 2 === 0 ? 1 : -1) * 0.2;
    shell([x, base + h * 0.7, z], [0.16 + h * 0.12, h * 1.05, 0.06], plateColor, { group: PLATE, weight: f });
  }

  // ground with ferns
  for (let i = 0; i < 760; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    dot([Math.cos(a) * rr * 5.4, 0.02, Math.sin(a) * rr * 3.6], 0.22, rng.next() < 0.25 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.6, 0.95);
    const bx = Math.cos(a) * r * 4.8;
    const bz = Math.sin(a) * r * 3.3;
    if (Math.abs(bx + 0.5) < 2.8 && Math.abs(bz) < 1.2) continue; // keep clear of the dino
    for (let k = -2; k <= 2; k++) {
      limb([[bx, 0, bz], [bx + k * 0.22, 0.5 - Math.abs(k) * 0.08, bz + k * 0.08], [bx + k * 0.42, 0.55 - Math.abs(k) * 0.16, bz + k * 0.14]], 0.05, 0.015, (_n, _p, b) => (b > 1 ? FERN : G1));
    }
  }
  return splats;
}

/** Head dips to graze, tail swings, plates shimmer. */
export function poseStegosaurus(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (g?.group === HEAD) {
      const d = Math.max(0, Math.sin(t * 1.1)) * 0.25 * (x > 1.4 ? (x - 1.4) / 1.8 : 0);
      return { ...s, position: [x, y - d, z] };
    }
    if (g?.group === TAIL) return { ...s, position: [x, y, z + Math.sin(t * 1.5) * 0.45 * Math.max(0, (-2.5 - x) / 3)] };
    if (g?.group === PLATE) return { ...s, position: [x, y + Math.sin(t * 2 + g.weight * 6) * 0.03, z] };
    return s;
  });
}
