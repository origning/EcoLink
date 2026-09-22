#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/ensure-node.sh "macOS-打开采购系统.command" "macOS-安装运行环境.command" 2>/dev/null || true

echo "============================================"
echo "  macOS - 安装运行环境"
echo "============================================"
echo
echo "本程序会检查并安装 Node.js LTS。"
echo "安装来源只有官网 https://nodejs.org"
echo

if ! ./scripts/ensure-node.sh --system; then
  echo
  echo "环境未就绪，网站还不能打开。"
  read -r
  exit 1
fi

echo
echo "环境已准备好。下一步请双击「macOS-打开采购系统.command」。"
read -r
