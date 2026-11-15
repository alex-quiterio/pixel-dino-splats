import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { buildScene } from "@application/buildScene";
import { creatureById } from "@domain/creatures";
import { renderTurntable } from "@application/renderTurntable";
import { encodePly } from "@infrastructure/ply/encodePly";
import { encodePng } from "@infrastructure/png/encodePng";

const { values } = parseArgs({
  options: {
    creature: { type: "string", default: "trex" },
    seed: { type: "string", default: "0" },
    size: { type: "string", default: "128" },
    frames: { type: "string", default: "8" },
    scale: { type: "string", default: "4" },
    out: { type: "string", default: "out" },
  },
});

const seed = Number(values.seed);
const size = Number(values.size);
const frames = Number(values.frames);
const scene = buildScene(creatureById(values.creature!), seed);
const sheet = renderTurntable(scene, size, frames);

await mkdir(values.out!, { recursive: true });
await Bun.write(`${values.out}/${scene.creature.id}-${scene.palette.name}.png`, encodePng(sheet.width, sheet.height, sheet.data, Number(values.scale)));
await Bun.write(`${values.out}/${scene.creature.id}-${scene.palette.name}.ply`, encodePly(scene.splats));
console.log(`${scene.splats.length} splats, ${frames} frames @ ${size}px -> ${values.out}/${scene.creature.id}-${scene.palette.name}.{png,ply}`);
