import { build } from "./build";

await build();
const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(`dist${path === "/" ? "/index.html" : path}`);
    return file.size ? new Response(file) : new Response("not found", { status: 404 });
  },
});
console.log(`http://localhost:${server.port}`);
