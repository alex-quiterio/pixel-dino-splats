import type { Scene } from "@application/buildScene";
import type { PixelFrame } from "@application/renderPixelFrame";
import { renderScene } from "@application/renderScene";

/** Renders `frames` evenly spaced rotations (with idle animation) as one horizontal sprite sheet. */
export function renderTurntable(scene: Scene, size: number, frames: number): PixelFrame {
  const sheet = new Uint8ClampedArray(size * frames * size * 4);
  for (let f = 0; f < frames; f++) {
    const t = (f / frames) * Math.PI * 2;
    const frame = renderScene(scene, { size, yaw: t, t });
    for (let y = 0; y < size; y++) {
      sheet.set(frame.data.subarray(y * size * 4, (y + 1) * size * 4), (y * size * frames + f * size) * 4);
    }
  }
  return { width: size * frames, height: size, data: sheet };
}
