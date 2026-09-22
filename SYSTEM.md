# EcoLink 系统说明

后续改功能、改数据或改页面时，先读这份文件，再改代码，并同步更新本文。  
本文是系统的对照说明书，不是运行日志。打包安装流程见 [`打包说明.md`](打包说明.md)。

## 1. 系统做什么

H5 网站，给采购人员用：

1. 管理食材分组
2. 管理食材（**图片、CODE、中文、备注**）
3. 管理订货商（下单的门店 / 客户）
4. 按某一天给某个订货商录入数量
5. 按一天或一段日期汇总成矩阵表
6. 导出带缩略图的 Excel
7. 导出 / 导入整份业务备份（含图片）
8. 界面中 / 英切换
9. 电脑、Mac、手机都能各自单独使用（数据默认不互通，可用备份互导）

食材名、订货商名、自定义分组名不随语言翻译。只有界面文案和三个预置分组名会切换。

## 2. 怎么运行

可以在 **Windows 10/11**、**macOS** 和手机浏览器 / 手机安装包上使用。每台设备自己存一份数据，互相同步不是必须的。要对齐时用「数据」页导入导出。

**给其他电脑用：打安装包，对方不用装 Node.js。**  
开发或改代码：仍可用下面的源码启动脚本。

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

两套存盘，启动时自动选：

1. **电脑文件模式**（有 `/api/db`）：`npm start`、Vite 预览、Electron 安装包。写 `data/`，不用浏览器仓库。
2. **设备模式**（没有 `/api/db`）：静态 `dist/`、手机独立打开、Capacitor App。写该设备的 IndexedDB（库名 `ecolink`），图片也在里面。

```
电脑文件模式：
data/db.json                 # 分组、食材元数据、订货商、订单、语言
data/images/{id}.jpg         # 食材预览图（约最长边 800px）
data/images/{id}.thumb.jpg   # 缩略图（96×96）

设备模式：
IndexedDB / ecolink / kv     # 整份 db.json
IndexedDB / ecolink / images # { preview, thumb } jpeg Blob
```

前端探测：`GET /api/db` 且 `Content-Type` 含 `json` → 文件模式，否则设备模式。逻辑在 [`src/storage/index.ts`](src/storage/index.ts)。

首次启动若没有数据，会写入带 3 个预置分组的初始库（[`src/storage/defaultDb.ts`](src/storage/defaultDb.ts)）。

`data/*.json` 和图片默认不进 git（见 `.gitignore`）。备份业务数据可以：

- 在「数据」页导出一份 `.json` 备份（含图片，可再导入）——电脑和手机通用
- 电脑文件模式也可以直接复制整个 `data/` 文件夹

### db.json 结构

```json
{
  "settings": { "locale": "zh" },
  "groups": [],
  "ingredients": [],
  "buyers": [],
  "orders": []
}
```

字段含义：

| 集合 | 关键字段 | 说明 |
| --- | --- | --- |
| `groups` | `id, name, i18nKey?, sort` | 预置组用 `i18nKey`: `fresh` / `frozen` / `packaged`。用户改名后清掉 `i18nKey`，之后两种语言都显示新名字 |
| `ingredients` | `id, groupId, code, name, remark, hasImage, imageRev` | `code` 为 CODE（同一仓库内不重复），`name` 为中文名，`remark` 为备注。旧数据没有这两项时按空字符串读。`imageRev` 用于刷新图片缓存 |
| `buyers` | `id, name, sort` | 订货商只要一个名字 |
| `orders` | `id, date, buyerId, items[], updatedAt` | `date` 为 `YYYY-MM-DD`。`items` 为 `{ ingredientId, quantity }` |
| `settings.locale` | `zh` 或 `en` | 界面语言，也写在文件里 |

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

导入会**整份覆盖**当前分组、食材、图片、订货商和订单。不是合并。文件名：

- 中文：`EcoLink备份-2026-09-21.json`
- 英文：`ecolink-backup-2026-09-21.json`

约束：

- 同一天 + 同一订货商只有一份订单。再次保存会覆盖数量。
- 数量 `<= 0` 或不填 = 未订，不写入明细。
- 分组下还有食材时不能删分组。
- 食材 / 订货商被订单引用时，删除要确认。历史订单保留 id；汇总里找不到名字则显示「已删除」。

## 4. 本机 API

由 [`server/fileApi.ts`](server/fileApi.ts) 挂到 Vite 开发/预览服务。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/db` | 读整份 json |
| PUT | `/api/db` | 覆盖写入整份 json（先写临时文件再 rename） |
| GET | `/api/backup` | 导出备份：`db` + 图片 base64 |
| PUT | `/api/backup` | 导入备份并覆盖当前数据与图片 |
| PUT | `/api/images/:id` | body: `{ preview, thumb }`，均为 jpeg 的 base64 |
| GET | `/api/images/:id` | 预览图 |
| GET | `/api/images/:id/thumb` | 缩略图 |
| DELETE | `/api/images/:id` | 删预览图和缩略图 |

前端每次业务变更后提交完整 `db.json` 快照。电脑文件模式如此。设备模式把同一份结构写入 IndexedDB。这是单人单设备工具，不做多人并发合并。

改存储规则时，要同时改：

- [`server/store.ts`](server/store.ts)
- [`server/fileApi.ts`](server/fileApi.ts)
- [`server/standalone.ts`](server/standalone.ts)
- [`src/storage/index.ts`](src/storage/index.ts)
- [`src/storage/idb.ts`](src/storage/idb.ts)
- [`src/storage/defaultDb.ts`](src/storage/defaultDb.ts)
- [`src/api/db.ts`](src/api/db.ts)
- [`src/api/httpDb.ts`](src/api/httpDb.ts)
- [`src/types.ts`](src/types.ts)
- [`src/store/useAppStore.ts`](src/store/useAppStore.ts)
- [`src/pages/DataPage.tsx`](src/pages/DataPage.tsx)
- 本文第 3、4 节

## 5. 页面

底部 5 个 Tab，顶栏右侧切中文 / EN。

| 路由 | 页面 | 文件 | 做什么 |
| --- | --- | --- | --- |
| `/` | 食材 | [`src/pages/IngredientsPage.tsx`](src/pages/IngredientsPage.tsx) | 按分组看食材；新增/改/删（图片、CODE、中文必填，备注可选）；管理分组 |
| `/buyers` | 订货商 | [`src/pages/BuyersPage.tsx`](src/pages/BuyersPage.tsx) | 增删改订货商名字 |
| `/orders` | 订单 | [`src/pages/OrdersPage.tsx`](src/pages/OrdersPage.tsx) | 选日期、选订货商；按名称搜索、按分组筛选、可只看上次订过的食材；顶部展示该订货商更早一单并支持填入上次数量；保存覆盖当天订单 |
| `/summary` | 汇总 | [`src/pages/SummaryPage.tsx`](src/pages/SummaryPage.tsx) | 单日或日期范围矩阵；导出 xlsx。窄屏改成卡片，宽屏仍是表格 |
| `/data` | 数据 | [`src/pages/DataPage.tsx`](src/pages/DataPage.tsx) | 导出 / 导入整份备份 |

壳子：[`src/components/AppShell.tsx`](src/components/AppShell.tsx)

## 6. 汇总与 Excel

算法在 `buildSummary`（[`src/store/useAppStore.ts`](src/store/useAppStore.ts)）：

1. 筛出 `date` 落在区间内（含首尾）的订单
2. 按 `ingredientId × buyerId` 把数量相加
3. 只保留「至少有一家订了」的食材
4. 订货商列按 `sort` 排
5. 按分组分段

网页表：

- 第一行：订货商
- 左侧：缩略图 + CODE + 中文 + 备注
- 格子：数量，0 为空白
- 最右：合计

Excel（[`src/utils/exportSummary.ts`](src/utils/exportSummary.ts)）列顺序：

1. 图片（约 36×36 缩略图）
2. CODE
3. 中文
4. 备注
5. 各订货商
6. 合计

分组行合并整行，只写组名、不加图。文件名：

- 中文：`采购汇总-2026-09-21.xlsx` 或 `采购汇总-2026-09-01_2026-09-21.xlsx`
- 英文：`procurement-summary-...xlsx`

改汇总规则时，网页矩阵和 Excel 必须一起改，数字和出现的行/列要一致。

## 7. 国际化

- 词条：[`src/i18n/zh.ts`](src/i18n/zh.ts)、[`src/i18n/en.ts`](src/i18n/en.ts)
- 初始化：[`src/i18n/index.ts`](src/i18n/index.ts)
- 当前语言：`data/db.json` → `settings.locale`
- 新按钮、空状态、报错都要中英各写一条，不要在页面里写死中文或英文（用户录入的名字除外）

预置分组翻译 key：`groups.fresh` / `groups.frozen` / `groups.packaged`。

## 8. 关键交互（改功能时不要破坏）

- 新增食材：必须有图片、CODE、中文；备注可选。CODE 不能和已有食材重复。旧数据缺 CODE/备注时按空显示，再编辑时补上。
- 上传图片：相册/文件选择，浏览器里压成 preview + thumb，再写入 `data/images/`。手机可选拍照或相册。
- 同一天同一订货商再打开订单页，要带回当天已保存数量。
- 订单页可按名称搜索、按分组筛选，也可只看该订货商上次订过的食材。
- 若该订货商在所选日期之前有订单，顶部显示「上次订购」及数量，可单项或一键填入。不自动覆盖当天已填数字（点填入才会写入）。
- 切语言立刻换界面，不整页刷新；食材名保持原样。
- 刷新页面或重启 `npm run dev` 后，电脑文件模式的 `data/` 还在；设备模式刷新后 IndexedDB 还在。
- 「数据」页导出的备份含图片；导入前要确认，导入后当前数据被整份替换。电脑和手机可互导。
- 手机浏览器能完成同样的增删改、录单、汇总和导入导出。输入框不小于 16px，避免 iOS 自动放大。
- 设备模式与文件模式数据默认不互通。页面会说明当前存在哪。

## 9. 以后怎么改，才能和系统对得上

按下面顺序做，避免页面、文件、文档各写各的：

1. 先改本文对应章节（需求、字段、页面、规则）。
2. 若动数据结构：改 `src/types.ts` → `server/fileApi.ts` 初始数据 → store → 各页面。旧的 `data/db.json` 如不兼容，要写迁移或说明如何手工改文件。
3. 若动文案：同时改 `zh.ts` 和 `en.ts`。
4. 若动汇总：同时改 `buildSummary`、汇总页、`exportSummary.ts`。
5. 若动存盘：同时改 API / IndexedDB 适配和本文第 3 节。电脑文件模式不要改回用 localStorage；设备模式只用 IndexedDB `ecolink`。
6. 改完后用浏览器走一遍：加食材（含图）→ 加订货商 → 录两家订单 → 看汇总数字 → 导出 Excel → 导出备份再导入核对 → 切英文。电脑文件模式打开 `data/db.json` 和 `data/images/` 核对。再 `npm run static` 确认没有 `/api/db` 时仍能保存（IndexedDB），刷新还在。窄屏还要看底部 5 个 Tab、汇总卡片、弹出层不被键盘挡住。

## 10. 明确不做

- 账号、权限、云同步、数据库
- 单位、单价、金额、库存
- 食材英文名、一张食材多图
- 独立拍照按钮、用图片 URL 当主数据
- PDF / CSV
- 电脑文件模式把业务数据存进浏览器
- 多设备自动合并同一份订单
