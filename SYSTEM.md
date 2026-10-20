# EcoLink 系统说明

后续改功能、改数据或改页面时，先读这份文件，再改代码，并同步更新本文。  
本文是系统的对照说明书，不是运行日志。打包安装流程见 [`打包说明.md`](打包说明.md)。

## 1. 系统做什么

H5 网站，给采购人员用：

1. 管理食材分组（一级分组下可建自定义命名的二级分组）
2. 管理食材（**图片、CODE、中文、备注、单价**）
3. 管理客户（下单的门店 / 单位）：名字、代码、地址 / 电话 / 物流公司、常用产品库；数量不设上限
4. 按某一天给某个客户录入数量
5. 按一天或一段日期汇总成矩阵表
6. 导出 A4 排版的 Excel（采购汇总、单个客户汇总、拣货单、单客户 Tax Invoice），字体可在「数据」页选择
7. 客户常用订单（常点清单）/ 固定订单（带数量）模板，方便重复录入
8. 导出 / 导入整份业务备份（含图片）
9. 界面中 / 英切换
10. 账号密码登录；所有用户访问同一台云服务器，**共享同一份数据**
11. 5 种账号角色：管理员、录入员、取货员、打包发货员、汇总订单员，各自只看到自己的工作页面
12. 取货员上传多张取货照片、发票照片并填写税、金额、取货店名；打包发货员上传多张打包发货照片、发票照片并填写物流、发货店名
13. 汇总订单员导出拣货单、汇总单、发票；导出前可编辑本次发票内容
14. 管理员可导出可读汇总 Excel / 完整归档 ZIP，并按时间段清理服务器数据

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

### 2.8 线上版本更新与回退

线上更新、版本号、服务器备份和代码回退见 [`更新流程.md`](更新流程.md)。要点：

- 每次更新先改 `package.json` 的 `version`，再执行 `deploy\build-deploy.ps1`。
- 部署包名带版本号和构建时间：`ecolink-deploy-v1.1.0-20261020-003427.tar.gz`。
- 包内 `version.json` / `VERSION` 记录版本、构建时间、Git commit、分支和是否有未提交改动。
- 服务器用 `bash /opt/ecolink/update.sh <版本包>` 更新；脚本会自动备份数据、备份旧代码、解压、重启和健康检查。
- 回退代码用 `bash /opt/ecolink/rollback.sh <code-backups/...>`；回退数据用 `bash /opt/ecolink/restore.sh <backups/...>`。
- 如果新版本增加了旧代码不认识的字段，回退代码时建议同时回退数据，或先导出完整归档包。

## 3. 数据存在哪里

**线上（云服务器）是「文件模式 + 登录」**：数据存在服务器的 `data/` 目录，所有登录用户共享。
启动时自动判断：

1. **文件模式**（探测到 `/api/db` 返回 JSON）：云服务器、`npm start`、Vite 预览、Electron 安装包。写 `data/`。云端同时开启**账号密码登录**（环境变量 `ECOLINK_AUTH=1`）。
2. **设备模式**（探测不到 `/api/db`）：静态 `dist/`、GitHub Pages、手机独立打开、Capacitor App。写该设备的 IndexedDB（库名 `ecolink`），图片也在里面，**数据不共享**。

```
文件模式（云服务器 / 本地）：
data/db.json                 # 分组、食材、客户、订单、模板、取货、打包、发票、settings
data/auth.json               # 账号（username / scrypt 密码哈希 / role）与会话签名密钥
data/images/{id}.jpg         # 食材 / 取货 / 打包照片预览图
data/images/{id}.thumb.jpg   # 缩略图
data/pre-purge/              # 清理前自动生成的安全备份（保留最近 3 份）
data/cleanup-log.json        # 数据清理操作记录

设备模式：
IndexedDB / ecolink / kv     # 整份 db.json
IndexedDB / ecolink / images # { preview, thumb } jpeg Blob
```

前端探测：`GET /api/db` 且 `Content-Type` 含 `json` → 文件模式，否则设备模式。逻辑在 [`src/storage/index.ts`](src/storage/index.ts)。

**多人共享为什么不互相覆盖**：业务数据走「按实体接口」，分组 / 食材 / 客户 / 订单 / 模板各自增删改，
服务端每次只改动单条记录再原子落盘（[`server/store.ts`](server/store.ts)），不是整份覆盖。
订单在服务端按「日期 + 客户」去重，保证同一天同一客户只有一份订单。

备份：`data/` 全部内容（含 `auth.json`）。线上由 [`deploy/backup.sh`](deploy/backup.sh) 每天自动打包，保留 30 天，见 `deploy/README.md` 第 9 节。管理员在「数据」页清理数据前，服务端还会额外生成 `data/pre-purge/backup-*.json`（含图片，保留最近 3 份）。

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
  "templates": [],
  "pickupRecords": [],
  "packRecords": [],
  "invoiceRecords": []
}
```

字段含义：

| 集合 | 关键字段 | 说明 |
| --- | --- | --- |
| `groups` | `id, name, i18nKey?, parentId?, sort` | `parentId` 为空是一级分组，有值表示它属于哪个一级分组，即二级分组。预置一级组用 `i18nKey`: `fresh` / `frozen` / `packaged`；自动迁移生成的二级分组用 `uncategorized`（未分类）。用户改名后清掉 `i18nKey`，之后两种语言都显示新名字 |
| `ingredients` | `id, groupId, code, name, remark, unit, price, hasImage, imageRev` | `groupId` 指向二级分组。`code` 为 CODE（同一仓库内不重复），`name` 为中文名，`remark` 为备注，`unit` 为单位（如 kg / ctn，选填，发票用），`price` 为单价（元，缺省 0）。旧数据没有这些项时按空字符串 / 0 读。`imageRev` 用于刷新图片缓存 |
| `buyers` | `id, name, code, address, phone, logistics, commonIngredientIds, sort` | 客户名字；`code` 为客户代码（选填但唯一，订单页用它显示，没填就显示名字）；`address` / `phone` / `logistics` 选填，用于单个客户汇总表头；`commonIngredientIds` 是「常用产品库」的食材 id 列表。旧数据缺这些字段时按空字符串 / 空数组读 |
| `orders` | `id, date, buyerId, items[], updatedAt` | `date` 为 `YYYY-MM-DD`。`items` 为 `{ ingredientId, quantity }` |
| `templates` | `id, buyerId, kind, name, items[], updatedAt` | 客户订单模板。`kind` 为 `fixed`（固定订单，保存数量）或 `common`（常用订单，只存食材清单，`quantity` 为 0） |
| `pickupRecords` | `id, date, storeName, tax, amount, note, buyerId?, photos[], invoicePhotos[], createdBy, createdByName, createdAt, updatedAt` | 取货员记录。`photos` / `invoicePhotos` 是 `{ id, rev }[]`，每个 id 对应 `data/images/` 里的一张图；旧数据的 `hasPhoto/photoRev` 读取时会自动转成 `photos` |
| `packRecords` | `id, date, logistics, storeName, note, buyerId?, photos[], invoicePhotos[], createdBy, createdByName, createdAt, updatedAt` | 打包发货员记录；同样支持多张打包照片和发票照片 |
| `invoiceRecords` | `id, invoiceNo, invoiceNumber, buyerId, buyerName, from, to, snapshot, createdBy, createdByName, createdAt` | 每次导出的发票快照，汇总订单员可编辑后保存 |
| `settings.locale` | `zh` 或 `en` | 界面语言，也写在文件里 |
| `settings.fontFamily` | 字体名 | 导出 Excel 用的字体，默认 `微软雅黑` |
| `settings.fontSize` | 数字 | 导出 Excel 用的字号，默认 10 |
| `settings.invoice` | 见下 | 发票设置：公司名 / 标语 / 电话 / ABN / 邮箱 / 地址、银行信息、付款说明、收货备注、货币符号、税率、账期、发票号前缀和下一个发票号 |

`settings.invoice` 的 `nextInvoiceNumber` 每导出一张 Tax Invoice 自动 +1；发票设置可在「数据」页修改。

旧 `db.json` 没有 `templates`、`settings.fontFamily`、`settings.fontSize`、`settings.invoice` 时，读取会自动补默认值；旧食材没有 `unit` / `price` 时按空字符串 / 0 读。旧食材若直接挂在一级分组上，读取时会在该一级分组下自动建一个「未分类」二级分组并把食材移进去（幂等，只影响未迁移的数据），不用手工改文件。

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
| GET | `/api/backup` | 导出备份：`db` + 图片 base64（仅管理员） |
| PUT | `/api/backup` | 导入备份并覆盖当前数据与图片（仅管理员） |
| POST | `/api/pickups` | 新增/修改取货记录（管理员、取货员） |
| DELETE | `/api/pickups/:id` | 删除取货记录和照片（管理员、取货员，取货员只能删自己的） |
| POST | `/api/packs` | 新增/修改打包发货记录（管理员、打包发货员） |
| DELETE | `/api/packs/:id` | 删除打包记录和照片（管理员、打包发货员，打包发货员只能删自己的） |
| POST | `/api/invoices` | 保存本次导出的发票快照并递增发票号（管理员、汇总订单员） |
| POST | `/api/admin/purge/preview` | 预览某时间段将清理的数据（仅管理员） |
| POST | `/api/admin/purge` | 清理某时间段数据、照片，并自动生成清理前备份（仅管理员） |
| GET | `/api/admin/storage` | 数据库和图片占用统计（仅管理员） |
| PUT | `/api/images/:id` | body: `{ preview, thumb }`，均为 jpeg 的 base64；图片 ID 前缀决定权限 |
| GET | `/api/images/:id` | 预览图 |
| GET | `/api/images/:id/thumb` | 缩略图 |
| DELETE | `/api/images/:id` | 删预览图和缩略图 |

开启登录（`ECOLINK_AUTH=1`）后，除 `/api/auth/*` 外的接口都要求已登录，否则返回 401。
密码用 Node 内置 `scrypt` 哈希，会话是 HMAC 签名令牌放 httpOnly + Secure Cookie，逻辑在 [`server/authStore.ts`](server/authStore.ts)。
云端命令：`node server.cjs create-admin <账号> <密码>`、`create-user <账号> <密码> <角色>`、`set-role <账号> <角色>`、`reset-password <账号> <新密码>`。

角色与接口权限：

- `admin`：全部接口。
- `editor`：订单、订单模板；不能改食材 / 客户 / 备份 / 设置 / 清理。
- `picker`：只能新增、修改、删除自己的取货记录；只能上传 `pickup-*` 图片。
- `packer`：只能新增、修改、删除自己的打包记录；只能上传 `pack-*` 图片。
- `summarizer`：只读业务数据，可导出汇总 / 拣货单 / 发票，可新增发票快照；不能改业务数据和全局发票设置。

`GET /api/db` 会按角色过滤：取货员 / 打包员只拿到自己的记录，汇总订单员拿不到取货 / 打包记录，录入员拿不到取货 / 打包 / 发票记录。图片上传按 ID 前缀校验角色。

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
- [`src/pages/PickupPage.tsx`](src/pages/PickupPage.tsx)
- [`src/pages/PackingPage.tsx`](src/pages/PackingPage.tsx)
- [`src/utils/exportArchive.ts`](src/utils/exportArchive.ts)
- [`src/utils/compressImage.ts`](src/utils/compressImage.ts)
- [`src/utils/roles.ts`](src/utils/roles.ts)
- [`src/components/RequireRole.tsx`](src/components/RequireRole.tsx)
- 本文第 3、4 节

## 5. 页面

云端开启登录时，先出现**登录页**（[`src/pages/LoginPage.tsx`](src/pages/LoginPage.tsx)）；登录后进主界面。
底部 5 个 Tab，顶栏右侧切中文 / EN，另有退出按钮。

| 路由 | 角色 | 页面 | 文件 | 做什么 |
| --- | --- | --- | --- | --- |
| `/` | 全部 | 角色首页 | [`src/App.tsx`](src/App.tsx) | 按角色跳转：管理员 → 食材；录入员 → 订单；取货员 → 取货；打包发货员 → 打包发货；汇总订单员 → 汇总 |
| `/ingredients` | 管理员 | 食材 | [`src/pages/IngredientsPage.tsx`](src/pages/IngredientsPage.tsx) | 顶部搜索框（带 × 一键清空）按 CODE / 中文 / 名字 / 备注过滤；按一级分组看食材，分组内再按二级分组分段，一级 / 二级分组都可点击折叠展开；新增/改/删（图片、CODE、名字必填，中文、备注、单价可选）；管理分组（一级 / 二级分组增删改） |
| `/buyers` | 管理员 | 客户 | [`src/pages/BuyersPage.tsx`](src/pages/BuyersPage.tsx) | 增删改客户名字、代码（选填唯一）、地址、电话、物流公司；编辑「常用产品库」（[`src/components/IngredientPicker.tsx`](src/components/IngredientPicker.tsx)，和订单录入一样支持搜索 / 分组筛选 / 勾选）；数量不设上限 |
| `/orders` | 管理员、录入员 | 订单 | [`src/pages/OrdersPage.tsx`](src/pages/OrdersPage.tsx) | 选日期；客户改成**下拉框**，只显示客户代码（没填代码显示名字）；选中客户后食材列表默认只看该客户的「常用产品库」；搜索框可一键清空；**分组**和**食材范围**（全部食材 / 常用食材 / 上次订过）都用下拉框选择（分组含其下二级分组）；二级分组分区可点击折叠展开；顶部展示该客户更早一单并支持填入上次数量；订单模板（固定/常用）可一键载入；保存覆盖当天订单，底部浮层提示 |
| `/pickups` | 管理员、取货员 | 取货记录 | [`src/pages/PickupPage.tsx`](src/pages/PickupPage.tsx) | 按日期范围 / 关键词筛选；新增 / 修改 / 删除取货记录：日期、取货店名、税、金额、关联客户（选填）、备注、多张取货照片、多张发票照片；取货员只看和改自己的记录，管理员可改全部；照片自动压缩 |
| `/packing` | 管理员、打包发货员 | 打包发货 | [`src/pages/PackingPage.tsx`](src/pages/PackingPage.tsx) | 按日期范围 / 关键词筛选；新增 / 修改 / 删除打包发货记录：日期、物流名字、发货店名、关联客户（选填）、备注、多张打包发货照片、多张发票照片；打包员只看和改自己的记录，管理员可改全部；照片自动压缩 |
| `/summary` | 管理员、汇总订单员 | 汇总 | [`src/pages/SummaryPage.tsx`](src/pages/SummaryPage.tsx) | 单日或日期范围；顶部**下拉可多选客户**。日期卡下面先是可收纳的「全部客户汇总」总览（默认收起），再下面是「已选客户汇总」，随勾选实时刷新。导出 A4 采购汇总、拣货单或 **Tax Invoice**（只导所选客户，保留可拖拽排序预览弹窗；发票只能选一家）；导出发票前弹出「确认 / 编辑本次发票」，可改抬头、客户、明细、税率、银行、备注等，修改只保存为本次发票快照；采购汇总带「单价 / 总价」两列；只选一家时走单客户格式。窄屏改成卡片，宽屏仍是表格 |
| `/data` | 管理员 | 数据 | [`src/pages/DataPage.tsx`](src/pages/DataPage.tsx) | 导出 / 导入整份备份；导出可读汇总 Excel / 完整归档 ZIP；按时间段预览并清理数据；设置导出字体和字号；编辑发票设置；账号信息、修改密码、用户管理（含角色修改） |

壳子：[`src/components/AppShell.tsx`](src/components/AppShell.tsx)。底部导航按角色生成；管理员是「食材 / 客户 / 订单 / 汇总 / 更多」，取货、打包、数据在「更多」里。路由守卫在 [`src/components/RequireRole.tsx`](src/components/RequireRole.tsx)。

**本地测试角色**：开发环境（`npm run dev` / `npm start`）且未开启登录时，顶部会出现「本地测试角色」下拉，可切换 5 种角色查看页面。生产构建和云端服务器不会显示，也不会读取本地保存的测试角色。

## 6. 汇总与 Excel

算法在 `buildSummary`（[`src/store/useAppStore.ts`](src/store/useAppStore.ts)）：

1. 筛出 `date` 落在区间内（含首尾）的订单
2. 按 `ingredientId × buyerId` 把数量相加
3. 只保留「至少有一家订了」的食材
4. 客户列按 `sort` 排
5. 按分组分段：先一级分组，紧跟它下面的二级分组（食材没有二级分组时直接算该一级分组）

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
5. 合计（只有「全部客户」汇总才有；单个客户导出没有这一列）
6. 单价
7. 总价

单价取食材信息里的 `price`；总价 = 该表数量合计 × 单价（单个客户导出时就是这一家的数量 × 单价）。没有单价时两列留空。

> 注意：**Excel 有意不导出图片和备注**（网页汇总仍显示缩略图 + 备注）。这是需求决定的不一致，别当成 bug 去「修」。

导出前有 3 行：第 1 行标题、第 2 行统计区间 + 导出时间、第 3 行表头。标题在单个客户导出时是「客户名 + 采购汇总」（拣货单同理，客户名 + 拣货单）。**单个客户汇总**在第 1 行标题下还会多一行店铺信息（合并整行）：`地址：… 电话：… 物流公司：… 下单日期：起始 ~ 结束`，空字段省略、下单日期按导出区间显示；这一行随表头每页重复。全部客户汇总、拣货单不加这行。分组行合并整行，只写组名；一级分组一行、它下面的二级分组再缩进一行。列宽：CODE 9、名字 30、中文 13，其余按内容；拣货单 中文 13 / CODE 9 / 名字 38 / 数量 10 / 备注 12。页边距、A4（横向，缩放一页宽）、每页重复表头、页脚页码由 [`src/utils/excelStyle.ts`](src/utils/excelStyle.ts) 统一设置。字体取 `settings.fontFamily`；「名字」列居左，其余居中。

文件名：

- 中文：`采购汇总-2026-09-21.xlsx` 或 `采购汇总-2026-09-01_2026-09-21.xlsx`
- 单个客户：`采购汇总-店名-2026-09-01_2026-09-21.xlsx`
- 英文：`procurement-summary-...xlsx`

单个客户就是「只勾选一家」的情况：在下拉里只勾一家时，已选客户汇总和导出都走单客户格式（标题「客户名 + 采购汇总」、带店铺信息行、没有合计列）。勾选多家则按多列汇总，数量为所选客户的合计（拣货单同理）。顶部下拉默认不选；用「全选」可一次导出全部客户。

### 拣货单

[`src/utils/exportPickingList.ts`](src/utils/exportPickingList.ts)。同样选日期范围（可加客户筛选，默认全部合并）。按分组逐行：

- 一级分组一行标题（合并整行），二级分组再缩进一行标题
- 该组每样食材一行：中文、CODE、名字、数量、备注

数量为所选范围内客户的合计（选定某一家时就是这一家的数量）。选定某一家时标题为「客户名 + 拣货单」。A4 纵向。文件名 `拣货单-2026-09-01_2026-09-21.xlsx`（英文 `picking-list-...`）。

改汇总规则时，网页矩阵和 Excel 必须一起改，数字和出现的行/列要一致（图片/备注是有意只差在 Excel 上）。

### Tax Invoice

[`src/utils/exportInvoice.ts`](src/utils/exportInvoice.ts)。只在汇总页**正好选中一家客户**时可用（「导出 Tax Invoice」按钮）。A4 纵向，版式参考客户提供的发票：

- 标题 Tax Invoice + 公司名 / 标语
- Bill to / Ship to：客户名字 + 地址 + 电话
- 右上公司信息（公司名、标语、电话、ABN、邮箱、地址）
- Amount due / Due date / Issue date / Invoice number
- 明细：Description（食材名字 + 单位）、Quantity、Price、Tax、Amount
- Subtotal / Total / Amount due
- 付款说明 + 银行信息 + 收货备注

数量取该客户在所选区间的合计；单价取食材 `price`；金额 = 数量 × 单价。开票日 = 导出当天，到期日 = 开票日 + 账期（默认 7 天）。发票号 = 前缀 + 至少 4 位数字，导出成功后 `nextInvoiceNumber` 自动 +1。发票语言固定英文；公司 / 银行 / 税率 / 账期 / 发票号都在「数据」页的「发票设置」里改。

点「导出 Tax Invoice」会先弹出「确认 / 编辑本次发票」，预填当前发票设置、客户信息和汇总明细。汇总订单员可修改本次发票的发票号、开票日、到期日、公司抬头、Bill to / Ship to、明细描述 / 数量 / 单价、税率、货币、银行信息和备注。修改只写入本次 `invoiceRecords` 快照，不修改订单、食材、客户，也不覆盖「数据」页的全局发票设置。确认后再选 **Excel** 或 **PDF**：Excel 直接下载；PDF 会打开浏览器打印窗口，选「另存为 PDF」即可（中文用系统字体渲染，不依赖额外字体文件）。发票号必须唯一，保存成功后 `nextInvoiceNumber` 自动递增。

## 7. 国际化

- 词条：[`src/i18n/zh.ts`](src/i18n/zh.ts)、[`src/i18n/en.ts`](src/i18n/en.ts)
- 初始化：[`src/i18n/index.ts`](src/i18n/index.ts)
- 当前语言：`data/db.json` → `settings.locale`
- 新按钮、空状态、报错都要中英各写一条，不要在页面里写死中文或英文（用户录入的名字除外）

预置分组翻译 key：`groups.fresh` / `groups.frozen` / `groups.packaged`。

## 8. 关键交互（改功能时不要破坏）

- 新增食材：必须有图片、CODE、中文；备注可选。CODE 不能和已有食材重复。单价、单位可选，单价缺省 0。旧数据缺 CODE/备注/单价/单位时按空 / 0 显示，再编辑时补上。
- 上传图片：相册/文件选择，浏览器里压成 preview + thumb，再写入 `data/images/`。手机可选拍照或相册。
- 同一天同一客户再打开订单页，要带回当天已保存数量。
- 订单页搜索框右侧有「×」清空按钮；可按分组筛选，也可只看该客户上次订过的食材。
- 食材页搜索框同样带「×」清空；搜索时只显示命中的分组和食材。
- 分组分两级：一级分组下可自定义命名二级分组，越界按钮在「管理分组」里。删除一级分组会连同它的二级分组一起删；任一组下有食材都会拦住。旧数据里直接挂在一级分组上的食材，读取时自动归入该一级分组下的「未分类」二级分组。
- 客户数量不设上限；订单页客户改成下拉框选择。客户代码选填但唯一（重复会报错），订单页下拉只显示代码，没填代码就显示名字。
- 常用产品库：每个客户一份常用食材清单（只存食材、不存数量）。在客户页编辑客户时点「添加常用产品库」打开选食材子界面（搜索 / 分组筛选 / 勾选）；录入订单选中该客户后默认只看这些常用食材，可切「全部食材」。它和「订单模板（固定/常用）」是两套独立功能，互不影响。
- 采购汇总、单个客户汇总会导出「单价 / 总价」两列；单个客户（或拣货单选定某一家）导出时，标题是「客户名 + 采购汇总 / 拣货单」。
- 汇总页只选一家客户时，可点「导出 Tax Invoice」生成 A4 发票；发票号自动递增，公司 / 银行 / 税率 / 账期 / 发票号在「数据」页「发票设置」里改。
- 「客户」页可填地址 / 电话 / 物流公司，这三项只在**单个客户汇总**的表头信息行里用到，不是必填。
- 食材页一级 / 二级分组、订单页二级分组分区都可以点击标题折叠展开（食材页搜索时自动展开）。
- 汇总页顶部下拉可多选客户（默认不选）；「已选客户汇总」随勾选和日期范围实时刷新；导出采购汇总 / 拣货单只针对所选客户，只选一家时走单客户格式。下方「全部客户汇总」只是只读总览，不受选择影响。
- 订单模板：`固定订单` 存数量，点一下只填入还没有数量的项（不覆盖已填/已保存的数字）；`常用订单` 只存食材清单，载入后把列表筛成这些食材。模板存在 `templates` 里，按客户区分。
- 若该客户在所选日期之前有订单，顶部显示「上次订购」及数量，可单项或一键填入。不自动覆盖当天已填数字（点填入才会写入）。
- 保存（食材 / 客户 / 分组 / 订单 / 模板 / 字体）成功后，屏幕底部弹出浮层提示并自动消失。
- 「数据」页可选导出 Excel 的字体（默认微软雅黑）。字体只是指定字体名，电脑没装时会回退，无法内嵌。
- 切语言立刻换界面，不整页刷新；食材名保持原样。
- 刷新页面或重启 `npm run dev` 后，电脑文件模式的 `data/` 还在；设备模式刷新后 IndexedDB 还在。
- 「数据」页导出的备份含图片；导入前要确认，导入后当前数据被整份替换。电脑和手机可互导。
- 手机浏览器能完成同样的增删改、录单、汇总和导入导出。输入框不小于 16px，避免 iOS 自动放大。
- 设备模式与文件模式数据默认不互通。页面会说明当前存在哪。
- 角色权限：页面守卫 + 服务端接口校验。录入员只能进订单页；取货员只能进取货页；打包员只能进打包页；汇总订单员只能进汇总页；管理员全部可见可改。
- 上传照片：食材图最长边 800px、目标 ≤300KB；取货 / 打包照片（含发票照片）最长边 1600px、目标 ≤600KB；超过目标会自动降质量，服务端单张上限 2MB。
- 取货员和打包发货员都可以一次上传多张工作照片，并单独上传多张发票照片。新记录至少需要一张工作照片和一张发票照片；编辑旧记录时发票照片可不补。
- 取货 / 打包记录默认只显示自己的；管理员可看全部。编辑时移除照片、删除记录都会同步删除对应图片文件。
- 「数据」页的「导出可读报表（Excel）」包含订单明细、采购汇总、拣货单、取货、打包、发票和基础资料；「导出完整归档包（ZIP）」额外包含照片和 `db.json`。
- 「数据」页的「数据清理」先预览数量，再要求勾选确认并输入 `DELETE`；服务端会先生成 `data/pre-purge/` 安全备份，再删除区间内订单 / 取货 / 打包 / 可选发票记录和照片，并清理无引用图片。食材、客户、模板、发票号默认保留。
- 本地开发时顶部有「本地测试角色」下拉；生产构建（`npm run build` 后的服务器版本）不显示，现场账号仍按服务端登录角色。

## 9. 以后怎么改，才能和系统对得上

按下面顺序做，避免页面、文件、文档各写各的：

1. 先改本文对应章节（需求、字段、页面、规则）。
2. 若动数据结构：改 `src/types.ts` → `src/storage/defaultDb.ts` → `src/storage/normalizeDb.ts`（旧数据补默认值）→ store → 各页面。旧的 `data/db.json` 如不兼容，要在 `normalizeDb` 里补，或说明如何手工改文件。
3. 若动文案：同时改 `zh.ts` 和 `en.ts`。
4. 若动汇总：同时改 `buildSummary`、汇总页、`exportSummary.ts`（拣货单还要改 `exportPickingList.ts`；A4/字体/对齐改 `excelStyle.ts`）。
5. 若动存盘：同时改实体接口 / IndexedDB 适配和本文第 3、4 节。文件模式不要改回用 localStorage；设备模式只用 IndexedDB `ecolink`。多人共享靠「按实体接口」，不要再改回整份覆盖。
6. 改完后用浏览器走一遍：加食材（含图）→ 加客户 → 录两家订单 → 看汇总数字 → 导出 Excel → 导出备份再导入核对 → 切英文。电脑文件模式打开 `data/db.json` 和 `data/images/` 核对。再 `npm run static` 确认没有 `/api/db` 时仍能保存（IndexedDB），刷新还在。窄屏还要看底部 5 个 Tab、汇总卡片、弹出层不被键盘挡住。

## 10. 明确不做

- 单位、库存（单价 / 金额已支持，见第 6 节）
- 食材英文名、一张食材多图
- 独立拍照按钮、用图片 URL 当主数据
- PDF / CSV
- 电脑文件模式把业务数据存进浏览器
- 订单的字段级自动合并（冲突以「日期 + 客户」整单覆盖为准）
- 社交登录 / 短信验证码 / 邮件找回密码（忘记密码由管理员重置）
