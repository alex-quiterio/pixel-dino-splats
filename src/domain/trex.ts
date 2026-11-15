import { createRng, type Rng } from "@domain/rng";
import type { Palette, Rgb } from "@domain/palette";
import type { Splat } from "@domain/splat";
import { dot, normalize, type Vec3 } from "@domain/vec3";

type Role = "skin" | "plate" | "jaw" | "brow" | "mouth";
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
    // skull: big and heavy
    P([2.6, 3.75, 0], [0.78, 0.66, 0.62]),
    P([3.35, 3.6, 0], [0.8, 0.4, 0.4]),
    P([3.95, 3.55, 0], [0.32, 0.28, 0.3]),
    P([2.8, 3.55, 0], [0.5, 0.2, 0.58]), // cheeks, above the mouth line
    P([3.4, 3.4, 0], [0.8, 0.1, 0.33]), // upper lip: its lower edge carries the teeth
    // lower jaw
    P([3.25, 3.02, 0], [0.85, 0.17, 0.3], "jaw"),
    P([2.7, 3.07, 0], [0.45, 0.22, 0.42], "jaw"),
    P([3.95, 3.1, 0], [0.22, 0.12, 0.2], "jaw"),
    P([3.3, 3.3, 0], [0.85, 0.3, 0.05], "mouth"), // dark red inside of the mouth
    P([3.1, 3.12, 0], [0.62, 0.1, 0.2], "mouth"), // tongue
  ];
  for (const side of [-1, 1]) {
    parts.push(
      // brow ridge, a bump above each eye
      P([2.95, 4.08, side * 0.4], [0.4, 0.15, 0.2], "brow"),
      P([2.5, 4.35, side * 0.3], [0.1, 0.22, 0.1], "plate"), // little horns
      P([3.7, 3.85, side * 0.17], [0.25, 0.08, 0.1], "brow"), // nose bumps
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
    const h = i < 3 ? 0.14 : 0.24 + 0.1 * Math.sin(i * 1.7) ** 2;
    parts.push(P([x, y + (x > 1.7 ? -0.22 : 0.08), 0], [0.12, h, 0.08], "plate"));
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
  if (part.role === "mouth") return palette.plate[Math.min(b, 1)]!;
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
    // eye: fiery iris, slit pupil, glint
    dot3([2.95, 3.86, side * 0.6], 0.17, palette.plate[2]!);
    dot3([3.02, 3.87, side * 0.74], 0.06, palette.pupil, 2.6);
    dot3([2.88, 3.93, side * 0.74], 0.035, palette.plate[3]!);
    // angry slanted brow shadow above the eye, plus a scar across the snout
    for (let i = 0; i < 6; i++) dot3([2.72 + i * 0.075, 4.12 - i * 0.03, side * (0.68 - i * 0.02)], 0.055, palette.outline);
    for (let i = 0; i < 5; i++) dot3([3.5 + i * 0.05, 3.72 - i * 0.07, side * 0.36], 0.03, palette.belly[3]!);
    // nostril
    dot3([4.08, 3.6, side * 0.17], 0.045, palette.pupil);
    // mouth line + teeth follow the lip outline
    const lipZ = (x: number) => 0.33 * Math.sqrt(Math.max(0.12, 1 - ((x - 3.4) / 0.8) ** 2));
    for (let i = 0; i < 14; i++) {
      const x = 2.7 + i * 0.1;
      dot3([x, MOUTH_Y + 0.05, side * (lipZ(x) + 0.08)], 0.045, palette.outline);
    }
    for (let i = 0; i < 13; i++) {
      const x = 2.85 + i * 0.1;
      const z = side * (lipZ(x) + 0.1);
      const fang = i === 8 || i === 9 ? 3.0 : 2.1;
      // upper fangs hang from the lip (kept above the jaw hinge so they stay put)
      dot3([x, MOUTH_Y + 0.07 - (fang - 2) * 0.02, z], 0.06, palette.eyeWhite, fang);
      // lower teeth ride up with the jaw
      if (i % 2 === 0 && x < 3.9) dot3([x + 0.05, MOUTH_Y - 0.04, side * (lipZ(x) * 0.8 + 0.05)], 0.05, palette.eyeWhite, 1.9);
    }
    // foot claws
    for (let c = 0; c < 3; c++) {
      dot3([0.1, 0.07, side * (0.85 + (c - 1) * 0.22)], 0.085, palette.eyeWhite, 1.3);
      dot3([0.2, 0.04, side * (0.85 + (c - 1) * 0.22)], 0.055, palette.eyeWhite);
    }
    // arm claws
    for (let c = 0; c < 2; c++) dot3([1.64 + c * 0.03, 1.78 - c * 0.07, side * (0.7 + (c - 0.5) * 0.12)], 0.05, palette.eyeWhite, 2.2);
  }
  return splats;
}
