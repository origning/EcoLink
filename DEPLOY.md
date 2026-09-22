# 部署成网页（手机通过链接访问）

先分清两件事：

- **Gitee / GitHub 是「代码托管」**：只放源码，别人点开是代码，不是网站。
- **静态托管才是「网站」**：把构建出来的 `dist/` 放到静态托管上，才会得到一个链接。

这个项目是 Vite + React 单页应用，构建一次就能得到纯静态的 `dist/`，放哪儿都行。

> ⚠️ 静态托管下没有后端，网站进入「**设备模式**」：数据存在**每台设备自己的浏览器**
> （IndexedDB）里，**互不同步**。多台设备之间搬数据，用「数据」页的**导出/导入备份**。

---

## 方案一：Gitee Pages（码云 Pages）

**前提**：Gitee 账号完成**实名认证**，且仓库设置为**公开**（免费版要求）。

### 1. 一键构建到 `docs/`

```bash
npm install
npm run build:gitee
```

`build:gitee` = `tsc --noEmit && vite build`，然后把 `dist/` 复制到 `docs/`。
（Gitee Pages 可以直接把 `docs/` 目录作为网站根目录。）

### 2. 提交并推送到 Gitee

```bash
git init
git add .
git commit -m "site"
git branch -M main
git remote add origin https://gitee.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 3. 打开 Gitee Pages

在 Gitee 仓库页面顶部菜单 **服务 → Gitee Pages**：

| 选项 | 填 |
| --- | --- |
| 部署分支 | `main` |
| 部署目录 | `/docs` |

点「**启动**」，稍等片刻，网址形如：

```
https://<用户名>.gitee.io/<仓库名>/
```

手机浏览器打开即可，可「添加到主屏幕」。

### 4. 以后更新

改完代码后重新执行：

```bash
npm run build:gitee
git add -A
git commit -m "update"
git push
```

然后回到 **服务 → Gitee Pages**，点一次「**更新**」。
免费版**不支持自动部署**，每次都要手动点一下。

> 如果在仓库里**看不到「Gitee Pages」入口**，说明当前账号/仓库不满足条件
> （一般是未实名认证，或该服务对免费账号有限制）。那就用方案二。

---

## 方案二：其它静态托管

构建产物同样是 `docs/`（或 `dist/`），可以直接上传：

| 平台 | 做法 | 备注 |
| --- | --- | --- |
| **Cloudflare Pages** | 直接上传文件夹，或连 GitHub/GitLab | 免费、自带 HTTPS |
| **Netlify** | 打开 `app.netlify.com/drop` 把 `dist/` 拖进去 | 免登录可临时预览 |
| **Vercel** | 装 CLI 后 `npx vercel --prod` | 从本机直接传，不需要 Git 平台 |
| **阿里云 OSS / 腾讯云 COS 等** | 开启「静态网站托管」，上传 `dist/` | 想用自己的域名访问通常要**域名备案** |

用 Git 平台连接的通用配置：

| 项 | 值 |
| --- | --- |
| Build command | `npm run build:web` |
| Output / Publish directory | `dist`（或 `docs`） |
| Node version | 20 |

---

## 方案三：GitHub Pages（以后有了 GitHub 再用）

仓库里已经放好了自动部署工作流 `.github/workflows/deploy-pages.yml`：
推送到 `main` 后，到仓库 **Settings → Pages → Source** 选 **GitHub Actions** 即可自动发布。

---

## 手机端注意事项

- **添加到主屏幕（PWA）**：需要 **HTTPS**。Gitee Pages、Cloudflare、Netlify、Vercel 默认都是 HTTPS。
- **数据在浏览器里**：清浏览器数据 / 换手机 / 换浏览器，数据都不会跟着走，请定期到「数据」页**导出备份**。
- **更新后看不到新版**：手机有 Service Worker 缓存，多刷新一两次或重开页面即可。
- **路由**：用的是 `HashRouter`，网址形如 `.../#/orders`，任何静态托管都不会 404，无需额外配置。
