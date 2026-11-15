import type { Splat } from "@domain/splat";

/** Idle motion: tail swishes, head bobs. Pure function of time, so frames are reproducible. */
export function pose(splats: readonly Splat[], t: number): Splat[] {
  return splats.map((s) => {
    const [x, y, z] = s.position;
    let dz = 0;
    let dy = 0;
    if (x < -1.2) {
      const k = (-1.2 - x) / 4;
      dz = Math.sin(t * 2.2 - x * 0.9) * 0.45 * k * k * 2;
    }
    if (x > 1.4) dy = Math.sin(t * 2.2 + 0.6) * 0.05 * (x - 1.4);
    if (dz === 0 && dy === 0) return s;
    return { ...s, position: [x, y + dy, z + dz] };
  });
}
