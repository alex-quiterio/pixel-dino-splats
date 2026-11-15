import type { Splat } from "@domain/splat";

const SH_C0 = 0.28209479177387814;
const PROPS = [
  "x", "y", "z", "nx", "ny", "nz", "f_dc_0", "f_dc_1", "f_dc_2",
  "opacity", "scale_0", "scale_1", "scale_2", "rot_0", "rot_1", "rot_2", "rot_3",
];

/** Standard 3D Gaussian Splatting .ply, loadable in common splat viewers. */
export function encodePly(splats: readonly Splat[]): Uint8Array {
  const header =
    `ply\nformat binary_little_endian 1.0\nelement vertex ${splats.length}\n` +
    PROPS.map((p) => `property float ${p}`).join("\n") +
    "\nend_header\n";
  const head = new TextEncoder().encode(header);
  const out = new Uint8Array(head.length + splats.length * PROPS.length * 4);
  out.set(head);
  const view = new DataView(out.buffer);
  let off = head.length;
  for (const s of splats) {
    const o = Math.min(0.999, Math.max(0.001, s.opacity));
    const vals = [
      s.position[0], -s.position[1], s.position[2], 0, 0, 0, // y flipped: 3DGS is y-down
      ...s.color.map((c) => (c / 255 - 0.5) / SH_C0),
      Math.log(o / (1 - o)),
      ...s.scale.map(Math.log),
      1, 0, 0, 0,
    ];
    for (const v of vals) {
      view.setFloat32(off, v, true);
      off += 4;
    }
  }
  return out;
}
