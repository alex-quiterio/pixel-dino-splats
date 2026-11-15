import type { Creature } from "@domain/creature";
import type { Palette } from "@domain/palette";
import type { Splat } from "@domain/splat";

export interface Scene {
  readonly creature: Creature;
  readonly seed: number;
  readonly palette: Palette;
  readonly splats: readonly Splat[];
}

export function buildScene(creature: Creature, seed: number): Scene {
  const palette = creature.palettes[Math.abs(seed) % creature.palettes.length]!;
  return { creature, seed, palette, splats: creature.build(seed, palette) };
}
