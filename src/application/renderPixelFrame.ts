import { projectSplat, viewRotation, type Camera, type ProjectedSplat } from "@domain/gaussianProjection";
import { nearestColor, paletteColors, type Palette } from "@domain/palette";
import type { Splat } from "@domain/splat";

export interface PixelFrame {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, un-premultiplied. */
  readonly data: Uint8ClampedArray;
}

export interface RenderOptions {
  readonly width: number;
  readonly height: number;
  readonly yaw: number;
  readonly pitch?: number;
  readonly zoom?: number;
  /** World point at the centre of the frame, and how many world units the frame width spans. */
  readonly target?: readonly [number, number, number];
  readonly span?: number;
}

/**
 * Software gaussian-splat rasteriser at pixel-art resolution:
 * project -> depth sort -> alpha-blend gaussians -> snap to palette -> outline.
 */
export function renderPixelFrame(splats: readonly Splat[], palette: Palette, opts: RenderOptions): PixelFrame {
  const { width, height } = opts;
  const camera: Camera = {
    yaw: opts.yaw,
    pitch: opts.pitch ?? 0.18,
    target: opts.target ?? [-1.2, 2.1, 0],
    pixelsPerUnit: (width / (opts.span ?? 12.6)) * (opts.zoom ?? 1),
    width,
    height,
  };
  const R = viewRotation(camera.yaw, camera.pitch);
  const projected: ProjectedSplat[] = [];
  for (const s of splats) {
    const p = projectSplat(s, R, camera);
    if (p) projected.push(p);
  }
  projected.sort((a, b) => a.depth - b.depth); // far first

  const rgb = new Float32Array(width * height * 3);
  const alpha = new Float32Array(width * height);
  for (const p of projected) {
    const x0 = Math.max(0, Math.floor(p.x - p.radius));
    const x1 = Math.min(width - 1, Math.ceil(p.x + p.radius));
    const y0 = Math.max(0, Math.floor(p.y - p.radius));
    const y1 = Math.min(height - 1, Math.ceil(p.y + p.radius));
    const [ca, cb, cc] = p.conic;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        const a = p.opacity * Math.exp(-0.5 * (ca * dx * dx + 2 * cb * dx * dy + cc * dy * dy));
        if (a < 1 / 255) continue;
        const i = y * width + x;
        const keep = 1 - a;
        rgb[i * 3] = rgb[i * 3]! * keep + p.color[0] * a;
        rgb[i * 3 + 1] = rgb[i * 3 + 1]! * keep + p.color[1] * a;
        rgb[i * 3 + 2] = rgb[i * 3 + 2]! * keep + p.color[2] * a;
        alpha[i] = alpha[i]! * keep + a;
      }
    }
  }

  // Quantise to the palette, hard-threshold alpha: this is what makes it pixel art.
  const colors = paletteColors(palette);
  const data = new Uint8ClampedArray(width * height * 4);
  const water = new Uint8Array(width * height);
  const isWater = (c: readonly number[]) => palette.extras.some((e) => e[0] === c[0] && e[1] === c[1] && e[2] === c[2]);
  const solid = (i: number) => alpha[i]! >= 0.5;
  // Only the creature casts an outline; rain and puddle stay outline-free.
  const caster = (i: number) => solid(i) && !water[i];
  for (let i = 0; i < width * height; i++) {
    if (!solid(i)) continue;
    const a = alpha[i]!;
    const c = nearestColor(colors, rgb[i * 3]! / a, rgb[i * 3 + 1]! / a, rgb[i * 3 + 2]! / a);
    data.set([c[0], c[1], c[2], 255], i * 4);
    if (isWater(c)) water[i] = 1;
  }
  // 1px outline around the silhouette.
  const o = palette.outline;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (solid(i)) continue;
      const near =
        (x > 0 && caster(i - 1)) || (x < width - 1 && caster(i + 1)) || (y > 0 && caster(i - width)) || (y < height - 1 && caster(i + width));
      if (near) data.set([o[0], o[1], o[2], 255], i * 4);
    }
  }
  return { width, height, data };
}
