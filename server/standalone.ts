import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createFileStore } from "./store";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function safeJoin(root: string, requestPath: string) {
  const decoded = decodeURIComponent(requestPath.split("?")[0] ?? "/");
  const cleaned = path.posix.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.resolve(root, cleaned.replace(/^[/\\]+/, ""));
  if (!resolved.startsWith(path.resolve(root))) return null;
  return resolved;
}

function serveStatic(staticDir: string, url: string, res: http.ServerResponse) {
  const requested = url === "/" ? "/index.html" : url;
  let file = safeJoin(staticDir, requested);
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(staticDir, "index.html");
  }
  if (!fs.existsSync(file)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
  res.end(fs.readFileSync(file));
}

export function startLocalServer(options: {
  dataDir: string;
  staticDir: string;
  port?: number;
}) {
  const store = createFileStore(options.dataDir);
  store.ensureData();

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    if (url.split("?")[0]?.startsWith("/api")) {
      try {
        await store.handleApi(req, res);
      } catch (error) {
        store.sendJson(res, 500, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    serveStatic(options.staticDir, url, res);
  });

  return new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to bind local server"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((done, fail) => {
            server.close((error) => (error ? fail(error) : done()));
          }),
      });
    });
  });
}
