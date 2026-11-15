import { MOUTH_X, MOUTH_Y } from "@domain/trex";
import type { Splat } from "@domain/splat";

/**
 * Idle motion as a pure function of time t (radians-ish):
 * tail swishes, head bobs, jaw opens in a slow roar.
 */
export function poseTRex(splats: readonly Splat[], t: number): Splat[] {
  const open = 0.3 + 0.7 * Math.max(0, Math.sin(t * 1.8)) ** 2; // always snarling, periodically roaring
  return splats.map((s) => {
    const [x, y, z] = s.position;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (x < -2.2) {
      const k = (-2.2 - x) / 4.5;
      dz = Math.sin(t * 2.2 - x * 0.8) * 0.9 * k * k;
    }
    if (x > 2.2) dy += Math.sin(t * 2.2 + 0.6) * 0.05 * (x - 2.2);
    if (x > MOUTH_X && y < MOUTH_Y + 0.02) {
      const f = Math.min(1, (x - MOUTH_X) / 1.2);
      dy -= open * 0.7 * f;
      dx -= open * 0.14 * f;
    }
    if (dx === 0 && dy === 0 && dz === 0) return s;
    return { ...s, position: [x + dx, y + dy, z + dz] };
  });
}
