import { buildScene } from "@application/buildScene";
import { renderScene } from "@application/renderScene";
import { CREATURES } from "@domain/creatures";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("view");
const ctx = canvas.getContext("2d")!;
const frameEl = $("frame");

let creature = CREATURES[0]!;
let seed = 0;
let scene = buildScene(creature, seed);
let size = 128;
let yaw = 0.35;
let pitch = creature.view.pitch;
let zoom = 1;
let spinning = true;
let dragging = false;
let lastX = 0;
let lastY = 0;

function labels() {
  $("count").textContent = String(scene.splats.length);
  $("name").textContent = `colorway: ${scene.palette.name}`;
  $("title").textContent = `pixel ${creature.name.toLowerCase()} splats`;
  frameEl.dataset.creature = creature.id;
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-creature]")) {
    if (b.id !== "frame") b.setAttribute("aria-pressed", String(b.dataset.creature === creature.id));
  }
}

let lastPixelText = "";
let smoothMs = 0;
let lastMsTick = -1;
function showPixels(data: Uint8ClampedArray) {
  let lit = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) lit++;
  const text = `${size}×${size} = ${(size * size).toLocaleString()} px (${lit.toLocaleString()} lit)`;
  if (text !== lastPixelText) {
    $("pixels").textContent = text;
    lastPixelText = text;
  }
}

function draw(t: number) {
  const t0 = performance.now();
  const frame = renderScene(scene, { size, yaw, pitch, zoom, t });
  canvas.width = size;
  canvas.height = size;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.data), size, size), 0, 0);
  showPixels(frame.data);
  smoothMs = smoothMs * 0.9 + (performance.now() - t0) * 0.1;
  if (Math.round(t * 2) !== lastMsTick) {
    lastMsTick = Math.round(t * 2);
    $("ms").textContent = `${Math.round(smoothMs)} ms/frame`;
  }
}

let prev = performance.now();
function tick(now: number) {
  if (spinning && !dragging) yaw += ((now - prev) / 1000) * 0.9;
  prev = now;
  draw(now / 1000);
  requestAnimationFrame(tick);
}

const clampPitch = (p: number) => Math.min(1.3, Math.max(-0.3, p));
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.012;
  pitch = clampPitch(pitch + (e.clientY - lastY) * 0.01);
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
  scene = buildScene(creature, ++seed);
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
const resetView = () => { yaw = 0.35; pitch = creature.view.pitch; setZoom(1); };
$("reset").addEventListener("click", resetView);
window.addEventListener("keydown", (e) => {
  const step = 0.12;
  if (e.key === "ArrowLeft") yaw -= step;
  else if (e.key === "ArrowRight") yaw += step;
  else if (e.key === "ArrowUp") pitch = clampPitch(pitch + step);
  else if (e.key === "ArrowDown") pitch = clampPitch(pitch - step);
  else if (e.key === "+" || e.key === "=") setZoom(zoom + 0.1);
  else if (e.key === "-") setZoom(zoom - 0.1);
});

const picker = $("picker");
for (const c of CREATURES) {
  const b = document.createElement("button");
  b.textContent = c.name;
  b.dataset.creature = c.id;
  b.addEventListener("click", () => {
    creature = c;
    seed = 0;
    scene = buildScene(creature, seed);
    resetView();
    labels();
  });
  picker.append(b);
}

labels();
requestAnimationFrame(tick);
