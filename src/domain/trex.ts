import { createRng, type Rng } from "@domain/rng";
import type { Palette, Rgb } from "@domain/palette";
import type { Splat } from "@domain/splat";
import { dot, normalize, type Vec3 } from "@domain/vec3";

type Role = "skin" | "plate" | "jaw" | "brow";
interface Part {
  readonly center: Vec3;
  readonly radii: Vec3;
  readonly role: Role;
}

const LIGHT = normalize([0.5, 0.8, 0.45]);
const DENSITY = 115; // splats per unit of surface area

/** Mouth line height: the pose animation opens the jaw by dropping everything below it. */
export const MOUTH_Y = 3.22;
export const MOUTH_X = 2.45;

const P = (center: Vec3, radii: Vec3, role: Role = "skin"): Part => ({ center, radii, role });

/**
 * T. rex faces +x, stands on y=0: huge skull, S-curved neck, barrel torso,
 * thick counterbalancing tail, powerful legs and comically tiny arms.
 */
function buildParts(): Part[] {
  const parts: Part[] = [
    // torso
    P([0.7, 2.55, 0], [1.0, 0.95, 0.78]),
    P([-0.4, 2.5, 0], [1.15, 0.97, 0.82]),
    P([-1.5, 2.55, 0], [0.95, 0.9, 0.75]),
    // neck
    P([1.55, 3.05, 0], [0.55, 0.62, 0.5]),
    P([1.95, 3.5, 0], [0.52, 0.55, 0.45]),
    // skull
    P([2.55, 3.72, 0], [0.68, 0.58, 0.56]),
    P([3.25, 3.58, 0], [0.7, 0.36, 0.38]),
    P([3.8, 3.52, 0], [0.3, 0.26, 0.3]),
    P([2.75, 3.38, 0], [0.5, 0.2, 0.55]), // cheeks
    // lower jaw
    P([3.15, 3.0, 0], [0.78, 0.17, 0.3], "jaw"),
    P([2.65, 3.05, 0], [0.45, 0.22, 0.42], "jaw"),
    P([3.75, 3.08, 0], [0.22, 0.12, 0.2], "jaw"),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      // brow ridge, a bump above each eye
      P([2.85, 4.1, side * 0.36], [0.3, 0.12, 0.17], "brow"),
      P([3.55, 3.82, side * 0.17], [0.25, 0.08, 0.1], "brow"), // nose bumps
      // leg: thigh, shin, metatarsus, foot
      P([-0.95, 1.75, side * 0.9], [0.78, 1.0, 0.45]),
      P([-0.55, 1.0, side * 0.85], [0.36, 0.5, 0.3]),
      P([-0.75, 0.48, side * 0.85], [0.22, 0.46, 0.22]),
      P([-0.45, 0.12, side * 0.85], [0.62, 0.12, 0.36], "jaw"),
      // tiny arm: upper + forearm
      P([1.1, 2.15, side * 0.72], [0.15, 0.34, 0.13]),
      P([1.38, 1.8, side * 0.72], [0.26, 0.1, 0.1]),
    );
  }
  // tail: tapering chain, dips slightly then lifts
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const r = 0.74 * (1 - t) + 0.08;
    parts.push(P([-2.3 - 0.46 * i, 2.55 - 0.5 * Math.sin(t * 1.7), 0], [0.5 * (1 - t * 0.4) + 0.12, r, r]));
  }
  // spine ridge: small bumps along the back
  for (let i = 0; i < 15; i++) {
    const x = 2.0 - i * 0.5;
    const y = x > -1.6 ? 3.5 - Math.abs(x - 0.3) * 0.12 : 2.55 - 0.5 * Math.sin(((-2.3 - x) / 4.14) * 1.7) + 0.75 * (1 - (-2.3 - x) / 4.14);
    const h = i < 3 ? 0.1 : 0.17;
    parts.push(P([x, y + (x > 1.7 ? -0.25 : 0), 0], [0.14, h, 0.09], "plate"));
  }
  return parts;
}

const band = (n: Vec3): number => {
  const l = dot(n, LIGHT);
  return l < -0.2 ? 0 : l < 0.2 ? 1 : l < 0.6 ? 2 : 3;
};
const clamp3 = (v: number) => Math.max(0, Math.min(3, v));

function colorFor(part: Part, p: Vec3, n: Vec3, palette: Palette, phase: number, rng: Rng): Rgb {
  let b = band(n);
  if (part.role === "plate") return palette.plate[b]!;
  if (part.role === "brow") return palette.body[clamp3(b - 1)]!;
  if (part.role === "jaw" || (n[1] < -0.3 && p[1] < 3.0 && p[0] > -2.2 && p[0] < 2.0)) {
    return palette.belly[rng.next() < 0.08 ? clamp3(b - 1) : b]!;
  }
  // tiger stripes down the flanks and tail
  if (n[1] > 0.05 && p[0] < 2.2 && Math.sin(p[0] * 4.6 + p[1] * 1.8 + phase) > 0.62) {
    return palette.body[clamp3(b - 1)]!;
  }
  // scale speckle
  const r = rng.next();
  if (r < 0.07) b = clamp3(b + 1);
  else if (r < 0.14) b = clamp3(b - 1);
  return palette.body[b]!;
}

export function buildTRex(seed: number, palette: Palette): Splat[] {
  const rng: Rng = createRng(seed);
  const phase = rng.range(0, Math.PI * 2);
  const splats: Splat[] = [];

  for (const part of buildParts()) {
    const [rx, ry, rz] = part.radii;
    const avg = (rx + ry + rz) / 3;
    const count = Math.max(12, Math.round(4 * Math.PI * avg * avg * DENSITY));
    const size = Math.min(0.13, Math.max(0.05, Math.min(rx, ry, rz) * 0.45));
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const k = rng.range(0.92, 1);
      const p: Vec3 = [part.center[0] + u[0] * rx * k, part.center[1] + u[1] * ry * k, part.center[2] + u[2] * rz * k];
      const n = normalize([u[0] / rx, u[1] / ry, u[2] / rz]);
      const s = size * rng.range(0.85, 1.2);
      splats.push({
        position: p,
        scale: [s, s, s],
        color: colorFor(part, p, n, palette, phase, rng),
        opacity: rng.range(0.78, 0.95),
      });
    }
  }

  const dot3 = (position: Vec3, r: number, color: Rgb, tall = 1): void => {
    splats.push({ position, scale: [r, r * tall, r], color, opacity: 1 });
  };
  for (const side of [-1, 1]) {
    // eye: iris, pupil
    dot3([2.88, 3.86, side * 0.47], 0.12, palette.plate[3]!);
    dot3([2.95, 3.87, side * 0.5], 0.06, palette.pupil);
    dot3([2.84, 3.9, side * 0.5], 0.035, palette.eyeWhite);
    // nostril
    dot3([3.9, 3.58, side * 0.17], 0.045, palette.pupil);
    // mouth line
    for (let i = 0; i < 12; i++) {
      const x = 2.55 + i * 0.1;
      dot3([x, MOUTH_Y, side * (0.4 - i * 0.021)], 0.04, palette.outline);
    }
    // teeth: upper row hangs down, lower row points up
    for (let i = 0; i < 9; i++) {
      const x = 2.75 + i * 0.12;
      const z = side * (0.3 - i * 0.022);
      dot3([x, MOUTH_Y - 0.06, z], 0.045, palette.eyeWhite, 1.7);
      if (i % 2 === 0) dot3([x + 0.06, MOUTH_Y + 0.02 - 0.02, z * 0.95], 0.035, palette.eyeWhite, 1.4);
    }
    // foot claws
    for (let c = 0; c < 3; c++) dot3([-0.05 + c * 0.0, 0.05, side * (0.85 + (c - 1) * 0.2)], 0.07, palette.eyeWhite);
    // arm claws
    for (let c = 0; c < 2; c++) dot3([1.62, 1.8 - c * 0.04, side * (0.7 + (c - 0.5) * 0.1)], 0.045, palette.eyeWhite);
  }
  return splats;
}
