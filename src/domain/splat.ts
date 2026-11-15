import type { Rgb } from "@domain/palette";
import type { Vec3 } from "@domain/vec3";

/** One axis-aligned 3D gaussian: a soft coloured blob in space. */
export interface Splat {
  readonly position: Vec3;
  /** Standard deviation along each world axis. */
  readonly scale: Vec3;
  readonly color: Rgb;
  readonly opacity: number;
  /** Optional skinning-lite: which limb/element this splat belongs to and how far along it (0..1). */
  readonly rig?: { readonly group: number; readonly weight: number };
}
