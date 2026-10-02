#!/usr/bin/env bash
# EcoLink 云服务器初始化脚本（Ubuntu 22.04 / 24.04）
#
# 用法（在服务器上，用 root 或 sudo）：
#   sudo bash bootstrap.sh
#
# 作用：安装 Node 20 / Nginx / PM2，创建应用目录，配置防火墙与 fail2ban。
# 注意：本脚本只做环境准备，不涉及任何业务代码。
set -euo pipefail

APP_DIR="/opt/ecolink"
DEPLOY_USER="${SUDO_USER:-root}"

echo "==> 1/6 更新系统软件包"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> 2/6 安装基础工具"
apt-get install -y curl git ufw fail2ban ca-certificates gnupg

echo "==> 3/6 安装 Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node -v)  npm: $(npm -v)"

echo "==> 4/6 安装 Nginx 与 PM2"
apt-get install -y nginx
npm install -g pm2

echo "==> 5/6 创建应用目录 $APP_DIR"
mkdir -p "$APP_DIR/dist" "$APP_DIR/data" "$APP_DIR/logs"
if [ "$DEPLOY_USER" != "root" ]; then
  chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$APP_DIR"
fi

echo "==> 6/6 配置防火墙与 fail2ban"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now fail2ban
systemctl enable --now nginx

echo
echo "初始化完成。下一步："
echo "  1) 把部署包里的 dist/ 与 server.cjs 上传到 $APP_DIR"
echo "  2) 复制 ecosystem.config.cjs 到 $APP_DIR，执行 pm2 start ecosystem.config.cjs"
echo "  3) 复制 nginx-ecolink.conf 到 Nginx 并启用，然后重载"
