import { pose } from "@domain/animation";
import { buildDinoScene } from "@application/buildDinoScene";
import { renderPixelFrame } from "@application/renderPixelFrame";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("view");
const ctx = canvas.getContext("2d")!;

let seed = 0;
let scene = buildDinoScene(seed);
let size = 96;
let yaw = 0.35;
let spinning = true;
let dragging = false;
let lastX = 0;

function labels() {
  $("count").textContent = String(scene.splats.length);
  $("name").textContent = `colorway: ${scene.palette.name}`;
}

function draw(t: number) {
  const frame = renderPixelFrame(pose(scene.splats, t), scene.palette, { width: size, height: size, yaw });
  canvas.width = size;
  canvas.height = size;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), size, size), 0, 0);
}

let prev = performance.now();
function tick(now: number) {
  if (spinning && !dragging) yaw += ((now - prev) / 1000) * 0.9;
  prev = now;
  draw(now / 1000);
  requestAnimationFrame(tick);
}

canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.012;
  lastX = e.clientX;
});
const stop = () => (dragging = false);
canvas.addEventListener("pointerup", stop);
canvas.addEventListener("pointercancel", stop);

$("spin").addEventListener("click", (e) => {
  spinning = !spinning;
  (e.currentTarget as HTMLElement).setAttribute("aria-pressed", String(spinning));
});
$("reroll").addEventListener("click", () => {
  scene = buildDinoScene(++seed);
  labels();
});
$<HTMLSelectElement>("res").addEventListener("change", (e) => {
  size = Number((e.currentTarget as HTMLSelectElement).value);
});

labels();
requestAnimationFrame(tick);
