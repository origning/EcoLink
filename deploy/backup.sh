#!/usr/bin/env bash
# EcoLink 每日备份脚本
#
# 用法：
#   bash /opt/ecolink/backup.sh
# 定时（每天 03:30）：见 deploy/README.md 的 P4 章节
#
# 作用：把 data/ 目录（db.json、auth.json、images/）打包成一个 tar.gz，
#       放在 /opt/ecolink/backups，只保留最近 N 天。
#       如果配置了 rclone 远端，还会上传一份到对象存储（异地备份）。
#
# 可用环境变量：
#   ECOLINK_APP_DIR           应用目录，默认 /opt/ecolink
#   ECOLINK_DATA_DIR          数据目录，默认 $ECOLINK_APP_DIR/data
#   ECOLINK_BACKUP_DIR        备份存放目录，默认 $ECOLINK_APP_DIR/backups
#   ECOLINK_BACKUP_KEEP_DAYS  保留天数，默认 30
#   ECOLINK_RCLONE_REMOTE     可选，rclone 远端，例如 cos:ecolink-backup
set -euo pipefail

APP_DIR="${ECOLINK_APP_DIR:-/opt/ecolink}"
DATA_DIR="${ECOLINK_DATA_DIR:-$APP_DIR/data}"
BACKUP_DIR="${ECOLINK_BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${ECOLINK_BACKUP_KEEP_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/ecolink-$STAMP.tar.gz"

if [ ! -d "$DATA_DIR" ]; then
  echo "[backup] 找不到数据目录：$DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# 打包 data 目录（-C 到父目录，归档里保留 data/ 这一层，方便恢复）
tar -czf "$ARCHIVE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

# 清理过期备份
find "$BACKUP_DIR" -name 'ecolink-*.tar.gz' -type f -mtime +"$KEEP_DAYS" -delete

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "[backup] 已生成 $ARCHIVE ($SIZE)"

# 可选：上传到对象存储（需先配置 rclone remote）
if [ -n "${ECOLINK_RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$ARCHIVE" "$ECOLINK_RCLONE_REMOTE"
    echo "[backup] 已上传到 $ECOLINK_RCLONE_REMOTE"
  else
    echo "[backup] 警告：设置了 ECOLINK_RCLONE_REMOTE 但未安装 rclone，已跳过上传" >&2
  fi
fi

echo "[backup] 当前备份目录："
ls -lh "$BACKUP_DIR"
