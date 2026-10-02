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
| `build-deploy.ps1` | 本地 Windows 一键构建部署包 |
| `out/`（构建后生成，勿提交） | 部署产物 |

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

## 2. 本地：构建部署包（Windows）

在项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\build-deploy.ps1
```

完成后得到 `deploy\out\ecolink-deploy.tar.gz`。

> 注意：用 **tar.gz**，不要用 zip。Windows 的 `Compress-Archive` 生成的 zip 里是反斜杠路径，
> Linux 的 `unzip` 解压会出问题。

---

## 3. 上传到服务器

把压缩包和 `bootstrap.sh` 传上去（把 `IP` 换成你的公网 IP，用户按你的登录方式，可能不是 root）：

```powershell
scp deploy\out\ecolink-deploy.tar.gz root@IP:/root/
scp deploy\bootstrap.sh root@IP:/root/
```

---

## 4. 服务器：初始化环境

SSH 登录服务器（把 `IP` 换成你的公网 IP）：

```bash
ssh root@IP
sudo bash /root/bootstrap.sh
```

完成后，服务器已装好 Node 20 / Nginx / PM2，并建好 `/opt/ecolink/`。

---

## 5. 服务器：部署应用

```bash
# 1) 解压部署包到 /opt/ecolink
tar -xzf /root/ecolink-deploy.tar.gz -C /opt/ecolink

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

---

## 6. 验证

在服务器上：

```bash
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

登录后可在网页「数据」页管理用户（新增 / 删除 / 重置密码 / 修改自己的密码）。
账号数据保存在 `/opt/ecolink/data/auth.json`（密码是 scrypt 哈希），备份时一并带上。

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
