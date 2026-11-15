import type { Scene } from "@application/buildScene";
import { renderPixelFrame, type PixelFrame } from "@application/renderPixelFrame";

export interface View {
  readonly size: number;
  readonly yaw: number;
  readonly pitch?: number;
  readonly zoom?: number;
  readonly t: number;
}

/** One animated frame of a scene, using the creature's own camera framing. */
export function renderScene(scene: Scene, v: View): PixelFrame {
  const { target, span, pitch } = scene.creature.view;
  return renderPixelFrame(scene.creature.pose(scene.splats, v.t), scene.palette, {
    width: v.size,
    height: v.size,
    yaw: v.yaw,
    pitch: v.pitch ?? pitch,
    zoom: v.zoom,
    target,
    span,
  });
}
