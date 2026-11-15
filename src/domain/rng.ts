import type { Vec3 } from "@domain/vec3";

export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  onSphere(): Vec3;
}

/** mulberry32: tiny deterministic PRNG so the same seed always grows the same dino. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    onSphere: () => {
      const z = next() * 2 - 1;
      const phi = next() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return [r * Math.cos(phi), z, r * Math.sin(phi)];
    },
  };
}
