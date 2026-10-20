# EcoLink 云服务器部署手册（P1：先跑通）

> 目标：把「前端 + 现有 Node 服务」部署到香港轻量服务器，用 **IP 内测**，
> 让所有用户访问同一个地址、共享同一份数据。
>
> 本阶段**不含**登录、SQLite、并发控制，那些属于 P2–P4。
> 本目录只新增部署文件，**未改动任何现有业务代码**。

---

## 0. 目录说明

| 文件 | 作用 |
| --- | --- |
| `entry.ts` | 云服务器入口，复用现有 `server/standalone.ts`（只监听 127.0.0.1） |
| `bootstrap.sh` | 服务器初始化：装 Node 20 / Nginx / PM2、建目录、配防火墙 |
| `nginx-ecolink.conf` | Nginx 站点配置（静态资源 + 反代 `/api`） |
| `ecosystem.config.cjs` | PM2 守护配置（开机自启） |
| `.env.example` | 环境变量模板（P2/P4 用） |
| `build-deploy.ps1` | 本地 Windows 一键构建**带版本号**的部署包 |
| `update.sh` | 服务器版本化更新：备份数据 + 备份旧代码 + 解压 + 重启 + 健康检查 |
| `rollback.sh` | 服务器代码回退：恢复 `code-backups/` 里的旧代码 |
| `out/`（构建后生成，勿提交） | 部署产物，含 `ecolink-deploy-v<版本>-<时间>.tar.gz` |

---

## 1. P0：你要先买好的东西

| 项 | 采购处 | 配置 |
| --- | --- | --- |
| 香港轻量应用服务器 | 腾讯云 / 阿里云 | Ubuntu 24.04，**1C2G** |
| 域名 | Namecheap / Porkbun / 阿里云 | 任意便宜后缀 |

买完请记录（**不要发密码给我**）：

- 服务器**公网 IP**
- 登录方式：密码 还是 密钥
- 域名（P5 再用）

---

## 2. 本地：构建版本化部署包（Windows）

每次构建前先改 [`package.json`](../package.json) 的 `version`，例如：

```powershell
npm version minor --no-git-tag-version
```

然后在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\build-deploy.ps1
```

完成后得到：

```text
deploy\out\ecolink-deploy-v1.1.0-20261020-003427.tar.gz
deploy\out\ecolink-deploy.tar.gz   # 最新版副本
deploy\out\version.json
deploy\out\VERSION
```

包名中的 `v1.1.0` 来自 `package.json`，时间戳来自构建时间。  
`version.json` 还会记录 Git commit、分支和是否有未提交改动。

> 注意：用 **tar.gz**，不要用 zip。Windows 的 `Compress-Archive` 生成的 zip 里是反斜杠路径，
> Linux 的 `unzip` 解压会出问题。
>
> 发布过的版本包不要删除或覆盖；`ecolink-deploy.tar.gz` 只是最新版副本，正式上传请用带版本号的文件。

---

## 3. 上传到服务器

首次初始化时把版本包和 `bootstrap.sh` 传上去：

```powershell
scp deploy\out\ecolink-deploy-v1.1.0-20261020-003427.tar.gz ubuntu@43.129.217.109:/home/ubuntu/
scp deploy\bootstrap.sh ubuntu@43.129.217.109:/home/ubuntu/
```

以后更新只上传新的版本包：

```powershell
scp deploy\out\ecolink-deploy-v1.2.0-20261101-093000.tar.gz ubuntu@43.129.217.109:/home/ubuntu/
```

---

## 4. 服务器：初始化环境

SSH 登录服务器：

```bash
ssh ubuntu@43.129.217.109
sudo bash /home/ubuntu/bootstrap.sh
```

完成后，服务器已装好 Node 20 / Nginx / PM2，并建好 `/opt/ecolink/`。

---

## 5. 服务器：部署与更新

### 5.1 首次部署

```bash
# 1) 解压版本包到 /opt/ecolink
tar -xzf /home/ubuntu/ecolink-deploy-v1.1.0-20261020-003427.tar.gz -C /opt/ecolink

# 2) 启动服务（PM2）
cd /opt/ecolink
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # 按提示执行输出里那条命令，实现开机自启

# 3) 配置 Nginx
cp /opt/ecolink/nginx-ecolink.conf /etc/nginx/sites-available/ecolink
ln -sf /etc/nginx/sites-available/ecolink /etc/nginx/sites-enabled/ecolink
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

首次解压后，服务器上会有 `/opt/ecolink/update.sh` 和 `/opt/ecolink/rollback.sh`。

### 5.2 以后更新（推荐）

```bash
bash /opt/ecolink/update.sh /home/ubuntu/ecolink-deploy-v1.2.0-20261101-093000.tar.gz
```

`update.sh` 会自动：

1. 校验包内 `version.json`
2. 备份 `data/`
3. 把当前 `dist/`、`server.cjs`、配置和脚本备份到 `/opt/ecolink/code-backups/`
4. 停止 PM2、解压新版本、启动 PM2
5. 输出当前版本并做本地健康检查

更新后检查：

```bash
cat /opt/ecolink/VERSION
pm2 status
```

### 5.3 回退

只回退代码：

```bash
ls -lh /opt/ecolink/code-backups
bash /opt/ecolink/rollback.sh /opt/ecolink/code-backups/code-before-20261020-003427.tar.gz
```

同时回退数据：

```bash
ls -lh /opt/ecolink/backups
bash /opt/ecolink/restore.sh /opt/ecolink/backups/ecolink-20261020-033000.tar.gz
```

> 新版本增加了旧代码不认识的字段时，只回退代码可能导致新数据在旧代码下次写入时丢失。  
> 回退代码前先导出完整归档包，或者代码和数据一起回退。

---

## 6. 验证

在服务器上：

```bash
cat /opt/ecolink/VERSION         # 版本、构建时间、Git commit
pm2 status                       # ecolink 应为 online
curl -i http://127.0.0.1:3000/api/db   # 应返回 JSON
curl -i http://127.0.0.1/api/db        # Nginx 反代也应返回 JSON
```

浏览器打开 `http://你的公网IP/`：

- 页面能打开；
- 到「数据」页看提示应是「存储在本机文件」而不是「本机浏览器」；
- 换一台设备/手机打开同一地址，新增一条客户，两边都能看到 → **共享成功**。

> 首次访问会自动在 `/opt/ecolink/data/` 生成 `db.json`。

---

## 7. 账号登录（P2）

部署包已内置登录功能，`ecosystem.config.cjs` 里设置了 `ECOLINK_AUTH=1`。
**必须先创建管理员账号**，否则没人能登录。

首次部署（或更新已有部署）后执行：

```bash
cd /opt/ecolink
node server.cjs create-admin admin 你的密码      # 密码至少 6 位
```

新增指定角色账号（角色：`admin` / `editor` / `picker` / `packer` / `summarizer`）：

```bash
cd /opt/ecolink
node server.cjs create-user picker 初始密码 picker
node server.cjs create-user packer 初始密码 packer
node server.cjs create-user summarizer 初始密码 summarizer
```

修改已有账号角色：

```bash
cd /opt/ecolink
node server.cjs set-role 账号 editor
```

忘记密码时重置：

```bash
cd /opt/ecolink
node server.cjs reset-password admin 新密码
```

> 如果之前已经启动过旧版本，需要**重建进程**让新环境变量生效：

```bash
cd /opt/ecolink
pm2 delete ecolink
pm2 start ecosystem.config.cjs
pm2 save
```

登录后可在网页「数据」页管理用户（新增 / 删除 / 修改角色 / 重置密码 / 修改自己的密码）。
账号数据保存在 `/opt/ecolink/data/auth.json`（密码是 scrypt 哈希），备份时一并带上。

角色权限：

- `admin`：全部页面和全部修改权限。
- `editor`：订单录入；看不到食材、客户、汇总、数据页面。
- `picker`：取货记录，可上传多张取货照片和发票照片；只能看和改自己的记录。
- `packer`：打包发货记录，可上传多张打包照片和发票照片；只能看和改自己的记录。
- `summarizer`：汇总导出；只读业务数据，可编辑本次发票内容。

> 本地开发时页面顶部会出现「本地测试角色」下拉，方便切换角色查看页面；**生产构建不会显示**，服务器上请用真实账号登录。

---

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| 浏览器打不开 | 云控制台**安全组**是否放行 80/443；`ufw status` |
| 502 Bad Gateway | `pm2 status` 看是否 online；`pm2 logs ecolink` 看报错 |
| `/api/db` 返回 HTML | Nginx 的 `/api/` 反代没生效，检查配置后 `nginx -t && systemctl reload nginx` |
| 上传大备份失败 | 已设 `client_max_body_size 120m`；仍失败看 Nginx 日志 |
| 改完配置不生效 | `systemctl reload nginx` 或 `pm2 restart ecolink` |

---

## 9. 每日自动备份（P4）

部署包附带 `backup.sh`（备份）和 `restore.sh`（恢复），解压在 `/opt/ecolink/`。

### 9.1 先手动跑一次

```bash
chmod +x /opt/ecolink/backup.sh /opt/ecolink/restore.sh
bash /opt/ecolink/backup.sh
```

会在 `/opt/ecolink/backups/` 生成 `ecolink-<时间>.tar.gz`（含 `db.json`、`auth.json`、`images/`），只保留最近 30 天。

### 9.2 设置每天自动执行（03:30）

```bash
mkdir -p /opt/ecolink/logs
( crontab -l 2>/dev/null; echo "30 3 * * * bash /opt/ecolink/backup.sh >> /opt/ecolink/logs/backup.log 2>&1" ) | crontab -
crontab -l
```

### 9.3 备份到对象存储（异地，强烈建议）

本地备份挡不住"整块盘坏掉"，最好再传一份到腾讯云 COS：

```bash
curl https://rclone.org/install.sh | sudo bash   # 安装 rclone
rclone config                                    # 配置一个 S3 兼容远端（腾讯云 COS）
```

配好后把远端写进定时任务：

```bash
( crontab -l 2>/dev/null; echo "30 3 * * * ECOLINK_RCLONE_REMOTE=cos:你的桶名 bash /opt/ecolink/backup.sh >> /opt/ecolink/logs/backup.log 2>&1" ) | crontab -
```

> 更省事的替代：用腾讯云轻量的**自动快照**（控制台设置周期快照）。

### 9.4 恢复（含演练）

```bash
bash /opt/ecolink/restore.sh /opt/ecolink/backups/ecolink-YYYYMMDD-HHMMSS.tar.gz
```

脚本会先停服务、把当前数据改名留底（`data.before-restore-*`），再解压、重启。核对无误后再删留底目录。**建议每月在测试环境演练一次。**

### 9.5 网页清理旧数据

管理员可在网页「数据」页 →「数据清理」按时间段删除订单、取货、打包记录和照片。服务端会：

1. 先写一份 `data/pre-purge/backup-*.json`（含图片，保留最近 3 份）；
2. 删除区间内记录和照片；
3. 清理无引用图片；
4. 写入 `data/cleanup-log.json`。

清理前请先在「数据」页导出可读报表或完整归档包，并保存到其他存储盘。清理不会删除 `data/backups/` 里的每日备份。

---

## 10. 安全提醒

- 已启用账号登录：未登录不能读写任何数据。
- 会话 Cookie 为 httpOnly + Secure，仅在 HTTPS 下传输。
- 仍建议在云安全组把来源限制为团队常用网络，并定期备份 `data/` 目录。

---

## 11. 下一步（可选加固）

- 腾讯云控制台开启 **CPU / 磁盘 / 宕机告警**，并打开**自动续费**。
- 设置**轻量自动快照**（异地整盘保护）。
- 以后数据量大或要多实例时，再把存储迁到 SQLite / 云数据库。
