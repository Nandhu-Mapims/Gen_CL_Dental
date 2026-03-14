#!/usr/bin/env bash
# MongoDB Backup Script - Creates/updates backup files (default: project-root/mongodb-backup-full)
# Run from project root or from backend/scripts/run/. Requires: mongodump in PATH.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

MONGO_HOST="${MONGO_HOST:-localhost}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DATABASE="${MONGO_DATABASE:-MRD_CL}"
MONGO_USER="${MONGO_USER:-${MONGO_ROOT_USERNAME:-}}"
MONGO_PASSWORD="${MONGO_PASSWORD:-${MONGO_ROOT_PASSWORD:-}}"
MONGO_AUTH_DB="${MONGO_AUTH_DB:-admin}"
OUT_DIR="${OUT_DIR:-$ROOT/mongodb-backup-full}"

echo "========================================="
echo "MongoDB Backup (Update backup files)"
echo "========================================="
echo ""
echo "Backup Configuration:"
echo "  Host: $MONGO_HOST"
echo "  Port: $MONGO_PORT"
echo "  Database: $MONGO_DATABASE"
echo "  Output: $OUT_DIR/$MONGO_DATABASE"
echo ""

mkdir -p "$OUT_DIR"

if ! command -v mongodump >/dev/null 2>&1; then
  echo "Error: mongodump command not found."
  echo "Install MongoDB Database Tools and add them to PATH."
  exit 1
fi

if [ -n "$MONGO_USER" ] && [ -n "$MONGO_PASSWORD" ]; then
  mongodump --host "$MONGO_HOST" --port "$MONGO_PORT" \
    --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase "$MONGO_AUTH_DB" \
    --db "$MONGO_DATABASE" --out "$OUT_DIR"
else
  mongodump --host "$MONGO_HOST" --port "$MONGO_PORT" \
    --db "$MONGO_DATABASE" --out "$OUT_DIR"
fi

echo ""
echo "========================================="
echo "Backup completed successfully"
echo "========================================="
echo "  Location: $OUT_DIR/$MONGO_DATABASE"
echo ""
