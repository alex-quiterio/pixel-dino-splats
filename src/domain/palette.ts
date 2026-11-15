export type Rgb = readonly [number, number, number];

/** Each ramp runs dark -> light; the cel-shading band picks the index. */
export interface Palette {
  readonly name: string;
  readonly body: readonly Rgb[];
  readonly belly: readonly Rgb[];
  readonly plate: readonly Rgb[];
  readonly outline: Rgb;
  readonly eyeWhite: Rgb;
  readonly pupil: Rgb;
}

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const ramp = (...hs: string[]) => hs.map(hex);

const common = { outline: hex("#1b1226"), eyeWhite: hex("#fff8e7"), pupil: hex("#14081c") };

export const PALETTES: readonly Palette[] = [
  {
    name: "moss",
    body: ramp("#27593a", "#3a8a4c", "#5cb85c", "#93dd6e"),
    belly: ramp("#a8935a", "#cdbb80", "#e9dba4", "#fff3c4"),
    plate: ramp("#8f2d1f", "#c4472a", "#ee7a34", "#ffb347"),
    ...common,
  },
  {
    name: "lagoon",
    body: ramp("#1c4f6b", "#2a7f9a", "#40b0b8", "#7fe0cf"),
    belly: ramp("#a8827a", "#d1a995", "#ebc9ae", "#ffe6c9"),
    plate: ramp("#6a2a73", "#a23f9c", "#d765b8", "#ff9fd6"),
    ...common,
  },
  {
    name: "grape",
    body: ramp("#3b2a6b", "#5b43a3", "#8467d1", "#b99cf2"),
    belly: ramp("#9d7f9a", "#c8a6b8", "#e8c9cf", "#fde4dc"),
    plate: ramp("#9c5a14", "#d08a1e", "#f2bd2f", "#ffe36b"),
    ...common,
  },
  {
    name: "ember",
    body: ramp("#7a2a24", "#b44a2b", "#e07a35", "#f7b45a"),
    belly: ramp("#a87a5a", "#d3a679", "#ecca9a", "#fff0c8"),
    plate: ramp("#2a2f55", "#3f5aa0", "#5f8ae0", "#9fc3ff"),
    ...common,
  },
];

export const paletteFor = (seed: number): Palette => PALETTES[Math.abs(seed) % PALETTES.length]!;

export const paletteColors = (p: Palette): Rgb[] => [
  ...p.body,
  ...p.belly,
  ...p.plate,
  p.outline,
  p.eyeWhite,
  p.pupil,
];

export function nearestColor(colors: readonly Rgb[], r: number, g: number, b: number): Rgb {
  let best = colors[0]!;
  let bestD = Infinity;
  for (const c of colors) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
