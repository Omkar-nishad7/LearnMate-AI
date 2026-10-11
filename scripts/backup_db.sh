#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

DB_NAME="${MYSQL_DATABASE:-learnmate}"
DB_USER="${MYSQL_USER:-learnmate}"
DB_PASS="${MYSQL_PASSWORD:?MYSQL_PASSWORD must be configured for backups}"
DB_HOST="${MYSQL_HOST:-mysql}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_PREFIX="${BACKUP_S3_PREFIX:-db}"

[[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || { echo '[backup] invalid MYSQL_DATABASE' >&2; exit 2; }
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || { echo '[backup] BACKUP_RETENTION_DAYS must be a non-negative integer' >&2; exit 2; }

TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/${DB_NAME}-${TS}.sql.gz"
TMP="${OUT}.tmp"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
trap 'rm -f "$TMP"' EXIT

# MYSQL_PWD avoids putting the password in mysqldump's process arguments.
export MYSQL_PWD="$DB_PASS"
echo "[backup] dumping ${DB_NAME}@${DB_HOST} to ${OUT}"
mysqldump --host="$DB_HOST" --user="$DB_USER" \
  --single-transaction --routines --triggers --events "$DB_NAME" | gzip -9 > "$TMP"
test -s "$TMP"
gzip -t "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"

if [[ -n "$S3_BUCKET" ]]; then
  command -v aws >/dev/null 2>&1 || { echo '[backup] BACKUP_S3_BUCKET is set but aws CLI is unavailable' >&2; exit 1; }
  aws_args=()
  [[ -n "${BACKUP_S3_ENDPOINT:-}" ]] && aws_args+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
  OBJECT_KEY="${S3_PREFIX%/}/${DB_NAME}-${TS}.sql.gz"
  aws "${aws_args[@]}" s3 cp "$OUT" "s3://${S3_BUCKET%/}/${OBJECT_KEY}" --sse AES256
  # Confirm the remote object exists before reporting success.
  aws "${aws_args[@]}" s3api head-object --bucket "${S3_BUCKET%/}" --key "$OBJECT_KEY" >/dev/null
  echo "[backup] uploaded and verified remote object s3://${S3_BUCKET%/}/${OBJECT_KEY}"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] completed: ${OUT}"
