import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Copies the Vite build output (dist/) into docs/ so it can be published by
// static hosts that deploy straight from a repository directory, such as
// Gitee Pages (部署目录 = /docs).
//
// Usage: npm run build:gitee

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const out = path.join(root, "docs");

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("没有 dist/。请先执行 npm run build:web");
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(dist, out, { recursive: true });

// Keeps Jekyll-style hosts from post-processing the output.
fs.writeFileSync(path.join(out, ".nojekyll"), "");

console.log("构建完成，已复制到 docs/");
console.log("下一步：提交 docs/，再到 Gitee 仓库 → 服务 → Gitee Pages，分支选 main，部署目录填 /docs。");
