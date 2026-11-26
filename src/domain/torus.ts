import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, shadeBand, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#10141a"), eyeWhite: hex("#fff8e7"), pupil: hex("#14081c") };

/** body = ring stone, belly = bark, plate = leaves; extras = [glow, glow bright, soil dark, soil light] */
export const TORUS_PALETTES: readonly Palette[] = [
  { name: "emerald", body: ramp("#1c3a4a", "#2c6478", "#4a97a8", "#8accd0"), belly: ramp("#2a1a14", "#4a3020", "#74502e", "#a07a48"), plate: ramp("#1a5a2a", "#2f8a3c", "#58bc4c", "#9ae870"), extras: ramp("#ffb830", "#fff0a0", "#2a2018", "#4a3a28"), ...common },
  { name: "autumn", body: ramp("#3a2a4a", "#5c4478", "#8a6ca8", "#bca4d4"), belly: ramp("#2a1a14", "#4a3020", "#74502e", "#a07a48"), plate: ramp("#8a2a14", "#c4521c", "#ee8a2c", "#ffc860"), extras: ramp("#5ce0ff", "#d4f8ff", "#2a2018", "#4a3a28"), ...common },
  { name: "moonlit", body: ramp("#2a2a4a", "#4a4c80", "#7a80b8", "#b4bce8"), belly: ramp("#1a1a24", "#34344a", "#58587a", "#8888aa"), plate: ramp("#1a4a5a", "#2a7a88", "#4cb4b8", "#9cf0e0"), extras: ramp("#ff9ad0", "#ffe0f0", "#20202c", "#38384c"), ...common },
];

export const TORUS_VIEW = { target: [0, 5, 0] as Vec3, span: 12, pitch: 0.12 };

const CENTER_Y = 5;
const R = 4.5; // ring radius (centreline)
const TUBE = 0.5;
const LEAF = 1;
const ORB = 2;
const ORBS = 10;

export function buildTorus(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 11000);
  const { splats, limb, dot } = createSculptor(rng, 100);
  const [GLOW, GLOW_HI, SOIL0, SOIL1] = palette.extras as [Rgb, Rgb, Rgb, Rgb];

  // the torus: swirling poloidal grooves, rune-like dashes and a light stripe on the inner rim
  const SP = 0.09;
  const nu = Math.ceil((2 * Math.PI * R) / SP);
  const nv = Math.ceil((2 * Math.PI * TUBE) / SP);
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u = ((i + rng.range(0.1, 0.9)) / nu) * Math.PI * 2;
      const v = ((j + rng.range(0.1, 0.9)) / nv) * Math.PI * 2;
      const ring = R + TUBE * Math.cos(v);
      const p: Vec3 = [ring * Math.cos(u), CENTER_Y + ring * Math.sin(u), TUBE * Math.sin(v)];
      const n = normalize([Math.cos(v) * Math.cos(u), Math.cos(v) * Math.sin(u), Math.sin(v)]);
      let band = shadeBand(n);
      const groove = Math.sin(u * 36 + v * 2) > 0.82;
      if (groove) band = clampBand(band - 1);
      const rune = Math.sin(u * 12) > 0.93 && Math.abs(Math.sin(v)) < 0.35;
      const color: Rgb = rune ? GLOW : palette.body[band]!;
      const s = SP * rng.range(0.85, 1.1);
      splats.push({ position: p, scale: [s, s, s], color, opacity: rng.range(0.9, 1) });
    }
  }

  // tree: trunk, roots down into the ring, branches up into it
  const bark: ColorFn = (n, p, b) => palette.belly[clampBand(Math.sin(p[1] * 9 + p[0] * 3) > 0.7 ? b + 1 : b)]!;
  const ringPoint = (deg: number, rr = R - TUBE * 0.6): Vec3 => [rr * Math.cos((deg * Math.PI) / 180), CENTER_Y + rr * Math.sin((deg * Math.PI) / 180), 0];
  const base: Vec3 = [0, 1.9, 0];
  limb([[0, 1.4, 0], [0.1, 2.6, 0.05], [-0.05, 3.8, 0], [0, 4.6, 0]], 0.62, 0.38, bark);
  for (const deg of [235, 255, 285, 305]) {
    const tip = ringPoint(deg);
    limb([[base[0], base[1] + 0.3, base[2]], [tip[0] * 0.45, base[1] - 0.25, (deg % 2 ? 0.25 : -0.25)], tip], 0.34, 0.16, bark);
  }
  const forks: [number, number][] = [[62, 0.34], [80, 0.3], [100, 0.3], [118, 0.34]];
  const leaves: Vec3[] = [];
  for (const [deg, w] of forks) {
    const tip = ringPoint(deg);
    const mid: Vec3 = [tip[0] * 0.55, 4.6 + (tip[1] - 4.6) * 0.45, (deg % 2 ? 0.3 : -0.3)];
    limb([[0, 4.5, 0], mid, tip], 0.34, w * 0.55, bark);
    leaves.push(mid, tip);
  }
  // a few free twigs that stop short of the ring
  for (const [x, y] of [[-2.6, 6.0], [2.5, 6.3], [0.2, 7.9]] as const) {
    limb([[0, 4.8, 0], [x * 0.5, (4.8 + y) / 2 - 0.3, 0.2], [x, y, 0.1]], 0.26, 0.1, bark);
    leaves.push([x, y, 0.1]);
  }

  // leaf clusters
  const leafColor = (i: number): Rgb => palette.plate[clampBand(i)]!;
  for (const c of leaves) {
    for (let k = 0; k < 150; k++) {
      const u = rng.onSphere();
      const rad = rng.range(0.2, 1.15);
      const band = shadeBand(u) + (rng.next() < 0.2 ? 1 : 0);
      const s = rng.range(0.1, 0.17);
      dot([c[0] + u[0] * rad * 1.1, c[1] + u[1] * rad * 0.85, c[2] + u[2] * rad], s, leafColor(band), { opacity: 0.95, rig: { group: LEAF, weight: rng.next() } });
    }
  }

  // roots' mound and soil specks
  for (let k = 0; k < 260; k++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * 1.9;
    const y = 1.3 - rr * 0.18 + rng.range(0, 0.08);
    dot([Math.cos(a) * rr, y, Math.sin(a) * rr * 0.9], 0.15, rng.next() < 0.3 ? SOIL1 : SOIL0, { opacity: 1 });
  }

  // glowing orbs circling the ring (positions are recomputed in pose from the weight)
  for (let i = 0; i < ORBS; i++) {
    const w = i / ORBS;
    for (const [rad, col, op] of [[0.34, GLOW, 0.55], [0.18, GLOW_HI, 1]] as const) {
      const u = w * Math.PI * 2;
      dot([R * Math.cos(u), CENTER_Y + R * Math.sin(u), TUBE + 0.2], rad, col, { opacity: op, rig: { group: ORB, weight: w } });
    }
  }
  return splats;
}

/** Orbs run around the ring, leaves shimmer. */
export function poseTorus(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const g = s.rig;
    if (!g) return s;
    if (g.group === ORB) {
      const u = g.weight * Math.PI * 2 - t * 0.5;
      return { ...s, position: [R * Math.cos(u), CENTER_Y + R * Math.sin(u), TUBE + 0.2 + Math.sin(t * 2 + g.weight * 20) * 0.05] };
    }
    const [x, y, z] = s.position;
    return { ...s, position: [x + Math.sin(t * 1.6 + g.weight * 12) * 0.05, y + Math.cos(t * 1.3 + g.weight * 9) * 0.03, z] };
  });
}
