import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#120c18"), eyeWhite: hex("#fff6e8"), pupil: hex("#0c0810") };
const black = ramp("#0b0b14", "#181826", "#2a2a42", "#4a4a6c");
const grey = ramp("#2a303c", "#454e5e", "#6c7688", "#9aa4ba");
const ginger = ramp("#94441a", "#cf7826", "#f2a24a", "#ffd08a");
const butter = ramp("#b4864a", "#d8aa68", "#f0ca8a", "#ffe8b8");
const cream = ramp("#a88460", "#d4b48a", "#eed4ae", "#fff0d6");

/** extras = [cushion dark, cushion light, yellow eye, green eye, pink nose/ears] */
const extras = ramp("#2c1f40", "#47345e", "#f4cc2a", "#7ee05a").concat([hex("#f0889e")]);

export const CAT_PALETTES: readonly Palette[] = [
  { name: "ginger-black", body: ginger, belly: cream, plate: black, extras, ...common },
  { name: "ginger-grey", body: ginger, belly: cream, plate: grey, extras, ...common },
  { name: "butter-black", body: butter, belly: cream, plate: black, extras, ...common },
];

export const CAT_VIEW = { target: [0, 1.3, 0] as Vec3, span: 5.4, pitch: 0.26 };

const TAIL = 1; // + cat index
const EYE = 3;
const EAR = 4;

export function buildCats(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 3000);
  const { splats, shell, limb, dot } = createSculptor(rng, 120);
  const [C0, C1, YELLOW, GREEN, PINK] = palette.extras as [Rgb, Rgb, Rgb, Rgb, Rgb];

  const gingerFur: ColorFn = (n, p, b) => {
    if (n[1] < -0.3 || (p[0] > 0.3 && p[1] < 1.75 && n[0] > 0.25) || (p[0] > 0.78 && p[1] > 1.6 && p[1] < 2.1)) return palette.belly[b]!;
    const stripe = Math.sin(p[1] * 10 + p[0] * 2.5) > 0.5 || (p[1] > 2.2 && Math.abs(Math.sin(p[2] * 18)) > 0.8);
    return palette.body[stripe ? clampBand(b - 1) : b]!;
  };
  const blackFur: ColorFn = (_n, _p, b) => palette.plate[rng.next() < 0.1 ? clampBand(b + 1) : b]!;

  interface CatSpec {
    readonly index: number;
    readonly z: number;
    readonly s: number;
    readonly yaw: number;
    readonly fur: ColorFn;
    readonly eye: Rgb;
    readonly tailDir: 1 | -1;
  }

  const sit = ({ index, z, s, yaw, fur, eye, tailDir }: CatSpec): void => {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // local (x, y, z) -> world, rotated about the vertical axis
    const at = (x: number, y: number, zz: number): Vec3 => [(x * cy + zz * sy) * s, y * s, z + (-x * sy + zz * cy) * s];
    const R = (x: number, y: number, zz: number): Vec3 => [x * s, y * s, zz * s];
    const body = (c: Vec3, r: Vec3, rig?: Splat["rig"]) => shell(at(...c), R(...r), fur, rig);

    body([-0.2, 0.55, 0], [0.62, 0.55, 0.5]); // haunch
    body([0.0, 0.95, 0], [0.4, 0.62, 0.33]);
    body([0.22, 1.35, 0], [0.34, 0.55, 0.3]); // chest
    body([0.5, 2.0, 0], [0.46, 0.4, 0.42]); // head
    body([0.9, 1.9, 0], [0.15, 0.11, 0.15]); // muzzle
    dot(at(1.04, 1.93, 0), 0.04 * s, PINK); // nose
    for (const side of [-1, 1]) {
      body([0.45, 2.52, side * 0.27], [0.13, 0.3, 0.08], { group: EAR, weight: index }); // ears
      dot(at(0.55, 2.5, side * 0.3), 0.05 * s, PINK, { tall: 2.6 });
      // eyes, with a vertical slit pupil
      dot(at(0.86, 2.08, side * 0.2), 0.09 * s, eye, { rig: { group: EYE, weight: 1 } });
      dot(at(0.95, 2.08, side * 0.21), 0.035 * s, palette.pupil, { tall: 2.6, rig: { group: EYE, weight: 1 } });
      // legs and paws
      limb([at(0.5, 1.0, side * 0.18), at(0.6, 0.1, side * 0.18)], 0.11 * s, 0.09 * s, fur);
      body([0.7, 0.08, side * 0.18], [0.18, 0.08, 0.11]);
      body([0.15, 0.08, side * 0.5], [0.28, 0.08, 0.14]); // hind paws
      for (let w = 0; w < 3; w++) {
        const a = at(0.95, 1.95 + (w - 1) * 0.06, side * 0.2);
        dot([a[0] + 0.08 * s, a[1], a[2] + side * (0.1 + w * 0.01) * s], 0.012 * s, palette.eyeWhite, { tall: 0.8 }); // whiskers
      }
    }
    // tail wraps around the front, swishing via rig group
    const t = tailDir;
    limb([at(-0.8, 0.45, 0), at(-0.95, 0.15, 0.45 * t), at(-0.4, 0.09, 0.85 * t), at(0.45, 0.09, 0.75 * t), at(0.8, 0.3, 0.75 * t)], 0.14 * s, 0.09 * s, fur, TAIL + index);
  };

  sit({ index: 0, z: 0.78, s: 1.08, yaw: 0.22, fur: gingerFur, eye: GREEN, tailDir: 1 });
  sit({ index: 1, z: -0.8, s: 1.0, yaw: -0.22, fur: blackFur, eye: YELLOW, tailDir: -1 });

  // round cushion for them to sit on
  for (let i = 0; i < 520; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * (1 + 0.04 * Math.sin(a * 6));
    dot([Math.cos(a) * r * 2.5, 0.02, Math.sin(a) * r * 2.5], 0.2, r > 0.86 || rng.next() < 0.2 ? C1 : C0, { opacity: 0.95, tall: 0.15 });
  }
  return splats;
}

/** Tails swish, ears twitch, eyes blink. */
export function poseCats(splats: readonly Splat[], t: number): Splat[] {
  const blink = Math.sin(t * 1.5 + 0.5) > 0.96 ? 0.12 : 1;
  return splats.map((s) => {
    const g = s.rig;
    if (!g) return s;
    const [x, y, z] = s.position;
    if (g.group === EYE) return { ...s, scale: [s.scale[0], s.scale[1] * blink, s.scale[2]] };
    if (g.group === EAR) {
      const twitch = Math.sin(t * 2.5 + g.weight * 3) > 0.93 ? 0.06 : 0;
      return twitch ? { ...s, position: [x, y - twitch, z] } : s;
    }
    const idx = g.group - TAIL;
    const w2 = g.weight * g.weight;
    return { ...s, position: [x, y + Math.sin(t * 2 + idx) * 0.08 * w2, z + Math.sin(t * 1.8 + idx * 2 + g.weight * 2) * 0.2 * w2] };
  });
}
