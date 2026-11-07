import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { handleApi } from "./router.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.OPS_PORT ?? 5180);
const runtime: { vite?: ViteDevServer } = {};

const server = createServer((req, res) => {
  void (async () => {
    try {
      const url = req.url ?? "/";
      if (url.startsWith("/api/")) {
        await handleApi(req, res);
        return;
      }
      const vite = runtime.vite;
      if (!vite) {
        res.statusCode = 503;
        res.end("Starting");
        return;
      }
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
    } catch (error) {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : "Request failed.");
    }
  })();
});

runtime.vite = await createViteServer({
  root,
  appType: "spa",
  plugins: [react()],
  server: { middlewareMode: true, hmr: { server } },
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Production console http://127.0.0.1:${port}`);
});
