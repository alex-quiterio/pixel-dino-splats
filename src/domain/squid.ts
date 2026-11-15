import { createRng, type Rng } from "@domain/rng";
import { hex, ramp, type Palette, type Rgb } from "@domain/palette";
import type { Splat } from "@domain/splat";
import { dot, normalize, type Vec3 } from "@domain/vec3";

const water = ramp("#16304a", "#2a5a78", "#4f8aa8", "#b4dde8");
const common = { outline: hex("#0a0d1c"), eyeWhite: hex("#fff6d8"), pupil: hex("#0c0814"), extras: water };

export const SQUID_PALETTES: readonly Palette[] = [
  { name: "coral", body: ramp("#7a2a3a", "#b5453f", "#e8715e", "#f7a08a"), belly: ramp("#4a1a2a", "#7d2b33", "#a83f3f", "#d4644f"), plate: ramp("#9a7416", "#d3ac26", "#f5de4e", "#fff7a8"), ...common },
  { name: "violet", body: ramp("#3a2a6b", "#5f45a8", "#8d6ad8", "#c0a0f5"), belly: ramp("#241a4a", "#3f2e7d", "#5e46a8", "#8566d4"), plate: ramp("#1a7a6a", "#27b090", "#58e0b4", "#b4fbe0"), ...common },
  { name: "kelp", body: ramp("#1f4a3a", "#2f7a52", "#4fb070", "#8fe09a"), belly: ramp("#12301f", "#1f5236", "#2f7a4c", "#4fa468"), plate: ramp("#a84a14", "#e07a1e", "#ffae3a", "#ffe08a"), ...common },
];

export const SQUID_VIEW = { target: [0, 2.7, 0] as Vec3, span: 8.8, pitch: 0.34 };

const LIGHT = normalize([0.5, 0.8, 0.45]);
const DENSITY = 110;
const band = (n: Vec3): number => {
  const l = dot(n, LIGHT);
  return l < -0.2 ? 0 : l < 0.2 ? 1 : l < 0.6 ? 2 : 3;
};
const c3 = (v: number) => Math.max(0, Math.min(3, v));

const RAIN_GROUP = 100;
const FIN_GROUP = 50;
const RAIN_HEIGHT = 7.5;
const RAIN_COUNT = 170;

/** [length, end height, hump, isTentacle] per arm; arms fan out every 45 degrees. */
const ARMS: readonly (readonly [number, number, number, boolean])[] = [
  [2.6, 0.12, 0.9, false],
  [2.2, 0.12, 0.3, false],
  [4.2, 4.8, 0.0, true],
  [2.4, 0.12, 0.7, false],
  [2.8, 2.4, 0.8, false],
  [4.0, 3.4, 0.5, true],
  [2.3, 0.12, 0.2, false],
  [2.5, 1.7, 0.9, false],
];
export const armTheta = (group: number): number => ((group - 1) / 8) * Math.PI * 2 + 0.35;

export function buildSquid(seed: number, palette: Palette): Splat[] {
  const rng: Rng = createRng(seed + 1000);
  const splats: Splat[] = [];
  const [W0, W1, W2, W3] = palette.extras as [Rgb, Rgb, Rgb, Rgb];

  const shell = (center: Vec3, radii: Vec3, color: (n: Vec3, p: Vec3, b: number) => Rgb, rig?: Splat["rig"], size?: number) => {
    const [rx, ry, rz] = radii;
    const avg = (rx + ry + rz) / 3;
    const count = Math.max(8, Math.round(4 * Math.PI * avg * avg * DENSITY));
    const sz = size ?? Math.min(0.13, Math.max(0.045, Math.min(rx, ry, rz) * 0.45));
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const k = rng.range(0.92, 1);
      const p: Vec3 = [center[0] + u[0] * rx * k, center[1] + u[1] * ry * k, center[2] + u[2] * rz * k];
      const n = normalize([u[0] / rx, u[1] / ry, u[2] / rz]);
      const s = sz * rng.range(0.85, 1.2);
      let b = band(n);
      const r = rng.next();
      if (r < 0.06) b = c3(b + 1);
      else if (r < 0.12) b = c3(b - 1);
      splats.push({ position: p, scale: [s, s, s], color: color(n, p, b), opacity: rng.range(0.8, 0.95), ...(rig ? { rig } : {}) });
    }
  };
  const skin = (n: Vec3, _p: Vec3, b: number): Rgb => (n[1] < -0.35 ? palette.belly[b]! : palette.body[b]!);

  // mantle: tapering, slightly leaning chain
  for (let j = 0; j < 9; j++) {
    const t = j / 8;
    const r = 0.8 * (1 - t) + 0.18;
    shell([0.1 - 0.4 * t, 1.95 + 3.1 * t, 0], [r, 0.6, r * 0.92], skin);
  }
  // fins at the tip, flapping via rig
  for (const side of [-1, 1]) {
    shell([-0.34, 4.7, side * 0.55], [0.55, 0.85, 0.18], (_n, _p, b) => palette.body[c3(b + 1)]!, { group: FIN_GROUP, weight: 1 });
    shell([-0.38, 4.25, side * 0.46], [0.48, 0.55, 0.18], (_n, _p, b) => palette.body[c3(b + 1)]!, { group: FIN_GROUP, weight: 0.6 });
  }
  // head, funnel, eye sockets
  shell([0.1, 1.45, 0], [1.0, 0.8, 0.9], skin);
  shell([0.75, 1.05, 0], [0.3, 0.25, 0.26], skin);
  for (const side of [-1, 1]) {
    shell([0.32, 1.55, side * 0.7], [0.5, 0.52, 0.18], (_n, _p, b) => palette.belly[b]!);
    shell([0.34, 1.55, side * 0.82], [0.4, 0.44, 0.17], (_n, _p, b) => palette.plate[b]!, undefined, 0.05);
    for (let i = 0; i < 7; i++) {
      // vertical slit pupil
      splats.push({ position: [0.4, 1.55 + (i - 3) * 0.1, side * 0.97], scale: [0.05, 0.09, 0.05], color: palette.pupil, opacity: 1 });
    }
    splats.push({ position: [0.2, 1.78, side * 0.97], scale: [0.04, 0.04, 0.04], color: palette.eyeWhite, opacity: 1 });
  }

  // arms and tentacles: chains of small spheres along a curve
  ARMS.forEach(([L, yEnd, hump, tentacle], i) => {
    const group = i + 1;
    const th = armTheta(group);
    const dir: Vec3 = [Math.cos(th), 0, Math.sin(th)];
    const side: Vec3 = [-Math.sin(th), 0, Math.cos(th)];
    const r0 = tentacle ? 0.1 : 0.17;
    for (let t = 0; t <= 1; ) {
      const lat = 0.5 * Math.sin(t * Math.PI * 1.5 + i);
      const y = 1.0 + (yEnd - 1.0) * t ** 1.5 + hump * Math.sin(Math.PI * t);
      const d = 0.45 + L * t;
      const center: Vec3 = [0.1 + dir[0] * d + side[0] * lat, Math.max(0.12, y), dir[2] * d + side[2] * lat];
      let r = r0 * (1 - 0.7 * t) + 0.035;
      if (tentacle && t > 0.86) r *= 1.7; // club tip
      shell(center, [r, r, r], skin, { group, weight: t });
      t += (r * 0.75) / (L * 1.15);
    }
  });

  // puddle: flat blob with ripples and foam
  for (let i = 0; i < 620; i++) {
    const a = rng.range(0, Math.PI * 2);
    const wob = 1 + 0.12 * Math.sin(a * 3 + seed);
    const rr = Math.sqrt(rng.next()) * wob;
    const x = Math.cos(a) * rr * 4.6;
    const z = Math.sin(a) * rr * 3.2;
    const rad = Math.hypot(x / 4.6, z / 3.2);
    let col = W1;
    if (rad > 0.82) col = W0;
    else if (Math.sin(Math.hypot(x, z) * 5) > 0.86) col = W3;
    else if (rng.next() < 0.14) col = W2;
    splats.push({ position: [x, 0.02, z], scale: [0.22, 0.03, 0.22], color: col, opacity: 0.95 });
  }
  for (let i = 0; i < 70; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = rng.range(0.7, 1.9);
    splats.push({ position: [0.1 + Math.cos(a) * rr, rng.range(0.05, 0.22), Math.sin(a) * rr], scale: [0.09, 0.06, 0.09], color: rng.next() < 0.6 ? W3 : W2, opacity: 1 });
  }

  // rain streaks (animated through rig group)
  for (let i = 0; i < RAIN_COUNT; i++) {
    splats.push({
      position: [rng.range(-5.5, 5.5), rng.range(0, RAIN_HEIGHT), rng.range(-4, 4)],
      scale: [0.025, 0.32, 0.025],
      color: rng.next() < 0.5 ? W1 : W2,
      opacity: 0.9,
      rig: { group: RAIN_GROUP, weight: rng.next() },
    });
  }
  return splats;
}

/** Arms wave, fins flap, rain falls. */
export function poseSquid(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const g = s.rig;
    if (!g) return s;
    const [x, y, z] = s.position;
    if (g.group === RAIN_GROUP) {
      const speed = 5 + 3 * g.weight;
      const ny = (((y - speed * t) % RAIN_HEIGHT) + RAIN_HEIGHT) % RAIN_HEIGHT;
      return { ...s, position: [x, ny, z] };
    }
    if (g.group === FIN_GROUP) {
      return { ...s, position: [x, y, z + Math.sign(z) * Math.sin(t * 2.6) * 0.14 * g.weight] };
    }
    const th = armTheta(g.group);
    const w2 = g.weight * g.weight;
    const lift = Math.sin(t * 1.7 + g.group * 1.3 + g.weight * 2.5) * 0.4 * w2;
    const sway = Math.sin(t * 1.3 + g.group * 0.9 + g.weight * 3) * 0.35 * w2;
    return { ...s, position: [x - Math.sin(th) * sway, Math.max(0.1, y + lift), z + Math.cos(th) * sway] };
  });
}
