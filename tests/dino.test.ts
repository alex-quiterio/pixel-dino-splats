import { expect, test } from "bun:test";
import { buildScene } from "@application/buildScene";
import { renderScene } from "@application/renderScene";
import { CREATURES } from "@domain/creatures";
import { paletteColors } from "@domain/palette";
import { encodePly } from "@infrastructure/ply/encodePly";
import { encodePng } from "@infrastructure/png/encodePng";

for (const creature of CREATURES) {
  test(`${creature.id}: same seed grows the same creature`, () => {
    expect(buildScene(creature, 1).splats).toEqual(buildScene(creature, 1).splats);
  });

  test(`${creature.id}: frames only contain palette colours (true pixel art)`, () => {
    const scene = buildScene(creature, 0);
    const f = renderScene(scene, { size: 64, yaw: 0.5, t: 0.7 });
    const allowed = new Set(paletteColors(scene.palette).map((c) => c.join(",")));
    let opaque = 0;
    for (let i = 0; i < f.data.length; i += 4) {
      if (f.data[i + 3] === 0) continue;
      opaque++;
      expect(allowed.has(`${f.data[i]},${f.data[i + 1]},${f.data[i + 2]}`)).toBe(true);
    }
    expect(opaque).toBeGreaterThan(300);
  });

  test(`${creature.id}: pose is a pure function of time`, () => {
    const { splats } = buildScene(creature, 0);
    expect(creature.pose(splats, 1.3)).toEqual(creature.pose(splats, 1.3));
  });
}

test("ply has header + 17 floats per splat", () => {
  const scene = buildScene(CREATURES[0]!, 0);
  const ply = encodePly(scene.splats);
  const text = new TextDecoder().decode(ply.subarray(0, 600));
  expect(text.startsWith("ply\n")).toBe(true);
  expect(ply.length).toBe(text.indexOf("end_header\n") + 11 + scene.splats.length * 17 * 4);
});

test("png has signature", () => {
  expect(Array.from(encodePng(1, 1, new Uint8ClampedArray([0, 0, 0, 255])).subarray(0, 4))).toEqual([137, 80, 78, 71]);
});
