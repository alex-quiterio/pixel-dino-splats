import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, shadeBand } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import { normalize, type Vec3 } from "@domain/vec3";

const common = { outline: hex("#14101a"), eyeWhite: hex("#fff8e7"), pupil: hex("#14081c") };

/** body = band, belly = centre dashes, plate = edge stripes; extras = [ant, ant highlight] */
export const MOBIUS_PALETTES: readonly Palette[] = [
  { name: "copper", body: ramp("#5a2a1c", "#9a4a2a", "#d27a42", "#f6b274"), belly: ramp("#14303a", "#1f5a68", "#34909c", "#7ad0d4"), plate: ramp("#6a5410", "#a88a1c", "#e0bc2c", "#fff08a"), extras: ramp("#14101a", "#5a4a5c"), ...common },
  { name: "ice", body: ramp("#24407a", "#3c70b8", "#68a4e8", "#aad4ff"), belly: ramp("#3a2a6a", "#5c44a0", "#8c70d0", "#c4acf4"), plate: ramp("#7a2a58", "#b84a88", "#ec74b4", "#ffb4dc"), extras: ramp("#14101a", "#5a4a5c"), ...common },
  { name: "jade", body: ramp("#1a4a3a", "#2a7a5c", "#46b088", "#88e4b8"), belly: ramp("#4a1c2a", "#7a2c44", "#b04a68", "#e48ca4"), plate: ramp("#3a3a5a", "#5a5c8a", "#8a8cc0", "#c0c4f0"), extras: ramp("#14101a", "#5a4a5c"), ...common },
];

export const MOBIUS_VIEW = { target: [0, 0, 0] as Vec3, span: 11, pitch: 0.5 };

const R = 3.6; // radius of the centre circle
const W = 1.35; // half width of the band
const THICK = 0.07;
const ANT = 1;
const SP = 0.085;

/** Surface point and unit normal at angle u around the loop, s across the width (half a twist per loop). */
function surface(u: number, s: number): { p: Vec3; n: Vec3 } {
  const h = u / 2;
  const r = R + s * Math.cos(h);
  const p: Vec3 = [r * Math.cos(u), s * Math.sin(h), r * Math.sin(u)];
  const du: Vec3 = [-r * Math.sin(u) - 0.5 * s * Math.sin(h) * Math.cos(u), 0.5 * s * Math.cos(h), r * Math.cos(u) - 0.5 * s * Math.sin(h) * Math.sin(u)];
  const ds: Vec3 = [Math.cos(h) * Math.cos(u), Math.sin(h), Math.cos(h) * Math.sin(u)];
  return { p, n: normalize([du[1] * ds[2] - du[2] * ds[1], du[2] * ds[0] - du[0] * ds[2], du[0] * ds[1] - du[1] * ds[0]]) };
}

/** Ant parts as (along, across, up, radius), in the band's local frame. */
const ANT_PARTS: readonly (readonly [number, number, number, number])[] = [
  [0.34, 0, 0.14, 0.1], [0.12, 0, 0.14, 0.09], [-0.16, 0, 0.16, 0.14],
  [0.2, 0.17, 0.05, 0.035], [0.2, -0.17, 0.05, 0.035], [0.02, 0.2, 0.05, 0.035], [0.02, -0.2, 0.05, 0.035], [-0.16, 0.2, 0.05, 0.035], [-0.16, -0.2, 0.05, 0.035],
  [0.42, 0.06, 0.24, 0.03], [0.42, -0.06, 0.24, 0.03],
];

export function buildMobius(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 13000);
  const splats: Splat[] = [];
  const nu = Math.ceil((2 * Math.PI * R * 1.2) / SP); // the strip is traversed twice around to close the twist
  const ns = Math.ceil((2 * W) / SP);
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < ns; j++) {
      const u = ((i + rng.range(0.1, 0.9)) / nu) * Math.PI * 2;
      const s = -W + ((j + rng.range(0.1, 0.9)) / ns) * 2 * W;
      const { p, n } = surface(u, s);
      for (const side of [1, -1]) {
        const lit = shadeBand([n[0] * side, n[1] * side, n[2] * side]);
        const edge = Math.abs(s) > W - 0.2;
        const dash = Math.abs(s) < 0.13 && Math.sin(u * 16) > -0.2;
        const ramp: readonly Rgb[] = edge ? palette.plate : dash ? palette.belly : palette.body;
        const sz = SP * rng.range(0.85, 1.1);
        splats.push({
          position: [p[0] + n[0] * side * THICK, p[1] + n[1] * side * THICK, p[2] + n[2] * side * THICK],
          scale: [sz, sz, sz],
          color: ramp[clampBand(lit)]!,
          opacity: rng.range(0.92, 1),
        });
      }
    }
  }
  ANT_PARTS.forEach((_, k) => {
    const [, , , r] = ANT_PARTS[k]!;
    splats.push({ position: [0, 0, 0], scale: [r * 1.5, r * 1.5, r * 1.5], color: palette.extras[k > 8 ? 1 : 0]!, opacity: 1, rig: { group: ANT, weight: k / ANT_PARTS.length } });
  });
  return splats;
}

/** An ant strolls along the centre line, ends up on "the other side" after one lap, and keeps going. */
export function poseMobius(splats: readonly Splat[], t: number): Splat[] {
  const u = t * 0.35;
  const { p, n } = surface(u, 0);
  const T = normalize([-Math.sin(u), 0, Math.cos(u)]);
  const B: Vec3 = [Math.cos(u / 2) * Math.cos(u), Math.sin(u / 2), Math.cos(u / 2) * Math.sin(u)];
  return splats.map((s) => {
    if (s.rig?.group !== ANT) return s;
    const [a, c, up] = ANT_PARTS[Math.round(s.rig.weight * ANT_PARTS.length)]!;
    const wobble = Math.sin(t * 14 + a * 20) * 0.015;
    const o = THICK + up + wobble;
    return { ...s, position: [p[0] + T[0] * a + B[0] * c + n[0] * o, p[1] + T[1] * a + B[1] * c + n[1] * o, p[2] + T[2] * a + B[2] * c + n[2] * o] };
  });
}
