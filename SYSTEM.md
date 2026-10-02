# EcoLink 系统说明

后续改功能、改数据或改页面时，先读这份文件，再改代码，并同步更新本文。  
本文是系统的对照说明书，不是运行日志。打包安装流程见 [`打包说明.md`](打包说明.md)。

## 1. 系统做什么

H5 网站，给采购人员用：

1. 管理食材分组
2. 管理食材（**图片、CODE、中文、备注**）
3. 管理客户（下单的门店 / 单位）
4. 按某一天给某个客户录入数量
5. 按一天或一段日期汇总成矩阵表
6. 导出 A4 排版的 Excel（采购汇总、单个客户汇总、拣货单），字体可在「数据」页选择
7. 客户常用订单（常点清单）/ 固定订单（带数量）模板，方便重复录入
8. 导出 / 导入整份业务备份（含图片）
9. 界面中 / 英切换
10. 账号密码登录；所有用户访问同一台云服务器，**共享同一份数据**

食材名、客户名、自定义分组名不随语言翻译。只有界面文案和三个预置分组名会切换。

## 2. 怎么运行

线上是**云服务器共享版**：所有用户用浏览器 / 手机打开同一个地址，登录后看到同一份数据。

- 线上地址：<https://ecolinkbuy.top/>
- 服务器部署、更新、备份、恢复：见 [`deploy/README.md`](deploy/README.md)
- 本地开发：`npm install` 后 `npm run dev`（本地文件模式，不启用登录）

也可以在 **Windows / macOS** 上打安装包离线单机使用（数据在各自电脑），流程见 [`打包说明.md`](打包说明.md)。

### 2.0 打包给其他电脑安装（推荐）

完整步骤、对方怎么装、数据目录、改版本、常见问题见 **[`打包说明.md`](打包说明.md)**。

摘要：

```bash
npm install
npm run dist:mac    # 必须在 Mac 上，得到 release/macOS-EcoLink-安装包-*.dmg
npm run dist:win    # 必须在 Windows 上，得到 release/Windows-EcoLink-安装包-*.exe
```

对方双击安装即可，不用装 Node.js。安装版数据在用户目录，备份时拷整个 `data` 文件夹。

### 2.1 环境前置

1. **操作系统**：Windows 10/11，或 macOS。
2. **Node.js LTS（20 或以上）**：不必先去官网手装。用下面的安装脚本即可。
3. **浏览器**：Edge、Chrome 或 Firefox（Windows 自带 Edge 即可）。
4. **项目文件夹**：把整个项目拷到电脑上（不要只拷 `index.html`）。
5. **不需要**：数据库、账号、公网服务器、IIS。电脑和 Mac 的安装包自带存盘。手机独立使用时数据写在该设备浏览器（或 App）里，不要只用 `file://` 打开 `index.html`。
6. **网络**：第一次安装 Node.js 时要能访问 [https://nodejs.org](https://nodejs.org)。只从该官网下载，不使用第三方包。

关掉黑色/终端窗口 = 网站停止。用的时候窗口要一直开着。换电脑时把整个项目（至少包含 `data/`）一起拷走。

### 2.2 第一次：先装环境，再打开网站

推荐顺序（Windows）：

1. 双击 [`Windows-安装运行环境.bat`](Windows-安装运行环境.bat)  
   - 已有 Node.js 20+：直接提示已就绪  
   - 没有：优先用 Windows `winget` 或官网 MSI 安装系统版 LTS（可能弹出管理员确认）  
   - 系统安装失败：自动改下到项目里的便携版 `tools/node/`，不改系统
2. 再双击 [`Windows-打开采购系统.bat`](Windows-打开采购系统.bat) 打开网站

也可以只双击「Windows-打开采购系统」。若没有 Node.js，它会**自动下载便携版 LTS** 再启动。装失败时会提示先点「Windows-安装运行环境」。

必须先把项目**解压/拷到本地文件夹**再双击（不要在压缩包、邮件附件预览里点）。黑窗口会停住，方便看说明或报错；关掉窗口 = 网站停止。从 Mac 整包拷过来时，脚本若发现没有 Windows 版 `vite.cmd`，会重新 `npm install`（Mac 的 `node_modules` 不能用）。

macOS 对应文件：[`macOS-安装运行环境.command`](macOS-安装运行环境.command)、[`macOS-打开采购系统.command`](macOS-打开采购系统.command)。

检测与下载逻辑在 [`scripts/ensure-node.ps1`](scripts/ensure-node.ps1)（Windows）和 [`scripts/ensure-node.sh`](scripts/ensure-node.sh)（macOS）。改安装方式时同步改这两份脚本和本节。

### 2.3 Windows 用快捷方式打开

1. 把项目文件夹放到例如 `D:\EcoLinkManagerSystem`。
2. 双击 [`Windows-创建桌面快捷方式.bat`](Windows-创建桌面快捷方式.bat)，桌面会有：  
   - **Windows-安装运行环境**（第一次先点）  
   - **Windows-打开采购系统**（之后打开网站）
3. 打开后浏览器访问 `http://localhost:5173`。手机用法见 2.6。
4. 用完后关掉弹出的黑色窗口。

### 2.4 macOS 用快捷方式打开

1. 首次在终端执行：`chmod +x macOS-安装运行环境.command macOS-打开采购系统.command scripts/ensure-node.sh`
2. 先双击 `macOS-安装运行环境`，再双击 `macOS-打开采购系统`。若提示无法打开：右键 → 打开。
3. 可把这两个文件拖到 Dock 或做成桌面别名。

### 2.5 命令行打开

```bash
cd 项目目录
npm install
npm start
```

`npm start` 会启动服务并自动打开浏览器。开发时也可用 `npm run dev`（不自动开浏览器）。它已监听局域网，同一 Wi-Fi 下的手机可打开终端里打印的地址（这时手机用的是**电脑上那份数据**）。

### 2.6 三种用法，不要混

| 谁 | 怎么用 | 数据在哪 | 要不要电脑一直开着 |
| --- | --- | --- | --- |
| Windows | `npm run dist:win` 安装包，或本机 `npm start` | 这台 Windows 的 `data/` | 安装包不用；`npm start` 要 |
| macOS | `npm run dist:mac` 安装包，或本机 `npm start` | 这台 Mac 的 `data/` | 安装包不用；`npm start` 要 |
| 手机独立用 | 见 2.7 | 这台手机自己的存储 | 不要 |
| 手机临时看电脑数据 | 同一 Wi-Fi 打开终端里的地址 | 电脑上的 `data/` | 要 |

### 2.7 手机独立使用（不跟电脑同一 Wi-Fi）

界面就是现在这个 H5，不必做成微信小程序。手机自己存一份数据，和电脑、别的手机都不自动同步。

**做法 A（推荐，浏览器即可）**

1. 电脑执行 `npm run static`，得到静态网站 `http://localhost:4173`（没有本机文件 API，走设备存储）。
2. 把 `dist/` 放到任意能用手机打开的 HTTPS 地址（公司静态站、内网 HTTPS 均可）。局域网 HTTP 在 iPhone 上不能可靠地「加到主屏幕离线用」。
3. 手机浏览器打开一次，Safari 分享 → 添加到主屏幕（Android Chrome → 安装应用 / 添加到主屏幕）。
4. 之后这台手机可单独录单、汇总、导入导出。清浏览器数据会丢。

**做法 B（Android / iOS 安装包）**

同一套 `dist/`，用 Capacitor 包进系统 WebView，仍然走设备存储：

```bash
npm run cap:android   # 打开 Android Studio 打 APK
npm run cap:ios       # 打开 Xcode 打 IPA（需苹果账号才能装到真机）
```

配置：[`capacitor.config.json`](capacitor.config.json)。`webDir` 是 `dist/`。

电脑安装包仍然是 Electron，命令不变，见 [`打包说明.md`](打包说明.md)。

## 3. 数据存在哪里

**线上（云服务器）是「文件模式 + 登录」**：数据存在服务器的 `data/` 目录，所有登录用户共享。
启动时自动判断：

1. **文件模式**（探测到 `/api/db` 返回 JSON）：云服务器、`npm start`、Vite 预览、Electron 安装包。写 `data/`。云端同时开启**账号密码登录**（环境变量 `ECOLINK_AUTH=1`）。
2. **设备模式**（探测不到 `/api/db`）：静态 `dist/`、GitHub Pages、手机独立打开、Capacitor App。写该设备的 IndexedDB（库名 `ecolink`），图片也在里面，**数据不共享**。

```
文件模式（云服务器 / 本地）：
data/db.json                 # 分组、食材元数据、客户、订单、模板、settings
data/auth.json               # 账号（username / scrypt 密码哈希 / role）与会话签名密钥
data/images/{id}.jpg         # 食材预览图（约最长边 800px）
data/images/{id}.thumb.jpg   # 缩略图（96×96）

设备模式：
IndexedDB / ecolink / kv     # 整份 db.json
IndexedDB / ecolink / images # { preview, thumb } jpeg Blob
```

前端探测：`GET /api/db` 且 `Content-Type` 含 `json` → 文件模式，否则设备模式。逻辑在 [`src/storage/index.ts`](src/storage/index.ts)。

**多人共享为什么不互相覆盖**：业务数据走「按实体接口」，分组 / 食材 / 客户 / 订单 / 模板各自增删改，
服务端每次只改动单条记录再原子落盘（[`server/store.ts`](server/store.ts)），不是整份覆盖。
订单在服务端按「日期 + 客户」去重，保证同一天同一客户只有一份订单。

备份：`data/` 全部内容（含 `auth.json`）。线上由 [`deploy/backup.sh`](deploy/backup.sh) 每天自动打包，保留 30 天，见 `deploy/README.md` 第 9 节。

首次启动若没有数据，会写入带 3 个预置分组的初始库（[`src/storage/defaultDb.ts`](src/storage/defaultDb.ts)）。

`data/*.json` 和图片默认不进 git（见 `.gitignore`）。备份业务数据可以：

- 在「数据」页导出一份 `.json` 备份（含图片，可再导入）——电脑和手机通用
- 电脑文件模式也可以直接复制整个 `data/` 文件夹

### db.json 结构

```json
{
  "settings": { "locale": "zh", "fontFamily": "微软雅黑" },
  "groups": [],
  "ingredients": [],
  "buyers": [],
  "orders": [],
  "templates": []
}
```

字段含义：

| 集合 | 关键字段 | 说明 |
| --- | --- | --- |
| `groups` | `id, name, i18nKey?, sort` | 预置组用 `i18nKey`: `fresh` / `frozen` / `packaged`。用户改名后清掉 `i18nKey`，之后两种语言都显示新名字 |
| `ingredients` | `id, groupId, code, name, remark, hasImage, imageRev` | `code` 为 CODE（同一仓库内不重复），`name` 为中文名，`remark` 为备注。旧数据没有这两项时按空字符串读。`imageRev` 用于刷新图片缓存 |
| `buyers` | `id, name, sort` | 客户只要一个名字 |
| `orders` | `id, date, buyerId, items[], updatedAt` | `date` 为 `YYYY-MM-DD`。`items` 为 `{ ingredientId, quantity }` |
| `templates` | `id, buyerId, kind, name, items[], updatedAt` | 客户订单模板。`kind` 为 `fixed`（固定订单，保存数量）或 `common`（常用订单，只存食材清单，`quantity` 为 0） |
| `settings.locale` | `zh` 或 `en` | 界面语言，也写在文件里 |
| `settings.fontFamily` | 字体名 | 导出 Excel 用的字体，默认 `微软雅黑` |

旧 `db.json` 没有 `templates` 和 `settings.fontFamily` 时，读取会自动补 `[]` 和 `微软雅黑`，不用手工改文件。

### 备份文件结构

「数据」页导出的是一份 JSON，不是只拷 `db.json`。格式：

```json
{
  "format": "ecolink-backup",
  "version": 1,
  "exportedAt": "2026-09-21T08:00:00.000Z",
  "db": { },
  "images": {
    "ing-xxx": { "preview": "<jpeg base64>", "thumb": "<jpeg base64>" }
  }
}
```

导入会**整份覆盖**当前分组、食材、图片、客户和订单。不是合并。文件名：

- 中文：`EcoLink备份-2026-09-21.json`
- 英文：`ecolink-backup-2026-09-21.json`

约束：

- 同一天 + 同一客户只有一份订单。再次保存会覆盖数量。
- 数量 `<= 0` 或不填 = 未订，不写入明细。
- 分组下还有食材时不能删分组。
- 食材 / 客户被订单引用时，删除要确认。历史订单保留 id；汇总里找不到名字则显示「已删除」。

## 4. 接口

由 [`server/store.ts`](server/store.ts) 实现。开发时挂在 [`server/fileApi.ts`](server/fileApi.ts)；
云端由 [`server/standalone.ts`](server/standalone.ts) + [`deploy/entry.ts`](deploy/entry.ts) 启动。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/auth/me` | 当前登录状态（`authEnabled` + `user`） |
| POST | `/api/auth/login` | 登录，成功发 httpOnly 会话 Cookie |
| POST | `/api/auth/logout` | 退出 |
| POST | `/api/auth/password` | 修改自己的密码 |
| GET | `/api/users` | 用户列表（仅管理员） |
| POST | `/api/users` | 新增用户（仅管理员） |
| DELETE | `/api/users/:id` | 删除用户（仅管理员） |
| PATCH | `/api/users/:id` | 改角色 / 重置密码（仅管理员） |
| GET | `/api/db` | 读整份 json（需登录） |
| PUT | `/api/db` | 覆盖写入整份 json（备份等场景保留） |
| POST | `/api/{groups\|ingredients\|buyers\|orders\|templates}` | 新增或更新一条记录，返回最新整份数据 |
| DELETE | `/api/{groups\|ingredients\|buyers\|orders\|templates}/:id` | 删除一条记录 |
| PATCH | `/api/settings` | 改语言 / 导出字体 / 导出字号 |
| GET | `/api/backup` | 导出备份：`db` + 图片 base64 |
| PUT | `/api/backup` | 导入备份并覆盖当前数据与图片 |
| PUT | `/api/images/:id` | body: `{ preview, thumb }`，均为 jpeg 的 base64 |
| GET | `/api/images/:id` | 预览图 |
| GET | `/api/images/:id/thumb` | 缩略图 |
| DELETE | `/api/images/:id` | 删预览图和缩略图 |

开启登录（`ECOLINK_AUTH=1`）后，除 `/api/auth/*` 外的接口都要求已登录，否则返回 401。
密码用 Node 内置 `scrypt` 哈希，会话是 HMAC 签名令牌放 httpOnly + Secure Cookie，逻辑在 [`server/authStore.ts`](server/authStore.ts)。
云端命令：`node server.cjs create-admin <账号> <密码>` / `reset-password`。

前端业务变更走「按实体接口」，服务端返回最新整份数据刷新本地；不是整份覆盖。
设备模式把同一份结构写入 IndexedDB。

改存储规则时，要同时改：

- [`server/store.ts`](server/store.ts)
- [`server/authStore.ts`](server/authStore.ts)
- [`server/fileApi.ts`](server/fileApi.ts)
- [`server/standalone.ts`](server/standalone.ts)
- [`deploy/entry.ts`](deploy/entry.ts)
- [`src/storage/index.ts`](src/storage/index.ts)
- [`src/storage/idb.ts`](src/storage/idb.ts)
- [`src/storage/defaultDb.ts`](src/storage/defaultDb.ts)
- [`src/storage/normalizeDb.ts`](src/storage/normalizeDb.ts)
- [`src/api/db.ts`](src/api/db.ts)
- [`src/api/httpDb.ts`](src/api/httpDb.ts)
- [`src/api/auth.ts`](src/api/auth.ts)
- [`src/types.ts`](src/types.ts)
- [`src/store/useAppStore.ts`](src/store/useAppStore.ts)
- [`src/store/useAuthStore.ts`](src/store/useAuthStore.ts)
- [`src/pages/DataPage.tsx`](src/pages/DataPage.tsx)
- [`src/pages/LoginPage.tsx`](src/pages/LoginPage.tsx)
- 本文第 3、4 节

## 5. 页面

云端开启登录时，先出现**登录页**（[`src/pages/LoginPage.tsx`](src/pages/LoginPage.tsx)）；登录后进主界面。
底部 5 个 Tab，顶栏右侧切中文 / EN，另有退出按钮。

| 路由 | 页面 | 文件 | 做什么 |
| --- | --- | --- | --- |
| `/` | 食材 | [`src/pages/IngredientsPage.tsx`](src/pages/IngredientsPage.tsx) | 按分组看食材；新增/改/删（图片、CODE、中文必填，备注可选）；管理分组 |
| `/buyers` | 客户 | [`src/pages/BuyersPage.tsx`](src/pages/BuyersPage.tsx) | 增删改客户名字 |
| `/orders` | 订单 | [`src/pages/OrdersPage.tsx`](src/pages/OrdersPage.tsx) | 选日期、选客户；搜索框可一键清空；按分组筛选、可只看上次订过的食材；顶部展示该客户更早一单并支持填入上次数量；订单模板（固定/常用）可一键载入；保存覆盖当天订单，底部浮层提示 |
| `/summary` | 汇总 | [`src/pages/SummaryPage.tsx`](src/pages/SummaryPage.tsx) | 单日或日期范围矩阵；可选「全部客户」或某一家；另有独立的「单个客户汇总」导出区（自选客户 + 起止日期）；导出 A4 采购汇总或拣货单。窄屏改成卡片，宽屏仍是表格 |
| `/data` | 数据 | [`src/pages/DataPage.tsx`](src/pages/DataPage.tsx) | 导出 / 导入整份备份；设置导出字体和字号；账号信息、修改密码、管理员用户管理 |

壳子：[`src/components/AppShell.tsx`](src/components/AppShell.tsx)

## 6. 汇总与 Excel

算法在 `buildSummary`（[`src/store/useAppStore.ts`](src/store/useAppStore.ts)）：

1. 筛出 `date` 落在区间内（含首尾）的订单
2. 按 `ingredientId × buyerId` 把数量相加
3. 只保留「至少有一家订了」的食材
4. 客户列按 `sort` 排
5. 按分组分段

网页表：

- 第一行：客户
- 左侧：缩略图 + CODE + 中文 + 备注
- 格子：数量，0 为空白
- 最右：合计

Excel（[`src/utils/exportSummary.ts`](src/utils/exportSummary.ts)）列顺序：

1. CODE
2. 名字（`nameEn`）
3. 中文（`name`）
4. 各客户
5. 合计

> 注意：**Excel 有意不导出图片和备注**（网页汇总仍显示缩略图 + 备注）。这是需求决定的不一致，别当成 bug 去「修」。

导出前有 3 行：第 1 行标题、第 2 行统计区间 + 导出时间、第 3 行表头。分组行合并整行，只写组名。页边距、A4（横向，缩放一页宽）、每页重复表头、页脚页码由 [`src/utils/excelStyle.ts`](src/utils/excelStyle.ts) 统一设置。字体取 `settings.fontFamily`；「名字」列居左，其余居中。

文件名：

- 中文：`采购汇总-2026-09-21.xlsx` 或 `采购汇总-2026-09-01_2026-09-21.xlsx`
- 单个客户：`采购汇总-店名-2026-09-01_2026-09-21.xlsx`
- 英文：`procurement-summary-...xlsx`

单个客户有两个入口，效果一样：

1. 上面的「客户」下拉选一家再点导出。
2. 汇总页独立的「单个客户汇总」区：自选客户 + 开始/结束日期，单独导出（该家在所选区间没有订单时按钮不可用）。

### 拣货单

[`src/utils/exportPickingList.ts`](src/utils/exportPickingList.ts)。同样选日期范围（可加客户筛选，默认全部合并）。按分组逐行：

- 一行分组标题（合并整行）
- 该组每样食材一行：中文、CODE、名字、数量、备注

数量为所选范围内客户的合计（选定某一家时就是这一家的数量）。A4 纵向。文件名 `拣货单-2026-09-01_2026-09-21.xlsx`（英文 `picking-list-...`）。

改汇总规则时，网页矩阵和 Excel 必须一起改，数字和出现的行/列要一致（图片/备注是有意只差在 Excel 上）。

## 7. 国际化

- 词条：[`src/i18n/zh.ts`](src/i18n/zh.ts)、[`src/i18n/en.ts`](src/i18n/en.ts)
- 初始化：[`src/i18n/index.ts`](src/i18n/index.ts)
- 当前语言：`data/db.json` → `settings.locale`
- 新按钮、空状态、报错都要中英各写一条，不要在页面里写死中文或英文（用户录入的名字除外）

预置分组翻译 key：`groups.fresh` / `groups.frozen` / `groups.packaged`。

## 8. 关键交互（改功能时不要破坏）

- 新增食材：必须有图片、CODE、中文；备注可选。CODE 不能和已有食材重复。旧数据缺 CODE/备注时按空显示，再编辑时补上。
- 上传图片：相册/文件选择，浏览器里压成 preview + thumb，再写入 `data/images/`。手机可选拍照或相册。
- 同一天同一客户再打开订单页，要带回当天已保存数量。
- 订单页搜索框右侧有「×」清空按钮；可按分组筛选，也可只看该客户上次订过的食材。
- 订单模板：`固定订单` 存数量，点一下只填入还没有数量的项（不覆盖已填/已保存的数字）；`常用订单` 只存食材清单，载入后把列表筛成这些食材。模板存在 `templates` 里，按客户区分。
- 若该客户在所选日期之前有订单，顶部显示「上次订购」及数量，可单项或一键填入。不自动覆盖当天已填数字（点填入才会写入）。
- 保存（食材 / 客户 / 分组 / 订单 / 模板 / 字体）成功后，屏幕底部弹出浮层提示并自动消失。
- 「数据」页可选导出 Excel 的字体（默认微软雅黑）。字体只是指定字体名，电脑没装时会回退，无法内嵌。
- 切语言立刻换界面，不整页刷新；食材名保持原样。
- 刷新页面或重启 `npm run dev` 后，电脑文件模式的 `data/` 还在；设备模式刷新后 IndexedDB 还在。
- 「数据」页导出的备份含图片；导入前要确认，导入后当前数据被整份替换。电脑和手机可互导。
- 手机浏览器能完成同样的增删改、录单、汇总和导入导出。输入框不小于 16px，避免 iOS 自动放大。
- 设备模式与文件模式数据默认不互通。页面会说明当前存在哪。

## 9. 以后怎么改，才能和系统对得上

按下面顺序做，避免页面、文件、文档各写各的：

1. 先改本文对应章节（需求、字段、页面、规则）。
2. 若动数据结构：改 `src/types.ts` → `src/storage/defaultDb.ts` → `src/storage/normalizeDb.ts`（旧数据补默认值）→ store → 各页面。旧的 `data/db.json` 如不兼容，要在 `normalizeDb` 里补，或说明如何手工改文件。
3. 若动文案：同时改 `zh.ts` 和 `en.ts`。
4. 若动汇总：同时改 `buildSummary`、汇总页、`exportSummary.ts`（拣货单还要改 `exportPickingList.ts`；A4/字体/对齐改 `excelStyle.ts`）。
5. 若动存盘：同时改实体接口 / IndexedDB 适配和本文第 3、4 节。文件模式不要改回用 localStorage；设备模式只用 IndexedDB `ecolink`。多人共享靠「按实体接口」，不要再改回整份覆盖。
6. 改完后用浏览器走一遍：加食材（含图）→ 加客户 → 录两家订单 → 看汇总数字 → 导出 Excel → 导出备份再导入核对 → 切英文。电脑文件模式打开 `data/db.json` 和 `data/images/` 核对。再 `npm run static` 确认没有 `/api/db` 时仍能保存（IndexedDB），刷新还在。窄屏还要看底部 5 个 Tab、汇总卡片、弹出层不被键盘挡住。

## 10. 明确不做

- 单位、单价、金额、库存
- 食材英文名、一张食材多图
- 独立拍照按钮、用图片 URL 当主数据
- PDF / CSV
- 电脑文件模式把业务数据存进浏览器
- 订单的字段级自动合并（冲突以「日期 + 客户」整单覆盖为准）
- 社交登录 / 短信验证码 / 邮件找回密码（忘记密码由管理员重置）
