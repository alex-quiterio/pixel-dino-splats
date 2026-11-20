import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const black = ramp("#08080f", "#14141e", "#242432", "#3c3c56");
const scales = { body: black, belly: ramp("#1a1424", "#2c2038", "#44345a", "#64507c") };
const common = { outline: hex("#030308"), eyeWhite: hex("#fff2c0"), pupil: hex("#0a0408") };

/** extras = [ground dark, ground light, fire deep, fire mid, fire bright, fire core] */
export const DRAGON_PALETTES: readonly Palette[] = [
  { name: "ember", ...scales, plate: ramp("#4a0c14", "#861a1c", "#c42a22", "#ee5a30"), extras: ramp("#1a1218", "#30242a", "#a01808", "#ee5a14", "#ffaa28", "#fff0a0"), ...common },
  { name: "frostfire", ...scales, plate: ramp("#0c2a52", "#1a4a8c", "#2a7ac8", "#5ab4ee"), extras: ramp("#10161e", "#223040", "#1a3ca0", "#2a8ae0", "#6ae0ff", "#e8fcff"), ...common },
  { name: "venom", ...scales, plate: ramp("#143a1c", "#24682c", "#3e9a3c", "#78d058"), extras: ramp("#101810", "#223422", "#1a7a1a", "#52c82a", "#b4f040", "#f8ffc0"), ...common },
];

export const DRAGON_VIEW = { target: [1.4, 3.2, 0] as Vec3, span: 15, pitch: 0.2 };

const WING = 1;
const TAIL = 2;
const FIRE = 3;
const EMBER = 4;
const FIRE_COUNT = 190;
const MOUTH: Vec3 = [4.25, 4.35, 0];
const FIRE_REACH = 3.9;
/** Fire splats remember their palette's flame ramp so pose() can recolour them with age. */
const flames = new WeakMap<Splat, readonly Rgb[]>();

export function buildDragon(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 6000);
  const { splats, shell, limb, dot } = createSculptor(rng, 110);
  const [G0, G1, F0, F1, F2, F3] = palette.extras as [Rgb, Rgb, Rgb, Rgb, Rgb, Rgb];

  const skin: ColorFn = (n, p, b) => {
    const scale = Math.sin(p[0] * 13) * Math.sin(p[1] * 13 + p[2] * 4);
    const bb = scale > 0.75 ? clampBand(b + 1) : b;
    return n[1] < -0.4 ? palette.belly[bb]! : palette.body[bb]!;
  };
  const horn: ColorFn = (_n, _p, b) => palette.plate[clampBand(b + 1)]!;
  const spine: ColorFn = (_n, _p, b) => palette.plate[b]!;
  const claw: ColorFn = () => palette.belly[3]!;
  const bone: ColorFn = (_n, _p, b) => palette.body[clampBand(b + 1)]!;

  // torso, chest, hips
  shell([-0.3, 2.6, 0], [1.5, 0.95, 0.8], skin);
  shell([0.9, 2.95, 0], [0.8, 0.9, 0.7], skin);
  shell([-1.6, 2.5, 0], [0.9, 0.9, 0.75], skin);
  // long neck rising to a head thrust forward
  limb([[1.2, 3.2, 0], [1.9, 3.9, 0], [2.6, 4.4, 0], [3.1, 4.55, 0]], 0.55, 0.32, skin);
  shell([3.5, 4.55, 0], [0.55, 0.32, 0.32], skin); // skull
  shell([4.0, 4.5, 0], [0.4, 0.17, 0.19], skin); // upper jaw
  shell([3.8, 4.12, 0], [0.5, 0.09, 0.17], skin); // lower jaw, hanging open
  dot([3.95, 4.3, 0], 0.17, F3); // fire glowing in the throat
  dot([3.95, 4.3, 0], 0.4, F1, { opacity: 0.35 });
  for (const side of [-1, 1]) {
    dot([3.4, 4.78, side * 0.26], 0.09, palette.plate[3]!); // burning eyes
    dot([3.46, 4.78, side * 0.29], 0.04, palette.pupil);
    limb([[3.05, 4.85, side * 0.2], [2.5, 5.35, side * 0.35], [2.0, 5.55, side * 0.42]], 0.12, 0.03, horn); // swept-back horns
    limb([[3.3, 4.95, side * 0.12], [3.0, 5.35, side * 0.15]], 0.07, 0.02, horn);
    // legs: front tucked, hind braced
    limb([[0.9, 2.3, side * 0.62], [1.2, 1.2, side * 0.66], [1.1, 0.18, side * 0.66]], 0.36, 0.2, skin);
    shell([1.25, 0.1, side * 0.66], [0.38, 0.12, 0.28], skin);
    limb([[-1.6, 2.2, side * 0.7], [-1.2, 1.2, side * 0.72], [-1.55, 0.2, side * 0.72]], 0.5, 0.22, skin);
    shell([-1.4, 0.1, side * 0.72], [0.45, 0.13, 0.3], skin);
    for (const x of [1.6, -1.0]) for (const nz of [-0.12, 0.12]) shell([x, 0.1, side * 0.68 + nz], [0.09, 0.07, 0.05], claw);

    // wings: arm bones + membrane sampled as soft dots, flapped through the WING rig
    const s = side;
    const S: Vec3 = [0.3, 3.5, 0.55 * s];
    const A: Vec3 = [0.0, 5.7, 1.5 * s];
    const T: Vec3 = [-0.7, 6.9, 2.9 * s];
    const F1: Vec3 = [-2.4, 5.6, 2.8 * s];
    const F2: Vec3 = [-2.0, 4.1, 1.9 * s];
    const R: Vec3 = [-1.3, 3.3, 0.6 * s];
    const flap = (p: Vec3) => ({ group: WING, weight: Math.abs(p[2]) / 2.9 });
    limb([S, A, T], 0.13, 0.05, bone, WING);
    limb([T, F1], 0.06, 0.03, bone, WING);
    limb([T, F2], 0.06, 0.03, bone, WING);
    const tris: [Vec3, Vec3, Vec3][] = [[S, A, T], [S, T, F1], [S, F1, F2], [S, F2, R]];
    for (const [a, b, c] of tris) {
      for (let i = 0; i < 150; i++) {
        let u = rng.next();
        let v = rng.next();
        if (u + v > 1) [u, v] = [1 - u, 1 - v];
        const p: Vec3 = [a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v, a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v];
        const edge = Math.min(u, v, 1 - u - v) < 0.07;
        const lit = Math.sin(p[0] * 6 + p[1] * 3) > 0.4 ? 3 : 2;
        dot(p, 0.12, edge ? palette.plate[1]! : palette.plate[clampBand(rng.next() < 0.25 ? lit : 1)]!, { opacity: 0.92, rig: flap(p) });
      }
    }
  }

  // spine ridge from head to tail
  for (let i = 0; i < 12; i++) {
    const f = i / 11;
    const x = 2.4 - f * 4.8;
    const y = f < 0.2 ? 4.5 - f * 4 : 3.55 - Math.abs(f - 0.4) * 0.8;
    shell([x, y + 0.2, 0], [0.09, 0.22 - f * 0.1, 0.05], spine);
  }
  // tail with a barbed tip
  limb([[-2.3, 2.5, 0], [-3.4, 2.0, 0], [-4.5, 1.4, 0], [-5.6, 1.5, 0]], 0.6, 0.1, skin, TAIL);
  shell([-5.85, 1.6, 0], [0.3, 0.12, 0.28], spine, { group: TAIL, weight: 1 });
  limb([[-5.6, 1.5, 0], [-6.1, 1.8, 0]], 0.08, 0.02, horn, TAIL);

  // scorched stone floor with glowing cracks
  for (let i = 0; i < 800; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = 1.2 + Math.cos(a) * rr * 6.4;
    const z = Math.sin(a) * rr * 4;
    dot([x, 0.02, z], 0.22, rng.next() < 0.22 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 20; i++) {
    const x = 5.2 + rng.range(-0.6, 3);
    const z = rng.range(-1.6, 1.6);
    dot([x, 0.05, z], 0.1, rng.next() < 0.5 ? F1 : F2, { opacity: 0.9, tall: 0.3 }); // embers where the flames land
  }

  // the fire stream: origin/spread stored in position, motion applied in pose()
  for (let i = 0; i < FIRE_COUNT; i++) {
    const spread = rng.range(-1, 1);
    const spreadZ = rng.range(-1, 1);
    const w = rng.next();
    const fire: Splat = {
      position: [MOUTH[0], MOUTH[1] + spread * 0.12, spreadZ * 0.12],
      scale: [0.1 + rng.next() * 0.06, 0.1 + rng.next() * 0.06, 0.1 + rng.next() * 0.06],
      color: F3,
      opacity: 0.9,
      rig: { group: FIRE, weight: w },
    };
    flames.set(fire, [F0, F1, F2, F3]);
    splats.push(fire);
  }
  // sparks flying off
  for (let i = 0; i < 24; i++) {
    splats.push({ position: [rng.range(4, 8), rng.range(2, 5), rng.range(-1.5, 1.5)], scale: [0.04, 0.04, 0.04], color: F2, opacity: 1, rig: { group: EMBER, weight: rng.next() } });
  }
  return splats;
}

/** Fire streams out of the jaws in a loop, wings beat, tail swings. */
export function poseDragon(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (g?.group === FIRE) {
      const a = (t * 0.75 + g.weight) % 1;
      const grow = 1 + a * 3.2;
      const px = MOUTH[0] + a * FIRE_REACH + (x - MOUTH[0]);
      const py = MOUTH[1] + (y - MOUTH[1]) * grow + a * 0.5 - a * a * 2.6;
      const pz = z * grow;
      const k = 0.55 + a * 2.2;
      const op = Math.max(0, 0.95 - a * a * 0.95);
      const ramp4 = flames.get(s);
      const color = ramp4 ? ramp4[a < 0.2 ? 3 : a < 0.45 ? 2 : a < 0.75 ? 1 : 0]! : s.color;
      return { ...s, position: [px, py, pz], scale: [s.scale[0] * k, s.scale[1] * k, s.scale[2] * k], opacity: op, color };
    }
    if (g?.group === EMBER) {
      const a = (t * 0.4 + g.weight) % 1;
      return { ...s, position: [x + a * 1.2, y + Math.sin(a * 6 + g.weight * 9) * 0.2 + a * 1.5, z], opacity: 1 - a };
    }
    if (g?.group === WING) {
      const w = g.weight;
      const f = Math.sin(t * 2.4);
      return { ...s, position: [x, y + f * 0.7 * w, z - Math.sign(z) * f * 0.35 * w] };
    }
    if (g?.group === TAIL) return { ...s, position: [x, y, z + Math.sin(t * 1.6) * 0.5 * Math.max(0, (-2.3 - x) / 3.5)] };
    return s;
  });
}
