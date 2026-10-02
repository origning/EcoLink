# 部署方案说明

> 日常怎么更新线上，请看 **[更新流程.md](./更新流程.md)**；
> 服务器部署 / 备份 / 恢复的详细命令，看 **[deploy/README.md](./deploy/README.md)**。
> 本文只说明「现在部署在哪」和「可选托管方案」。

先分清两件事：

- **代码托管（GitHub / Gitee）**：只放源码。
- **网站托管**：把 `dist/` 放到能访问的地方，才得到一个链接。

---

## 当前线上：云服务器（共享数据）

| 项目 | 值 |
| --- | --- |
| 网站地址 | <https://ecolinkbuy.top/> |
| 服务器 | 腾讯云 香港轻量应用服务器（Ubuntu 24.04） |
| 反向代理 | Nginx + HTTPS（Let's Encrypt 自动续期） |
| 应用 | Node 服务（PM2 守护）+ 静态 `dist/` |
| 数据 | 服务器 `data/`：`db.json`、`auth.json`、`images/`，**所有登录用户共享** |
| 登录 | 账号密码（管理员 / 录入员） |
| 备份 | 每日 03:30 自动打包，保留 30 天 |
| 代码仓库 | GitHub `origning/EcoLink` + Gitee `xieyuan123/eco-link`（仅源码备份） |

部署与运维命令见 [`deploy/README.md`](deploy/README.md)。
改存储 / 接口时还要同步 [`SYSTEM.md`](SYSTEM.md) 第 3、4 节。

---

## 构建产物

Vite + React 单页应用，`npm run build:web` 得到静态 `dist/`。
云端由 Nginx 托管 `dist/`，同域名的 `/api/*` 转发给 Node 服务。

---

## 可选：静态托管（设备模式，数据不共享）

把 `dist/` 放到纯静态托管上（GitHub Pages / Netlify / Cloudflare Pages / 对象存储），
此时没有 `/api/db`，网站进入「**设备模式**」：

- 数据存在**每台设备各自的浏览器**（IndexedDB），**互不同步**；
- **没有登录**。

适合当离线兜底或演示，**不适合团队共享**。正式使用请访问云服务器地址。

| 平台 | 做法 |
| --- | --- |
| GitHub Pages | 推送到 `main` 自动构建发布（工作流 `.github/workflows/deploy-pages.yml`） |
| Netlify | 把 `dist/` 拖到 <https://app.netlify.com/drop> |
| Cloudflare Pages | 连 GitHub，或上传 `dist/` |
| 对象存储 | 开启「静态网站托管」，上传 `dist/`（自定义域名通常要备案） |

通用配置：Build `npm run build:web`，输出目录 `dist`，Node 20。

> 目前 GitHub 仓库推送到 `main` 会自动发布到 <https://origning.github.io/EcoLink/>，
> 作为**离线 / 演示**用途保留。

---

## 手机端注意事项

- **添加到主屏幕（PWA）**需要 **HTTPS**：云服务器地址满足。
- **更新后看不到新版**：手机有 Service Worker 缓存，多刷新一两次或重开页面。
- **路由**：用 `HashRouter`，任何静态托管都不会 404。
- **数据**：云端登录后共享；静态站是设备本地数据，换设备前先导出备份。
