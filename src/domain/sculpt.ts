import type { Rgb } from "@domain/palette";
import type { Rng } from "@domain/rng";
import type { Splat } from "@domain/splat";
import { dot, normalize, type Vec3 } from "@domain/vec3";

const LIGHT = normalize([0.5, 0.8, 0.45]);
export const shadeBand = (n: Vec3): number => {
  const l = dot(n, LIGHT);
  return l < -0.2 ? 0 : l < 0.2 ? 1 : l < 0.6 ? 2 : 3;
};
export const clampBand = (v: number): number => Math.max(0, Math.min(3, v));

/** (surface normal, world point, cel-shade band 0..3) -> colour */
export type ColorFn = (n: Vec3, p: Vec3, band: number) => Rgb;
type Rig = Splat["rig"];

/** Small toolkit for growing splats on ellipsoid shells, limbs and loose dots. */
export function createSculptor(rng: Rng, density: number) {
  const splats: Splat[] = [];

  function shell(center: Vec3, radii: Vec3, color: ColorFn, rig?: Rig, size?: number): void {
    const [rx, ry, rz] = radii;
    const avg = (rx + ry + rz) / 3;
    const count = Math.max(8, Math.round(4 * Math.PI * avg * avg * density));
    const sz = size ?? Math.min(0.13, Math.max(0.04, Math.min(rx, ry, rz) * 0.45));
    for (let i = 0; i < count; i++) {
      const u = rng.onSphere();
      const k = rng.range(0.92, 1);
      const p: Vec3 = [center[0] + u[0] * rx * k, center[1] + u[1] * ry * k, center[2] + u[2] * rz * k];
      const n = normalize([u[0] / rx, u[1] / ry, u[2] / rz]);
      const s = sz * rng.range(0.85, 1.2);
      let b = shadeBand(n);
      const r = rng.next();
      if (r < 0.06) b = clampBand(b + 1);
      else if (r < 0.12) b = clampBand(b - 1);
      splats.push({ position: p, scale: [s, s, s], color: color(n, p, b), opacity: rng.range(0.8, 0.95), ...(rig ? { rig } : {}) });
    }
  }

  /** Chain of spheres along a polyline, radius tapering r0 -> r1. `group` enables rig weights along the limb. */
  function limb(points: readonly Vec3[], r0: number, r1: number, color: ColorFn, group?: number): void {
    const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i]![0], p[1] - points[i]![1], p[2] - points[i]![2]));
    const total = lens.reduce((a, b) => a + b, 0);
    for (let d = 0; d <= total; ) {
      let acc = 0;
      let seg = 0;
      while (seg < lens.length - 1 && acc + lens[seg]! < d) acc += lens[seg++]!;
      const a = points[seg]!;
      const b = points[seg + 1]!;
      const f = (d - acc) / (lens[seg] || 1);
      const t = d / total;
      const r = r0 + (r1 - r0) * t;
      shell([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], [r, r, r], color, group === undefined ? undefined : { group, weight: t });
      d += Math.max(0.02, r * 0.75);
    }
  }

  function dotAt(position: Vec3, r: number, color: Rgb, opts: { tall?: number; opacity?: number; rig?: Rig } = {}): void {
    splats.push({ position, scale: [r, r * (opts.tall ?? 1), r], color, opacity: opts.opacity ?? 1, ...(opts.rig ? { rig: opts.rig } : {}) });
  }

  return { splats, shell, limb, dot: dotAt };
}
