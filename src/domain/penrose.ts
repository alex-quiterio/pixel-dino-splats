import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import type { Splat } from "@domain/splat";
import { viewRotation } from "@domain/gaussianProjection";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#14101a"), eyeWhite: hex("#fff8e7"), pupil: hex("#14081c"), extras: [] as Rgb[] };

/** Three beams, three ramps (body, belly, plate), each dark -> light. */
export const PENROSE_PALETTES: readonly Palette[] = [
  { name: "classic", body: ramp("#7a1f2b", "#b8323f", "#e5565a", "#ff8f84"), belly: ramp("#1f4a7a", "#2f74b8", "#4fa3e5", "#8fd0ff"), plate: ramp("#8a6414", "#c99a1f", "#f0c53a", "#ffe988"), ...common },
  { name: "neon", body: ramp("#5a1a7a", "#8a2fb8", "#b855e5", "#e08fff"), belly: ramp("#0f6a5a", "#1fa88a", "#3fe0b0", "#92ffd8"), plate: ramp("#7a2a4a", "#b84a78", "#ee6fa0", "#ffa8c8"), ...common },
  { name: "ember", body: ramp("#4a2410", "#8a4a1f", "#c8782f", "#f0a85a"), belly: ramp("#3a3a4a", "#5c5c72", "#8888a4", "#bcbcd4"), plate: ramp("#1a4a3a", "#2a7a5a", "#3fb080", "#82e0b4"), ...common },
];

/** The illusion only closes from this exact camera; any other angle reveals the three separate beams. */
export const PENROSE_HOME = { yaw: 0.35, pitch: 0.28 };
export const PENROSE_VIEW = { target: [0, 0.75, 0] as Vec3, span: 10.5, pitch: PENROSE_HOME.pitch };

const L = 6; // centreline length of each beam
const H = 0.42; // half thickness
const SPACING = 0.06;
const BAND_BY_AXIS = [3, 2, 1]; // lit side of each cube axis, by cel band

type Box = { lo: Vec3; hi: Vec3 };
const BOXES: readonly Box[] = [
  { lo: [H, -H, -H], hi: [L + H, H, H] },
  { lo: [L - H, -H, -H], hi: [L + H, L + H, H] },
  { lo: [L - H, L - H, -H], hi: [L + H, L + H, L + H] },
];

const strictlyInside = (p: Vec3, b: Box): boolean => p.every((v, i) => v > b.lo[i]! + 1e-3 && v < b.hi[i]! - 1e-3);

/**
 * Penrose triangle: three square beams along the x, y and z axes of a cube corner. Seen down the (1,1,1)
 * diagonal the last beam lands exactly in front of the first one, so the loop appears to close.
 */
export function buildPenrose(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 9000);

  // Cube axes expressed in camera space (120 degrees apart on screen, all pointing toward the viewer),
  // then carried to world space through the home camera.
  const R = viewRotation(PENROSE_HOME.yaw, PENROSE_HOME.pitch);
  const toWorld = (v: Vec3): Vec3 => [
    v[0] * R[0][0] + v[1] * R[1][0] + v[2] * R[2][0],
    v[0] * R[0][1] + v[1] * R[1][1] + v[2] * R[2][1],
    v[0] * R[0][2] + v[1] * R[1][2] + v[2] * R[2][2],
  ];
  const xy = Math.sqrt(2 / 3);
  const z = 1 / Math.sqrt(3);
  const axes = [0, 120, 240].map((deg) => toWorld([xy * Math.cos((deg * Math.PI) / 180), xy * Math.sin((deg * Math.PI) / 180), z]));
  const place = (p: Vec3): Vec3 => [
    p[0] * axes[0]![0] + p[1] * axes[1]![0] + p[2] * axes[2]![0],
    p[0] * axes[0]![1] + p[1] * axes[1]![1] + p[2] * axes[2]![1],
    p[0] * axes[0]![2] + p[1] * axes[1]![2] + p[2] * axes[2]![2],
  ];
  // centre the triangle on the origin on screen
  const mid = place([(2 * L) / 3, L / 3, 0]);
  const ramps = [palette.body, palette.belly, palette.plate];

  const splats: Splat[] = [];
  BOXES.forEach((box, beam) => {
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      for (const side of [0, 1]) {
        const fixed = side ? box.hi[axis]! : box.lo[axis]!;
        const band = side ? BAND_BY_AXIS[axis]! : 0;
        const nu = Math.ceil((box.hi[u]! - box.lo[u]!) / SPACING);
        const nv = Math.ceil((box.hi[v]! - box.lo[v]!) / SPACING);
        for (let i = 0; i < nu; i++) {
          for (let j = 0; j < nv; j++) {
            const p: Vec3 = [0, 0, 0];
            const q = p as [number, number, number];
            q[axis] = fixed;
            q[u] = box.lo[u]! + ((i + rng.range(0.1, 0.9)) / nu) * (box.hi[u]! - box.lo[u]!);
            q[v] = box.lo[v]! + ((j + rng.range(0.1, 0.9)) / nv) * (box.hi[v]! - box.lo[v]!);
            if (BOXES.some((o, k) => k !== beam && strictlyInside(p, o))) continue;
            const w = place(p);
            const s = SPACING * rng.range(0.8, 1.05);
            splats.push({
              position: [w[0] - mid[0], w[1] - mid[1], w[2] - mid[2]],
              scale: [s, s, s],
              color: ramps[beam]![band]!,
              opacity: rng.range(0.9, 1),
            });
          }
        }
      }
    }
  });
  return splats;
}

/** A gentle hover; the figure itself is rigid. */
export function posePenrose(splats: readonly Splat[], t: number): Splat[] {
  const dy = Math.sin(t * 1.3) * 0.1;
  return splats.map((s) => ({ ...s, position: [s.position[0], s.position[1] + dy, s.position[2]] }));
}
