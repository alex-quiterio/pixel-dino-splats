import { buildScene } from "@application/buildScene";
import { renderScene } from "@application/renderScene";
import { penrose } from "@domain/creatures";
import { PENROSE_HOME } from "@domain/penrose";
import { encodePng } from "@infrastructure/png/encodePng";

// The app logo: the impossible triangle, seen from the one angle where it closes.
const size = 96;
const frame = renderScene(buildScene(penrose, 0), { size, yaw: PENROSE_HOME.yaw, pitch: PENROSE_HOME.pitch, t: 0 });
await Bun.write("assets/logo.png", encodePng(size, size, frame.data, 6));
await Bun.write("apps/web/logo.png", encodePng(size, size, frame.data, 2));
console.log("logo -> assets/logo.png, apps/web/logo.png");
