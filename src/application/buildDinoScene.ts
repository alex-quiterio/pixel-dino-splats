import { buildDinosaur } from "@domain/dinosaur";
import { paletteFor, type Palette } from "@domain/palette";
import type { Splat } from "@domain/splat";

export interface DinoScene {
  readonly seed: number;
  readonly palette: Palette;
  readonly splats: readonly Splat[];
}

export function buildDinoScene(seed: number): DinoScene {
  const palette = paletteFor(seed);
  return { seed, palette, splats: buildDinosaur(seed, palette) };
}
