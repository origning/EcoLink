#!/usr/bin/env bash
# EcoLink code rollback script.
#
# Usage (on the server):
#   bash rollback.sh /opt/ecolink/code-backups/code-before-YYYYMMDD-HHMMSS.tar.gz
#
# This restores code files only (dist/, server.cjs, config, scripts).
# It does NOT restore data/.
#
# If the old code does not understand data created by the new code,
# also restore a data backup with:
#   bash restore.sh /opt/ecolink/backups/ecolink-YYYYMMDD-HHMMSS.tar.gz
set -euo pipefail

APP_DIR="${ECOLINK_APP_DIR:-/opt/ecolink}"
ARCHIVE="${1:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"
CODE_BACKUP_DIR="$APP_DIR/code-backups"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: bash rollback.sh <code-before-YYYYMMDD-HHMMSS.tar.gz>" >&2
  echo "Available code backups:" >&2
  ls -lh "$CODE_BACKUP_DIR" 2>/dev/null >&2 || true
  exit 1
fi

echo "This will restore code files from:"
echo "  $ARCHIVE"
echo "Data will NOT be restored. Use restore.sh separately if needed."
read -r -p "Type yes to continue: " ANSWER
if [ "$ANSWER" != "yes" ]; then
  echo "Cancelled."
  exit 1
fi

mkdir -p "$CODE_BACKUP_DIR"

echo "[rollback] 1/4 backing up current code"
FILES=(dist server.cjs ecosystem.config.cjs)
for file in version.json VERSION backup.sh restore.sh update.sh rollback.sh nginx-ecolink.conf; do
  if [ -e "$APP_DIR/$file" ]; then
    FILES+=("$file")
  fi
done
tar -czf "$CODE_BACKUP_DIR/code-before-rollback-$STAMP.tar.gz" -C "$APP_DIR" "${FILES[@]}"

echo "[rollback] 2/4 stopping PM2"
pm2 stop ecolink >/dev/null 2>&1 || true

echo "[rollback] 3/4 extracting $ARCHIVE"
tar -xzf "$ARCHIVE" -C "$APP_DIR"

echo "[rollback] 4/4 starting PM2"
pm2 start ecolink >/dev/null 2>&1 || pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save >/dev/null 2>&1 || true

echo "[rollback] installed version:"
cat "$APP_DIR/VERSION" 2>/dev/null || true

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/api/auth/me >/dev/null 2>&1; then
    echo "[rollback] OK: service is responding"
    exit 0
  fi
  sleep 1
done

echo "[rollback] WARNING: health check failed. Run: pm2 logs ecolink" >&2
exit 1
