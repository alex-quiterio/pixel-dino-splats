import { createRng, type Rng } from "@domain/rng";
import type { Palette, Rgb } from "@domain/palette";
import type { Splat } from "@domain/splat";
import { dot, normalize, type Vec3 } from "@domain/vec3";

type Role = "skin" | "plate" | "jaw";
interface Part {
  readonly center: Vec3;
  readonly radii: Vec3;
  readonly role: Role;
}

const LIGHT = normalize([0.5, 0.8, 0.45]);
const LIFT = 0.55; // raises torso/neck/head/tail so the legs are longer
const DENSITY = 95; // splats per unit of surface area

/** Dino faces +x, stands on y=0. Everything is built from ellipsoid shells. */
function buildParts(): Part[] {
  const upper: Part[] = [
    { center: [0, 1.65, 0], radii: [1.3, 0.9, 0.8], role: "skin" }, // torso
    { center: [1.2, 2.3, 0], radii: [0.55, 0.7, 0.5], role: "skin" }, // neck base
    { center: [1.55, 2.8, 0], radii: [0.5, 0.55, 0.42], role: "skin" }, // neck top
    { center: [2.05, 3.05, 0], radii: [0.75, 0.5, 0.46], role: "skin" }, // head
    { center: [2.65, 2.95, 0], radii: [0.5, 0.3, 0.3], role: "skin" }, // snout
    { center: [2.55, 2.68, 0], radii: [0.5, 0.12, 0.26], role: "jaw" }, // lower jaw
  ];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = 0.78 * (1 - t) + 0.1;
    upper.push({ center: [-1.25 - 0.6 * i, 1.75 + 0.18 * Math.sin(t * 2.4) - 0.1 * t, 0], radii: [0.55 * (1 - t * 0.5) + 0.1, r, r], role: "skin" });
  }
  for (const side of [-1, 1]) upper.push({ center: [1.2, 1.55, side * 0.6], radii: [0.2, 0.32, 0.12], role: "skin" }); // tiny arms
  // back plates, tallest in the middle
  for (let i = 0; i < 9; i++) {
    const x = 1.0 - i * 0.5;
    const y = x > -1.2 ? 2.25 - Math.abs(x - 0.2) * 0.25 : 1.75 - (-1.2 - x) * 0.32;
    const h = 0.7 * Math.sin(((i + 0.7) / 9.7) * Math.PI) + 0.18;
    upper.push({ center: [x, y + h * 0.35, 0], radii: [0.22, h, 0.09], role: "plate" });
  }
  const parts: Part[] = upper.map((q) => ({ ...q, center: [q.center[0], q.center[1] + LIFT, q.center[2]] as Vec3 }));
  for (const side of [-1, 1]) {
    parts.push(
      { center: [-0.3, 1.25, side * 0.72], radii: [0.6, 0.85, 0.36], role: "skin" }, // thigh
      { center: [-0.25, 0.5, side * 0.72], radii: [0.26, 0.5, 0.25], role: "skin" }, // shin
      { center: [0.1, 0.1, side * 0.72], radii: [0.48, 0.13, 0.3], role: "jaw" }, // foot
    );
  }
  return parts;
}

const band = (n: Vec3): number => {
  const l = dot(n, LIGHT);
  return l < -0.2 ? 0 : l < 0.2 ? 1 : l < 0.6 ? 2 : 3;
};

function colorFor(part: Part, p: Vec3, n: Vec3, palette: Palette, phase: number): Rgb {
  const b = band(n);
  if (part.role === "plate") return palette.plate[b]!;
  if (part.role === "jaw" || (n[1] < -0.35 && p[1] < 2.1 && p[0] > -1.5)) return palette.belly[b]!;
  if (n[1] > 0.2 && Math.sin(p[0] * 4.2 + phase) > 0.72) return palette.body[Math.max(0, b - 1)]!;
  return palette.body[b]!;
}

export function buildDinosaur(seed: number, palette: Palette): Splat[] {
  const rng: Rng = createRng(seed);
  const phase = rng.range(0, Math.PI * 2);
  const splats: Splat[] = [];

  for (const part of buildParts()) {
    const [rx, ry, rz] = part.radii;
    const avg = (rx + ry + rz) / 3;
    const count = Math.max(10, Math.round(4 * Math.PI * avg * avg * DENSITY));
    const size = Math.min(0.16, Math.max(0.07, Math.min(rx, ry, rz) * 0.5));
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const k = rng.range(0.9, 1);
      const p: Vec3 = [
        part.center[0] + u[0] * rx * k,
        part.center[1] + u[1] * ry * k,
        part.center[2] + u[2] * rz * k,
      ];
      const n = normalize([u[0] / rx, u[1] / ry, u[2] / rz]);
      const s = size * rng.range(0.85, 1.2);
      splats.push({
        position: p,
        scale: [s, s, s],
        color: colorFor(part, p, n, palette, phase),
        opacity: rng.range(0.75, 0.95),
      });
    }
  }

  for (const side of [-1, 1]) {
    // eye + pupil
    splats.push({ position: [2.25, 3.32 + LIFT, side * 0.38], scale: [0.1, 0.1, 0.1], color: palette.eyeWhite, opacity: 1 });
    splats.push({ position: [2.31, 3.33 + LIFT, side * 0.42], scale: [0.055, 0.055, 0.055], color: palette.pupil, opacity: 1 });
    // teeth
    for (let i = 0; i < 5; i++) {
      splats.push({ position: [2.35 + i * 0.14, 2.8 + LIFT, side * (0.2 - i * 0.012)], scale: [0.05, 0.05, 0.05], color: palette.eyeWhite, opacity: 1 });
    }
    // claws
    for (let c = 0; c < 3; c++) {
      splats.push({ position: [0.45 + c * 0.08, 0.04, side * (0.72 + (c - 1) * 0.12)], scale: [0.06, 0.05, 0.05], color: palette.eyeWhite, opacity: 1 });
    }
  }
  return splats;
}
