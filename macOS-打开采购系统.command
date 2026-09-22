#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/ensure-node.sh "macOS-打开采购系统.command" "macOS-安装运行环境.command" 2>/dev/null || true

echo "正在检查 macOS 运行环境..."
if ! ./scripts/ensure-node.sh; then
  echo
  echo "未准备好 Node.js。请先双击「macOS-安装运行环境.command」，完成后再打开网站。"
  read -r
  exit 1
fi

export PATH="$PWD/tools/node/bin:/usr/local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 仍未找到 node。请先运行「macOS-安装运行环境.command」。"
  read -r
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "首次使用，正在安装依赖，请稍候..."
  npm install --legacy-peer-deps || {
    echo "依赖安装失败。"
    read -r
    exit 1
  }
fi

echo "正在启动 EcoLink..."
echo "电脑浏览器会自动打开 http://localhost:5173"
echo "手机请连同一 Wi-Fi，用浏览器打开："
node scripts/print-lan-urls.cjs
echo "请保持本窗口开启。关闭窗口即停止网站。"
npm start
echo "网站已停止。"
read -r
