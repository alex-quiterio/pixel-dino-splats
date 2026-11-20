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
const SMOKE = 5;
const FIRE_COUNT = 260;
const SMOKE_COUNT = 26;
const MOUTH: Vec3 = [4.25, 4.35, 0];
const FIRE_REACH = 4.4;
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
  const horn: ColorFn = (_n, _p, b) => palette.belly[clampBand(b + 1)]!;
  const spine: ColorFn = (_n, _p, b) => palette.plate[b]!;
  const claw: ColorFn = () => palette.belly[3]!;
  const bone: ColorFn = (_n, _p, b) => palette.body[clampBand(b + 1)]!;
  const tooth: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.belly[3]!);

  // torso, chest, hips
  shell([-0.3, 2.6, 0], [1.5, 0.95, 0.8], skin);
  shell([0.9, 2.95, 0], [0.8, 0.9, 0.7], skin);
  shell([-1.6, 2.5, 0], [0.9, 0.9, 0.75], skin);
  // long neck rising to a head thrust forward
  limb([[1.2, 3.2, 0], [1.9, 3.9, 0], [2.6, 4.4, 0], [3.1, 4.55, 0]], 0.55, 0.32, skin);
  shell([3.5, 4.55, 0], [0.7, 0.45, 0.42], skin); // skull
  shell([4.2, 4.5, 0], [0.5, 0.2, 0.23], skin); // upper jaw
  shell([3.85, 4.1, 0], [0.55, 0.09, 0.18], skin); // lower jaw, hanging open
  shell([3.55, 3.92, 0], [0.18, 0.12, 0.14], skin); // chin
  dot([3.95, 4.3, 0], 0.17, F3); // fire glowing in the throat
  dot([3.95, 4.3, 0], 0.4, F1, { opacity: 0.35 });
  // rows of fangs, long canines at the front
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = 3.55 + i * 0.16;
      const len = i === 5 ? 0.34 : 0.15 + (i % 2) * 0.05;
      limb([[x, 4.38, side * 0.17], [x, 4.38 - len, side * 0.17]], 0.045, 0.008, tooth);
      limb([[x - 0.05, 4.2, side * 0.15], [x - 0.05, 4.2 + (i === 4 ? 0.3 : 0.14), side * 0.15]], 0.04, 0.008, tooth);
    }
  }
  for (const side of [-1, 1]) {
    dot([4.65, 4.62, side * 0.1], 0.045, palette.outline); // nostrils
    shell([3.6, 4.98, side * 0.26], [0.34, 0.1, 0.13], horn); // heavy brow ridge
    dot([3.55, 4.78, side * 0.34], 0.2, palette.plate[3]!, { opacity: 0.3 }); // eye glow
    dot([3.55, 4.78, side * 0.37], 0.11, palette.eyeWhite);
    dot([3.55, 4.78, side * 0.38], 0.085, palette.plate[3]!); // burning eyes
    dot([3.58, 4.78, side * 0.44], 0.03, palette.pupil, { tall: 3 }); // slit pupils
    // two pairs of swept-back horns, cheek frill spikes and chin barbs
    limb([[3.05, 4.9, side * 0.2], [2.4, 5.45, side * 0.38], [1.7, 5.65, side * 0.46]], 0.12, 0.02, horn);
    limb([[3.25, 5.0, side * 0.14], [2.85, 5.5, side * 0.2], [2.5, 5.7, side * 0.24]], 0.06, 0.015, horn);
    limb([[3.0, 4.55, side * 0.3], [2.5, 4.55, side * 0.75], [2.1, 4.4, side * 0.95]], 0.06, 0.015, horn);
    limb([[3.15, 4.35, side * 0.28], [2.8, 4.1, side * 0.65]], 0.05, 0.012, horn);
    limb([[3.5, 3.88, side * 0.1], [3.4, 3.5, side * 0.12]], 0.06, 0.012, horn);
    limb([[0.45, 3.4, side * 0.75], [0.1, 3.95, side * 1.0]], 0.13, 0.02, horn); // shoulder spikes
    limb([[-1.5, 3.2, side * 0.75], [-1.9, 3.85, side * 1.0]], 0.14, 0.02, horn); // haunch spikes
    limb([[1.0, 1.8, side * 0.7], [0.7, 1.9, side * 0.95]], 0.07, 0.015, horn); // elbow spike
    // legs: front tucked, hind braced
    limb([[0.9, 2.3, side * 0.62], [1.2, 1.2, side * 0.66], [1.1, 0.18, side * 0.66]], 0.36, 0.2, skin);
    shell([1.25, 0.1, side * 0.66], [0.38, 0.12, 0.28], skin);
    limb([[-1.6, 2.2, side * 0.7], [-1.2, 1.2, side * 0.72], [-1.55, 0.2, side * 0.72]], 0.5, 0.22, skin);
    shell([-1.4, 0.1, side * 0.72], [0.45, 0.13, 0.3], skin);
    for (const [x, back] of [[1.45, 1.1], [-1.2, 1.05]] as const) {
      for (const nz of [-0.2, 0, 0.2]) limb([[x, 0.12, side * 0.68 + nz], [x + 0.35, 0.04, side * 0.68 + nz * 1.5]], 0.075, 0.012, claw);
      limb([[x - 0.3, 0.12, side * 0.68], [x - 0.5, 0.02, side * 0.68]], 0.06, 0.012, claw);
      void back;
    }

    // wings: arm bones + membrane sampled as soft dots, flapped through the WING rig
    const s = side;
    const S: Vec3 = [0.3, 3.5, 0.55 * s];
    const A: Vec3 = [0.0, 5.7, 1.5 * s];
    const T: Vec3 = [-0.7, 6.9, 2.9 * s];
    const F1: Vec3 = [-2.4, 5.6, 2.8 * s];
    const F3: Vec3 = [-3.1, 4.6, 2.4 * s];
    const F2: Vec3 = [-2.0, 3.9, 1.8 * s];
    const R: Vec3 = [-1.3, 3.3, 0.6 * s];
    const flap = (p: Vec3) => ({ group: WING, weight: Math.abs(p[2]) / 2.9 });
    limb([S, A, T], 0.13, 0.05, bone, WING);
    limb([T, F1], 0.06, 0.03, bone, WING);
    limb([T, F3], 0.06, 0.03, bone, WING);
    limb([T, F2], 0.06, 0.03, bone, WING);
    limb([A, [A[0] + 0.3, A[1] + 0.45, A[2]]], 0.1, 0.015, horn, WING); // thumb claw
    limb([T, [T[0] - 0.1, T[1] + 0.5, T[2] + 0.1 * s]], 0.08, 0.015, horn, WING); // wingtip hook
    for (const tip of [F1, F3, F2]) limb([S, tip], 0.035, 0.02, bone, WING); // veins
    const tris: [Vec3, Vec3, Vec3][] = [[S, A, T], [S, T, F1], [S, F1, F3], [S, F3, F2], [S, F2, R]];
    for (const [a, b, c] of tris) {
      for (let i = 0; i < 130; i++) {
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

  // a ridge of spikes from skull to tail tip, tallest over the shoulders
  const ridge: Vec3[] = [[2.9, 4.85, 0], [2.5, 4.78, 0], [2.1, 4.5, 0], [1.6, 4.05, 0], [1.1, 3.8, 0], [0.5, 3.6, 0], [-0.1, 3.58, 0], [-0.7, 3.52, 0], [-1.3, 3.45, 0], [-1.9, 3.3, 0], [-2.5, 3.0, 0], [-3.2, 2.5, 0], [-3.9, 2.15, 0], [-4.6, 1.85, 0], [-5.3, 1.7, 0]];
  ridge.forEach((p, i) => {
    const h = 0.7 - Math.abs(i - 5) * 0.045 - (i > 9 ? (i - 9) * 0.05 : 0);
    limb([p, [p[0] - 0.22, p[1] + h, 0]], 0.1 * h + 0.03, 0.01, spine, i > 9 ? TAIL : undefined);
  });
  // belly plates
  for (let i = 0; i < 9; i++) shell([1.5 - i * 0.38, 1.72 + (i > 6 ? 0.1 : 0), 0], [0.1, 0.04, 0.5], tooth);
  // tail with a barbed tip
  limb([[-2.3, 2.5, 0], [-3.4, 2.0, 0], [-4.5, 1.4, 0], [-5.6, 1.5, 0]], 0.6, 0.1, skin, TAIL);
  shell([-5.85, 1.6, 0], [0.3, 0.12, 0.28], spine, { group: TAIL, weight: 1 });
  limb([[-5.6, 1.5, 0], [-6.3, 1.9, 0]], 0.1, 0.01, horn, TAIL);
  for (const side of [-1, 1]) limb([[-5.7, 1.55, side * 0.1], [-6.0, 1.45, side * 0.6]], 0.08, 0.01, horn, TAIL); // barbed spade

  // scorched stone floor with glowing cracks
  for (let i = 0; i < 800; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = 1.2 + Math.cos(a) * rr * 6.4;
    const z = Math.sin(a) * rr * 4;
    dot([x, 0.02, z], 0.22, rng.next() < 0.22 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  // bones of past victims: a skull and a ribcage
  const boneColor: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.belly[3]!);
  shell([2.6, 0.22, 2.5], [0.32, 0.22, 0.25], boneColor);
  shell([2.95, 0.12, 2.5], [0.2, 0.1, 0.17], boneColor);
  for (const side of [-1, 1]) dot([2.72, 0.3, 2.5 + side * 0.13], 0.07, palette.outline);
  for (let i = 0; i < 6; i++) {
    const x = -1.5 + i * 0.3;
    limb([[x, 0.05, -2.4], [x, 0.55, -2.3], [x, 0.7, -2.0], [x, 0.2, -1.8]], 0.05, 0.03, boneColor);
  }
  limb([[-1.6, 0.06, -2.4], [-0.1, 0.06, -2.4]], 0.06, 0.05, boneColor);
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
      scale: [0.07 + rng.next() * 0.07, 0.07 + rng.next() * 0.07, 0.07 + rng.next() * 0.07],
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
  // smoke curling from the nostrils
  for (let i = 0; i < SMOKE_COUNT; i++) {
    splats.push({ position: [4.4 + rng.range(-0.1, 0.1), 4.65, rng.range(-0.12, 0.12)], scale: [0.1, 0.1, 0.1], color: palette.body[3]!, opacity: 0.6, rig: { group: SMOKE, weight: rng.next() } });
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
      const grow = 1 + a * 4.2;
      const wob = Math.sin(t * 9 + g.weight * 40) * 0.12 * a;
      const px = MOUTH[0] + a * FIRE_REACH + (x - MOUTH[0]) + wob;
      const py = MOUTH[1] + (y - MOUTH[1]) * grow + a * 0.6 - a * a * 2.4 + wob * 2;
      const pz = z * grow;
      const k = 0.6 + a * 1.7 - (g.weight > 0.6 ? 0.2 : 0);
      const op = Math.max(0, 0.95 - a * a * a * 0.95);
      const ramp4 = flames.get(s);
      const color = ramp4 ? ramp4[a < 0.2 ? 3 : a < 0.45 ? 2 : a < 0.75 ? 1 : 0]! : s.color;
      return { ...s, position: [px, py, pz], scale: [s.scale[0] * k, s.scale[1] * k, s.scale[2] * k], opacity: op, color };
    }
    if (g?.group === SMOKE) {
      const a = (t * 0.35 + g.weight) % 1;
      return { ...s, position: [x + a * 0.9 + Math.sin(a * 8 + g.weight * 6) * 0.1, y + a * 1.6, z + (g.weight - 0.5) * a * 0.6], scale: [0.1 + a * 0.3, 0.1 + a * 0.3, 0.1 + a * 0.3], opacity: 0.6 * (1 - a) };
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
