#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORTABLE="$ROOT/tools/node"
MIN_MAJOR=20
PREFER_SYSTEM="${1:-}"

refresh_path() {
  export PATH="$PORTABLE/bin:/usr/local/bin:$PATH"
}

node_major() {
  local raw
  raw="$("$1" -v 2>/dev/null || true)"
  echo "$raw" | sed -n 's/v\([0-9][0-9]*\).*/\1/p'
}

usable_node() {
  refresh_path
  if [ -x "$PORTABLE/bin/node" ]; then
    local major
    major="$(node_major "$PORTABLE/bin/node")"
    if [ "${major:-0}" -ge "$MIN_MAJOR" ]; then
      export PATH="$PORTABLE/bin:$PATH"
      return 0
    fi
  fi
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node_major "$(command -v node)")"
    [ "${major:-0}" -ge "$MIN_MAJOR" ]
    return
  fi
  return 1
}

lts_version() {
  python3 - <<'PY'
import json, urllib.request
with urllib.request.urlopen("https://nodejs.org/dist/index.json") as res:
    data = json.load(res)
for item in data:
    if item.get("lts"):
        print(item["version"])
        break
else:
    raise SystemExit("no lts")
PY
}

install_portable() {
  local ver arch tarball url tmp
  ver="$(lts_version)"
  if [ "$(uname -m)" = "arm64" ]; then
    arch="darwin-arm64"
  else
    arch="darwin-x64"
  fi
  tarball="node-${ver}-${arch}.tar.gz"
  url="https://nodejs.org/dist/${ver}/${tarball}"
  tmp="$(mktemp -d)"
  echo "正在从 nodejs.org 下载 Node.js ${ver} LTS（便携版）..."
  curl -fsSL "$url" -o "$tmp/$tarball"
  echo "正在解压到 tools/node ..."
  tar -xzf "$tmp/$tarball" -C "$tmp"
  mkdir -p "$ROOT/tools"
  rm -rf "$PORTABLE"
  mv "$tmp/node-${ver}-${arch}" "$PORTABLE"
  rm -rf "$tmp"
}

install_system_pkg() {
  local ver pkg url
  ver="$(lts_version)"
  pkg="node-${ver}.pkg"
  url="https://nodejs.org/dist/${ver}/${pkg}"
  echo "正在下载官方 Node.js ${ver} 安装包..."
  curl -fsSL "$url" -o "/tmp/$pkg"
  echo "即将打开安装程序，请按提示完成安装。"
  open "/tmp/$pkg"
  echo "安装窗口关闭后，按回车继续检测。"
  read -r
}

if usable_node; then
  echo "已检测到 Node.js $(node -v) ，可以直接打开网站。"
  exit 0
fi

if [ "$PREFER_SYSTEM" = "--system" ]; then
  if ! install_system_pkg; then
    echo "系统安装未完成，改为安装便携版。"
  fi
  if ! usable_node; then
    install_portable
  fi
else
  install_portable
fi

refresh_path
if ! usable_node; then
  echo "[错误] 安装后仍未检测到 Node.js。请检查网络，或打开 https://nodejs.org 手动下载 LTS。"
  exit 1
fi

echo "Node.js $(node -v) 已就绪。"
