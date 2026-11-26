import type { Palette } from "@domain/palette";
import type { Splat } from "@domain/splat";
import type { Vec3 } from "@domain/vec3";

/** Everything the renderer and apps need to know about one animal. */
export interface Creature {
  readonly id: string;
  readonly name: string;
  /** A short, silly line in the creature's voice, shown under the viewer. */
  readonly quote: string;
  readonly palettes: readonly Palette[];
  build(seed: number, palette: Palette): Splat[];
  /** Pure function of time: same t, same pose. */
  pose(splats: readonly Splat[], t: number): Splat[];
  readonly view: { readonly target: Vec3; readonly span: number; readonly pitch: number };
}
