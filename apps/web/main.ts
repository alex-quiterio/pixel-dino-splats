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
let pitch = 0.18;
let zoom = 1;
let spinning = true;
let dragging = false;
let lastX = 0;
let lastY = 0;

function labels() {
  $("count").textContent = String(scene.splats.length);
  $("name").textContent = `colorway: ${scene.palette.name}`;
}

function draw(t: number) {
  const frame = renderPixelFrame(pose(scene.splats, t), scene.palette, { width: size, height: size, yaw, pitch, zoom });
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
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.012;
  pitch = Math.min(1.3, Math.max(-0.3, pitch + (e.clientY - lastY) * 0.01));
  lastX = e.clientX;
  lastY = e.clientY;
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

const zoomInput = $<HTMLInputElement>("zoom");
const setZoom = (z: number) => {
  zoom = Math.min(2.2, Math.max(0.6, z));
  zoomInput.value = String(zoom);
};
zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value)));
canvas.addEventListener("wheel", (e) => { e.preventDefault(); setZoom(zoom - e.deltaY * 0.001); }, { passive: false });
$("reset").addEventListener("click", () => { yaw = 0.35; pitch = 0.18; setZoom(1); });
window.addEventListener("keydown", (e) => {
  const step = 0.12;
  if (e.key === "ArrowLeft") yaw -= step;
  else if (e.key === "ArrowRight") yaw += step;
  else if (e.key === "ArrowUp") pitch = Math.min(1.3, pitch + step);
  else if (e.key === "ArrowDown") pitch = Math.max(-0.3, pitch - step);
  else if (e.key === "+" || e.key === "=") setZoom(zoom + 0.1);
  else if (e.key === "-") setZoom(zoom - 0.1);
});

labels();
requestAnimationFrame(tick);
