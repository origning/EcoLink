import path from "node:path";
import type { Connect, Plugin } from "vite";
import { createFileStore } from "./store";

export function fileApiPlugin(): Plugin {
  const store = createFileStore(path.resolve(process.cwd(), "data"));

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url?.split("?")[0] ?? "";
    if (!url.startsWith("/api")) {
      next();
      return;
    }
    try {
      await store.handleApi(req, res);
    } catch (error) {
      store.sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    name: "file-api",
    configResolved() {
      store.ensureData();
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
