#!/usr/bin/env bash
# EcoLink 数据恢复脚本
#
# 用法：
#   bash /opt/ecolink/restore.sh /opt/ecolink/backups/ecolink-20261003-033000.tar.gz
#
# 作用：用指定的备份覆盖 data/ 目录。
#   1) 先停掉服务
#   2) 把当前 data/ 改名留底（data.before-restore-<时间>），出问题可回退
#   3) 解压备份
#   4) 重新启动服务
set -euo pipefail

APP_DIR="${ECOLINK_APP_DIR:-/opt/ecolink}"
DATA_DIR="${ECOLINK_DATA_DIR:-$APP_DIR/data}"
ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "用法：bash restore.sh <备份文件路径>" >&2
  echo "可用备份：" >&2
  ls -lh "${ECOLINK_BACKUP_DIR:-$APP_DIR/backups}" 2>/dev/null >&2 || true
  exit 1
fi

echo "即将用以下备份覆盖 $DATA_DIR ："
echo "  $ARCHIVE"
echo "当前数据会先改名留底（data.before-restore-<时间>）。"
read -r -p "确认恢复请输入 yes 回车：" ANSWER
if [ "$ANSWER" != "yes" ]; then
  echo "已取消。"
  exit 1
fi

echo "[restore] 停止服务"
pm2 stop ecolink || true

echo "[restore] 留底当前数据"
if [ -d "$DATA_DIR" ]; then
  mv "$DATA_DIR" "$DATA_DIR.before-restore-$(date +%Y%m%d-%H%M%S)"
fi

echo "[restore] 解压备份"
mkdir -p "$(dirname "$DATA_DIR")"
tar -xzf "$ARCHIVE" -C "$(dirname "$DATA_DIR")"

echo "[restore] 启动服务"
pm2 start ecolink || true

echo "[restore] 完成。建议浏览器打开网站核对数据，再删除留底目录。"
