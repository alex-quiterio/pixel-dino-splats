import type { Rgb } from "@domain/palette";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

export interface Camera {
  readonly yaw: number;
  readonly pitch: number;
  readonly target: Vec3;
  readonly pixelsPerUnit: number;
  readonly width: number;
  readonly height: number;
}

export interface ProjectedSplat {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** Inverse 2D covariance (a, b, c) in pixel space. */
  readonly conic: readonly [number, number, number];
  readonly radius: number;
  readonly color: Rgb;
  readonly opacity: number;
}

type Row = readonly [number, number, number];
export type Mat3 = readonly [Row, Row, Row];

/** R = Rx(pitch) * Ry(yaw). Camera looks down -z, orthographic. */
export function viewRotation(yaw: number, pitch: number): Mat3 {
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  return [
    [c, 0, s],
    [sp * s, cp, -sp * c],
    [-cp * s, sp, cp * c],
  ];
}

const LOW_PASS = 0.25; // px^2, keeps sub-pixel splats from vanishing

export function projectSplat(splat: Splat, R: Mat3, cam: Camera): ProjectedSplat | null {
  const p = [splat.position[0] - cam.target[0], splat.position[1] - cam.target[1], splat.position[2] - cam.target[2]] as const;
  const vx = R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2];
  const vy = R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2];
  const depth = R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2];

  // Sigma' = R diag(s^2) R^T, only the screen-facing 2x2 block matters.
  const s2 = [splat.scale[0] ** 2, splat.scale[1] ** 2, splat.scale[2] ** 2] as const;
  const cov = (i: 0 | 1, j: 0 | 1) => R[i][0] * R[j][0] * s2[0] + R[i][1] * R[j][1] * s2[1] + R[i][2] * R[j][2] * s2[2];
  const k = cam.pixelsPerUnit ** 2;
  const a = cov(0, 0) * k + LOW_PASS;
  const b = cov(0, 1) * k;
  const c = cov(1, 1) * k + LOW_PASS;
  const det = a * c - b * b;
  if (det <= 0) return null;

  return {
    x: cam.width / 2 + vx * cam.pixelsPerUnit,
    y: cam.height / 2 - vy * cam.pixelsPerUnit,
    depth,
    conic: [c / det, -b / det, a / det],
    radius: Math.ceil(3 * Math.sqrt(Math.max(a, c))),
    color: splat.color,
    opacity: splat.opacity,
  };
}
