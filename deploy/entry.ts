// EcoLink 云服务器入口（复用现有 server/standalone.ts）。
//
// 启动服务：
//   node server.cjs
//
// 管理命令：
//   node server.cjs create-admin <账号> <密码>     # 创建首个管理员
//   node server.cjs reset-password <账号> <新密码> # 忘记密码时重置
//
// 环境变量：
//   PORT                 监听端口，默认 3000（仅本机）
//   ECOLINK_DATA_DIR     数据目录，默认 <cwd>/data
//   ECOLINK_STATIC_DIR   前端 dist 目录，默认 <cwd>/dist
//   ECOLINK_AUTH=1       开启账号密码登录（云端必开；本地默认关闭）

import path from "node:path";
import { createAuthStore } from "../server/authStore";
import { startLocalServer } from "../server/standalone";

const port = Number(process.env.PORT ?? 3000);
const dataDir = path.resolve(
  process.env.ECOLINK_DATA_DIR ?? path.join(process.cwd(), "data"),
);
const staticDir = path.resolve(
  process.env.ECOLINK_STATIC_DIR ?? path.join(process.cwd(), "dist"),
);
const authEnabled = process.env.ECOLINK_AUTH === "1";

const [, , command, arg1, arg2] = process.argv;

function runAdminCommand(): boolean {
  if (command !== "create-admin" && command !== "reset-password") return false;
  if (!arg1 || !arg2) {
    console.error(`用法：node server.cjs ${command} <账号> <密码>`);
    process.exit(1);
  }
  const auth = createAuthStore(dataDir);
  if (command === "create-admin") {
    const user = auth.createUser(arg1, arg2, "admin");
    console.log(`已创建管理员：${user.username}`);
  } else {
    const user = auth.findByUsername(arg1);
    if (!user) {
      console.error(`用户不存在：${arg1}`);
      process.exit(1);
    }
    auth.setPassword(user.id, arg2);
    console.log(`已重置密码：${user.username}`);
  }
  process.exit(0);
}

if (!runAdminCommand()) {
  if (authEnabled && !createAuthStore(dataDir).hasUsers()) {
    console.warn(
      "[ecolink] 已开启登录，但还没有任何账号。请先执行：node server.cjs create-admin <账号> <密码>",
    );
  }

  startLocalServer({ dataDir, staticDir, port, auth: authEnabled })
    .then((info) => {
      console.log(`[ecolink] server ready at http://127.0.0.1:${info.port}`);
      console.log(`[ecolink] auth: ${authEnabled ? "enabled" : "disabled"}`);
      console.log(`[ecolink] data dir: ${dataDir}`);
    })
    .catch((error) => {
      console.error("[ecolink] failed to start:", error);
      process.exit(1);
    });
}
