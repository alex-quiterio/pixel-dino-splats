import { expect, test } from "bun:test";
import { buildDinoScene } from "@application/buildDinoScene";
import { renderPixelFrame } from "@application/renderPixelFrame";
import { paletteColors } from "@domain/palette";
import { encodePly } from "@infrastructure/ply/encodePly";
import { encodePng } from "@infrastructure/png/encodePng";

test("same seed grows the same dino", () => {
  expect(buildDinoScene(1).splats).toEqual(buildDinoScene(1).splats);
});

test("frames only contain palette colours (true pixel art)", () => {
  const scene = buildDinoScene(0);
  const f = renderPixelFrame(scene.splats, scene.palette, { width: 64, height: 64, yaw: 0.5 });
  const allowed = new Set(paletteColors(scene.palette).map((c) => c.join(",")));
  let opaque = 0;
  for (let i = 0; i < f.data.length; i += 4) {
    if (f.data[i + 3] === 0) continue;
    opaque++;
    expect(allowed.has(`${f.data[i]},${f.data[i + 1]},${f.data[i + 2]}`)).toBe(true);
  }
  expect(opaque).toBeGreaterThan(300);
});

test("ply has header + 17 floats per splat", () => {
  const scene = buildDinoScene(0);
  const ply = encodePly(scene.splats);
  const text = new TextDecoder().decode(ply.subarray(0, 600));
  expect(text.startsWith("ply\n")).toBe(true);
  expect(ply.length).toBe(text.indexOf("end_header\n") + 11 + scene.splats.length * 17 * 4);
});

test("png has signature", () => {
  expect(Array.from(encodePng(1, 1, new Uint8ClampedArray([0, 0, 0, 255])).subarray(0, 4))).toEqual([137, 80, 78, 71]);
});
