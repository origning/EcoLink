#!/usr/bin/env bash
# EcoLink versioned update script.
#
# Usage (on the server):
#   bash update.sh /home/ubuntu/ecolink-deploy-v1.1.0-20261020-003427.tar.gz
#
# What it does:
#   1) verify the package contains version.json
#   2) back up data/ using backup.sh
#   3) back up the current dist/ and server.cjs under code-backups/
#   4) stop PM2, extract the new package, start PM2
#   5) show the installed version and run a local health check
set -euo pipefail

APP_DIR="${ECOLINK_APP_DIR:-/opt/ecolink}"
ARCHIVE="${1:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CODE_BACKUP_DIR="$APP_DIR/code-backups"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: bash update.sh <ecolink-deploy-vX.Y.Z-YYYYMMDD-HHMMSS.tar.gz>" >&2
  exit 1
fi

if [ ! -f "$APP_DIR/server.cjs" ]; then
  echo "[update] $APP_DIR/server.cjs not found. Is the app installed here?" >&2
  exit 1
fi

if ! tar -tzf "$ARCHIVE" | grep -qx "version.json"; then
  echo "[update] invalid package: version.json is missing" >&2
  exit 1
fi

mkdir -p "$CODE_BACKUP_DIR"

echo "[update] 1/5 backing up data"
if [ -f "$APP_DIR/backup.sh" ]; then
  bash "$APP_DIR/backup.sh"
else
  echo "[update] WARNING: backup.sh not found, skipping data backup" >&2
fi

echo "[update] 2/5 backing up current code"
FILES=(dist server.cjs ecosystem.config.cjs)
for file in version.json VERSION backup.sh restore.sh update.sh rollback.sh nginx-ecolink.conf; do
  if [ -e "$APP_DIR/$file" ]; then
    FILES+=("$file")
  fi
done
tar -czf "$CODE_BACKUP_DIR/code-before-$STAMP.tar.gz" -C "$APP_DIR" "${FILES[@]}"
echo "[update] code backup: $CODE_BACKUP_DIR/code-before-$STAMP.tar.gz"

echo "[update] 3/5 stopping PM2"
pm2 stop ecolink >/dev/null 2>&1 || true

echo "[update] 4/5 extracting $ARCHIVE"
tar -xzf "$ARCHIVE" -C "$APP_DIR"

echo "[update] 5/5 starting PM2"
pm2 start ecolink >/dev/null 2>&1 || pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save >/dev/null 2>&1 || true

echo "[update] installed version:"
cat "$APP_DIR/VERSION" 2>/dev/null || true

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/auth/me >/dev/null 2>&1; then
    echo "[update] OK: service is responding"
    exit 0
  fi
  sleep 1
done

echo "[update] WARNING: health check failed. Run: pm2 logs ecolink" >&2
exit 1
