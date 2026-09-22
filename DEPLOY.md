# 部署方案说明

> 日常怎么更新网站，请看 **[更新流程.md](./更新流程.md)**。
> 本文只说明「为什么这样部署」以及「换托管时的可选方案」。

先分清两件事：

- **Gitee / GitHub 是「代码托管」**：只放源码，别人点开是代码，不是网站。
- **静态托管才是「网站」**：把构建出来的 `dist/` 放到静态托管上，才会得到一个链接。

这个项目是 Vite + React 单页应用，构建一次就能得到纯静态的 `dist/`，放哪儿都行。

> ⚠️ 静态托管下没有后端，网站进入「**设备模式**」：数据存在**每台设备自己的浏览器**
> （IndexedDB）里，**互不同步**。多台设备之间搬数据，用「数据」页的**导出/导入备份**。

---

## 当前方案：GitHub Pages（自动部署）

| 项目 | 值 |
| --- | --- |
| 网站地址 | <https://origning.github.io/EcoLink/> |
| 仓库 | <https://github.com/origning/EcoLink> |
| 触发方式 | 推送到 `main` 分支自动构建发布 |
| 工作流 | `.github/workflows/deploy-pages.yml` |

构建配置：Build `npm run build:web`，输出目录 `dist`，Node 20。

---

## 为什么不用 Gitee Pages

Gitee 的 **Gitee Pages 服务已经下线**（仓库「服务」菜单里已没有该入口），
所以 Gitee 只能作为**源码备份 / 代码展示**，无法再发布网站。

---

## 其它可选的静态托管

| 平台 | 做法 | 备注 |
| --- | --- | --- |
| **Netlify** | 打开 <https://app.netlify.com/drop> 把 `dist/` 拖进去 | 最简单，不用 Git，不用命令行 |
| **Cloudflare Pages** | 上传文件夹，或连 GitHub | 免费、自带 HTTPS |
| **Vercel** | 本机执行 `npx vercel --prod` | 从本机直接传，不需要 Git 平台 |
| **腾讯云 EdgeOne Pages / CloudBase** | 可关联 Gitee 自动部署 | 国内访问快，有免费额度 |
| **阿里云 OSS / 腾讯云 COS** | 开启「静态网站托管」，上传 `dist/` | 想用自己的域名访问通常要**域名备案** |

用 Git 平台连接时的通用配置：

| 项 | 值 |
| --- | --- |
| Build command | `npm run build:web` |
| Output / Publish directory | `dist`（或 `docs`） |
| Node version | 20 |

---

## 关于 `docs/` 目录

`npm run build:gitee` 会把构建结果复制到 `docs/`，用于「**从分支直接发布**」的托管方式
（例如 GitHub Pages 的 *Deploy from a branch → main / docs*，或 Gitee Pages 曾经的用法）。

如果只使用 GitHub Actions 自动部署，`docs/` 并不是必需的，可以不提交它来保持仓库精简。

---

## 手机端注意事项

- **添加到主屏幕（PWA）**：需要 **HTTPS**，上面这些平台默认都满足。
- **更新后看不到新版**：手机有 Service Worker 缓存，多刷新一两次或重开页面。
- **路由**：用的是 `HashRouter`，网址形如 `.../#/orders`，任何静态托管都不会 404。
- **数据**：存在浏览器本地，换设备/清缓存前记得在「数据」页导出备份。
