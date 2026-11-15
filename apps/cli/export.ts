import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildDinoScene } from "@application/buildDinoScene";
import { renderTurntable } from "@application/renderTurntable";
import { encodePly } from "@infrastructure/ply/encodePly";
import { encodePng } from "@infrastructure/png/encodePng";

const { values } = parseArgs({
  options: {
    seed: { type: "string", default: "0" },
    size: { type: "string", default: "96" },
    frames: { type: "string", default: "8" },
    scale: { type: "string", default: "4" },
    out: { type: "string", default: "out" },
  },
});

const seed = Number(values.seed);
const size = Number(values.size);
const frames = Number(values.frames);
const scene = buildDinoScene(seed);
const sheet = renderTurntable(scene, size, frames);

await mkdir(values.out!, { recursive: true });
await Bun.write(`${values.out}/dino-${scene.palette.name}.png`, encodePng(sheet.width, sheet.height, sheet.data, Number(values.scale)));
await Bun.write(`${values.out}/dino-${scene.palette.name}.ply`, encodePly(scene.splats));
console.log(`${scene.splats.length} splats, ${frames} frames @ ${size}px -> ${values.out}/dino-${scene.palette.name}.{png,ply}`);
