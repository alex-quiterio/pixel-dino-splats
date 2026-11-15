import { cp, mkdir, rm } from "node:fs/promises";

export async function build(outdir = "dist") {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  const result = await Bun.build({ entrypoints: ["apps/web/main.ts"], outdir, target: "browser", minify: true });
  if (!result.success) throw new Error(result.logs.join("\n"));
  await cp("apps/web/index.html", `${outdir}/index.html`);
  await cp("apps/web/styles", `${outdir}/styles`, { recursive: true });
}

if (import.meta.main) {
  await build();
  console.log("built -> dist/");
}
