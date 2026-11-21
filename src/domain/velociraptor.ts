import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import { createRng } from "@domain/rng";
import { clampBand, createSculptor, type ColorFn } from "@domain/sculpt";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

const common = { outline: hex("#140c10"), eyeWhite: hex("#fff4c8"), pupil: hex("#0c0408") };

/** body = scales, belly = pale underside, plate = feathers; extras = [ground dark, ground light, egg, dry grass] */
export const RAPTOR_PALETTES: readonly Palette[] = [
  { name: "desert", body: ramp("#5a3a22", "#8a5a32", "#b88448", "#e0b070"), belly: ramp("#a08a6a", "#c8b08a", "#e6d2aa", "#fff0d0"), plate: ramp("#5a1a14", "#962c1c", "#d0502a", "#f48a48"), extras: ramp("#6a4a2c", "#9a7444", "#e8e0c8", "#c8a456"), ...common },
  { name: "jungle", body: ramp("#1e3a22", "#2e5a30", "#4a8444", "#7ab460"), belly: ramp("#7a8a5a", "#a2b07a", "#c8d4a0", "#ecf4c8"), plate: ramp("#142a5a", "#1e4a96", "#2e7ad0", "#62b4f4"), extras: ramp("#2a2418", "#4a3e26", "#d8e4c8", "#6a8a3a"), ...common },
  { name: "ash", body: ramp("#26262e", "#3e3e4a", "#5e5e6e", "#8a8a9c"), belly: ramp("#8a8a90", "#b0b0b4", "#d4d4d4", "#f4f4f0"), plate: ramp("#4a0a1a", "#801226", "#c0203a", "#f0506a"), extras: ramp("#2a2a30", "#4a4a52", "#e0dcd0", "#7a6a5a"), ...common },
];

export const RAPTOR_VIEW = { target: [-0.6, 2.0, 0] as Vec3, span: 10.5, pitch: 0.18 };

const HEAD = 1;
const TAIL = 2;
const CLAW = 3;
const ARM = 4;
const CREST = 5;

export function buildVelociraptor(seed: number, palette: Palette): Splat[] {
  const rng = createRng(seed + 7000);
  const { splats, shell, limb, dot } = createSculptor(rng, 130);
  const [G0, G1, EGG, GRASS] = palette.extras as [Rgb, Rgb, Rgb, Rgb];
  const head = (w = 1) => ({ group: HEAD, weight: w });

  // tiger stripes over the back, pale belly underneath, fine scale speckle
  const skin: ColorFn = (n, p, b) => {
    const speckle = Math.sin(p[0] * 19) * Math.sin(p[1] * 17 + p[2] * 13) > 0.8;
    const bb = speckle ? clampBand(b + 1) : b;
    if (n[1] < -0.35) return palette.belly[bb]!;
    const stripe = n[1] > 0.1 && Math.sin(p[0] * 7.5 + p[1] * 1.5) > 0.55;
    return stripe ? palette.plate[clampBand(bb - 1)]! : palette.body[bb]!;
  };
  const feather: ColorFn = (_n, p, b) => (Math.sin(p[0] * 9 + p[2] * 5) > 0.3 ? palette.plate[clampBand(b + 1)]! : palette.plate[b]!);
  const claw: ColorFn = (_n, _p, b) => (b > 2 ? palette.belly[2]! : palette.outline);
  const tooth: ColorFn = (_n, _p, b) => (b > 1 ? palette.eyeWhite : palette.belly[3]!);
  const scute: ColorFn = (_n, p, b) => palette.body[clampBand(Math.sin(p[1] * 30) > 0 ? b : b - 1)]!;

  // lean, horizontal torso slung between the hips
  shell([-0.1, 2.35, 0], [1.15, 0.62, 0.52], skin);
  shell([0.75, 2.45, 0], [0.55, 0.55, 0.45], skin); // chest
  shell([-0.9, 2.5, 0], [0.6, 0.6, 0.5], skin); // hips
  // S-curved neck rising to a long, low skull
  limb([[1.0, 2.6, 0], [1.4, 3.1, 0], [1.7, 3.45, 0], [2.05, 3.6, 0]], 0.36, 0.22, skin, HEAD);
  shell([2.35, 3.65, 0], [0.42, 0.27, 0.25], skin, head());
  shell([2.85, 3.56, 0], [0.42, 0.16, 0.17], skin, head()); // snout
  shell([3.2, 3.5, 0], [0.12, 0.11, 0.12], skin, head()); // nose tip
  shell([2.65, 3.33, 0], [0.5, 0.06, 0.14], skin, head()); // lower jaw, a little open
  shell([2.6, 3.42, 0], [0.4, 0.05, 0.1], (_n, _p, b) => palette.plate[clampBand(b - 2)]!, head()); // dark mouth
  for (const side of [-1, 1]) {
    // serrated teeth top and bottom
    for (let i = 0; i < 8; i++) {
      const x = 2.4 + i * 0.1;
      limb([[x, 3.47, side * 0.14], [x + 0.02, 3.37, side * 0.14]], 0.025, 0.006, tooth, HEAD);
      if (i % 2 === 0) limb([[x + 0.05, 3.36, side * 0.12], [x + 0.05, 3.44, side * 0.12]], 0.022, 0.006, tooth, HEAD);
    }
    dot([3.25, 3.58, side * 0.07], 0.035, palette.outline, { rig: head() }); // nostrils
    shell([2.35, 3.86, side * 0.17], [0.24, 0.06, 0.08], skin, head()); // brow ridge
    dot([2.33, 3.74, side * 0.25], 0.11, palette.plate[3]!, { rig: head() }); // eye ring
    dot([2.33, 3.74, side * 0.27], 0.085, palette.eyeWhite, { rig: head() });
    dot([2.36, 3.74, side * 0.32], 0.025, palette.pupil, { tall: 3, rig: head() }); // slit pupil
    dot([2.1, 3.65, side * 0.24], 0.04, palette.outline, { rig: head() }); // ear hole
  }
  // crest of quills from the back of the skull down the neck
  for (let i = 0; i < 9; i++) {
    const x = 2.2 - i * 0.16;
    const y = 3.88 - i * 0.12;
    const h = 0.42 - i * 0.03;
    limb([[x, y, 0], [x - 0.22, y + h, 0]], 0.05, 0.012, feather, i < 5 ? CREST : undefined);
  }

  // feathered arms folded forward, three hooked fingers each
  for (const side of [-1, 1]) {
    const arm: Vec3[] = [[0.9, 2.35, side * 0.42], [1.15, 1.95, side * 0.55], [1.55, 2.05, side * 0.5], [1.8, 1.95, side * 0.48]];
    limb(arm, 0.14, 0.06, skin, ARM);
    for (const [dy, dz] of [[0.05, 0.04], [0, 0], [-0.06, -0.04]] as const) {
      limb([[1.8, 1.95 + dy, side * (0.48 + dz)], [1.98, 1.88 + dy, side * (0.5 + dz)], [2.02, 1.74 + dy, side * (0.5 + dz)]], 0.035, 0.008, claw, ARM);
    }
    // primaries trailing from the forearm
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      const ax = 1.15 + f * 0.6;
      const ay = 1.95 + Math.sin(f * Math.PI) * 0.08;
      limb([[ax, ay, side * 0.58], [ax - 0.45 - f * 0.1, ay - 0.35 + f * 0.05, side * 0.62]], 0.05, 0.02, feather, ARM);
    }
    // legs: muscular thigh, slender shin, raised sickle claw
    const s = side * 0.42;
    shell([-0.55, 2.1, s], [0.55, 0.62, 0.3], skin);
    limb([[-0.4, 1.7, s], [-0.05, 1.05, s], [-0.35, 0.55, s]], 0.3, 0.13, skin);
    limb([[-0.35, 0.55, s], [-0.05, 0.12, s]], 0.12, 0.09, scute);
    for (let i = 0; i < 6; i++) dot([-0.35 + i * 0.055, 0.55 - i * 0.08, s + side * 0.1], 0.035, palette.body[0]!); // scutes along the shank
    for (const dz of [-0.1, 0.1]) {
      limb([[-0.05, 0.1, s + dz], [0.3, 0.07, s + dz * 1.4], [0.45, 0.02, s + dz * 1.5]], 0.07, 0.03, scute);
      limb([[0.45, 0.04, s + dz * 1.5], [0.56, 0.0, s + dz * 1.5]], 0.035, 0.006, claw);
    }
    // the killing claw, held up off the ground
    limb([[0.0, 0.16, s], [0.12, 0.35, s], [0.3, 0.42, s], [0.42, 0.33, s]], 0.06, 0.012, claw, CLAW);
  }

  // long stiff tail with a feather fan at the tip
  limb([[-1.3, 2.55, 0], [-2.3, 2.7, 0], [-3.3, 2.7, 0], [-4.3, 2.6, 0]], 0.4, 0.07, skin, TAIL);
  for (let i = 0; i < 14; i++) {
    const x = -2.8 - i * 0.12;
    for (const side of [-1, 1]) {
      const len = 0.25 + i * 0.03;
      limb([[x, 2.68, side * 0.05], [x - 0.25, 2.66, side * (0.1 + len)]], 0.045, 0.015, feather, TAIL);
    }
  }
  limb([[-4.3, 2.6, 0], [-4.85, 2.58, 0]], 0.08, 0.02, feather, TAIL);
  // downy feathers along the spine and shoulders
  for (let i = 0; i < 160; i++) {
    const x = rng.range(-2.4, 1.2);
    const along = x > -1.3 ? 2.95 - Math.abs(x + 0.2) * 0.12 : 2.7 + (x + 1.3) * -0.02 + 0.28;
    const z = rng.range(-0.3, 0.3);
    dot([x, along - Math.abs(z) * 0.5, z], 0.06, palette.plate[rng.next() < 0.5 ? 1 : 2]!, { opacity: 0.9, rig: x < -1.3 ? { group: TAIL, weight: 0 } : undefined });
  }

  // cracked dusty ground, dry grass tufts, rocks and a clutch of eggs
  for (let i = 0; i < 900; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.1 * Math.sin(a * 3 + seed) + 0.06 * Math.sin(a * 5);
    const rr = Math.sqrt(rng.next()) * wob;
    dot([-0.5 + Math.cos(a) * rr * 5.4, 0.02, Math.sin(a) * rr * 3.4], 0.2, rng.next() < 0.25 ? G1 : G0, { opacity: 0.95, tall: 0.14 });
  }
  for (let i = 0; i < 14; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0.55, 0.95);
    const bx = -0.5 + Math.cos(a) * r * 5;
    const bz = Math.sin(a) * r * 3.1;
    if (Math.abs(bx + 0.5) < 2.5 && Math.abs(bz) < 1.0) continue;
    for (let k = 0; k < 5; k++) {
      const lean = rng.range(-0.25, 0.25);
      const h = rng.range(0.35, 0.6);
      for (let f = 0; f <= 1; f += 0.12) dot([bx + k * 0.05 + (lean - k * 0.05) * f, h * f, bz + lean * 0.5 * f], 0.028, f > 0.4 ? GRASS : G1);
    }
  }
  const rock: ColorFn = (_n, _p, b) => palette.belly[clampBand(b - 2)]!;
  shell([2.6, 0.2, -1.8], [0.45, 0.3, 0.38], rock);
  shell([2.95, 0.12, -1.4], [0.22, 0.14, 0.2], rock);
  shell([-3.6, 0.18, -1.6], [0.36, 0.24, 0.3], rock);
  // nest: a ring of twigs cradling four speckled eggs
  const nest: Vec3 = [2.3, 0.1, 1.7];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    limb([[nest[0] + Math.cos(a) * 0.6, 0.12, nest[2] + Math.sin(a) * 0.45], [nest[0] + Math.cos(a + 0.5) * 0.65, 0.2, nest[2] + Math.sin(a + 0.5) * 0.5]], 0.05, 0.04, (_n, _p, b) => (b > 1 ? G1 : G0));
  }
  const egg: ColorFn = (_n, p, b) => (Math.sin(p[0] * 40) * Math.sin(p[1] * 37 + p[2] * 29) > 0.75 ? palette.body[1]! : b > 0 ? EGG : palette.belly[2]!);
  for (const [dx, dz] of [[-0.18, -0.1], [0.15, -0.12], [0, 0.14], [0.25, 0.15]] as const) shell([nest[0] + dx, 0.28, nest[2] + dz], [0.13, 0.19, 0.13], egg);
  return splats;
}

/** Bird-like head jerks, stalking sway, tail counter-balance and a tapping sickle claw. */
export function poseVelociraptor(splats: readonly Splat[], t: number): Splat[] {
  // the head snaps between glances instead of drifting
  const beat = Math.floor(t * 1.4);
  const glance = Math.sin(beat * 2.7);
  const tilt = Math.sin(beat * 1.9) * 0.12;
  const breathe = Math.sin(t * 3) * 0.03;
  return splats.map((s) => {
    const [x, y, z] = s.position;
    const g = s.rig;
    if (g?.group === HEAD) {
      const w = g.weight === 1 ? 1 : g.weight;
      return { ...s, position: [x, y + (tilt + breathe) * w, z + glance * 0.35 * w + (y - 3.6) * tilt * w] };
    }
    if (g?.group === CREST) return { ...s, position: [x, y + tilt * 0.6 + Math.sin(t * 6 + x * 4) * 0.03, z + glance * 0.2] };
    if (g?.group === TAIL) return { ...s, position: [x, y + Math.sin(t * 1.2) * 0.08 * Math.max(0, (-1.3 - x) / 3), z - glance * 0.25 * Math.max(0, (-1.3 - x) / 3.5) + Math.sin(t * 1.7) * 0.15 * Math.max(0, (-2 - x) / 3)] };
    if (g?.group === CLAW) {
      const tap = Math.max(0, Math.sin(t * 5)) ** 4 * 0.09 * g.weight;
      return { ...s, position: [x + tap * 0.5, y + tap, z] };
    }
    if (g?.group === ARM) return { ...s, position: [x, y + Math.sin(t * 2.2) * 0.04 * g.weight + breathe, z] };
    return s;
  });
}
