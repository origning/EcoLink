import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT || 4173);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error("没有 dist/。请先执行 npm run build:web");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  let file = path.normalize(path.join(root, requested));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(root, "index.html");
  }
  const ext = path.extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", mime[ext] ?? "application/octet-stream");
  res.end(fs.readFileSync(file));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`静态网站（设备本地存盘）: http://localhost:${port}`);
  console.log("电脑和手机打开后，数据各存在自己的浏览器里，互不同步。");
});
