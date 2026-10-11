#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ $# -ne 1 ]]; then
  echo "usage: restore_db.sh /backups/database-YYYYMMDDTHHMMSSZ.sql.gz" >&2
  exit 2
fi

FILE="$1"
DB_NAME="${MYSQL_DATABASE:-learnmate}"
DB_HOST="${MYSQL_HOST:-mysql}"
DB_ROOT_USER="${MYSQL_ROOT_USER:-root}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:?Set MYSQL_ROOT_PASSWORD explicitly; no default is allowed}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

[[ -f "$FILE" && -r "$FILE" ]] || { echo "[restore] backup file not found/readable: $FILE" >&2; exit 2; }
[[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]] || { echo '[restore] invalid MYSQL_DATABASE' >&2; exit 2; }
[[ "$DB_HOST" =~ ^[A-Za-z0-9_.:-]+$ ]] || { echo '[restore] invalid MYSQL_HOST' >&2; exit 2; }
[[ "$DB_ROOT_USER" =~ ^[A-Za-z0-9_]+$ ]] || { echo '[restore] invalid MYSQL_ROOT_USER' >&2; exit 2; }
command -v mysql >/dev/null 2>&1 || { echo '[restore] mysql client is missing' >&2; exit 2; }
command -v mysqldump >/dev/null 2>&1 || { echo '[restore] mysqldump client is missing' >&2; exit 2; }
command -v gzip >/dev/null 2>&1 && command -v gunzip >/dev/null 2>&1 || { echo '[restore] gzip/gunzip is missing' >&2; exit 2; }

gzip -t -- "$FILE"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
SAFETY_BACKUP="${BACKUP_DIR}/${DB_NAME}-pre-restore-${TS}.sql.gz"
SAFETY_TMP="${SAFETY_BACKUP}.tmp"
trap 'rm -f -- "$SAFETY_TMP"' EXIT

# Keep credentials out of process arguments. This variable is inherited by the
# MySQL clients, rather than being passed as a --password argument.
export MYSQL_PWD="$DB_ROOT_PASS"
unset DB_ROOT_PASS MYSQL_ROOT_PASSWORD

DB_EXISTS="$(mysql --host="$DB_HOST" --user="$DB_ROOT_USER" --batch --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${DB_NAME}'")"
[[ "$DB_EXISTS" == 0 || "$DB_EXISTS" == 1 ]] || { echo '[restore] could not determine whether target database exists' >&2; exit 2; }

printf '[restore] Target: database=%s host=%s\n' "$DB_NAME" "$DB_HOST"
echo '[restore] This replaces the target database. A verified pre-restore dump will be created first if the database exists.'
echo '[restore] Ensure this is the intended server and that the selected input backup is the one you want.'
read -r -p "Type exactly '${DB_NAME}@${DB_HOST}' to continue: " CONFIRM
[[ "$CONFIRM" == "${DB_NAME}@${DB_HOST}" ]] || { echo '[restore] cancelled'; exit 1; }

if [[ "$DB_EXISTS" == 1 ]]; then
  echo "[restore] creating safety snapshot at ${SAFETY_BACKUP}"
  mysqldump --host="$DB_HOST" --user="$DB_ROOT_USER" \
    --single-transaction --routines --triggers --events "$DB_NAME" | gzip -9 > "$SAFETY_TMP"
  [[ -s "$SAFETY_TMP" ]] || { echo '[restore] safety dump is empty; refusing to replace the database' >&2; exit 2; }
  gzip -t -- "$SAFETY_TMP"
  mv -- "$SAFETY_TMP" "$SAFETY_BACKUP"
  chmod 600 "$SAFETY_BACKUP"
else
  echo '[restore] target database does not currently exist; no pre-restore snapshot is necessary.'
fi

mysql --host="$DB_HOST" --user="$DB_ROOT_USER" --batch --skip-column-names \
  -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[restore] importing ${FILE} into ${DB_NAME}"
if gunzip -c -- "$FILE" | mysql --host="$DB_HOST" --user="$DB_ROOT_USER" "$DB_NAME"; then
  unset MYSQL_PWD
  echo "[restore] completed. Run service health and data-integrity checks before reopening traffic."
  if [[ "$DB_EXISTS" == 1 ]]; then
    echo "[restore] previous database snapshot retained at ${SAFETY_BACKUP}"
  fi
  exit 0
fi

# The import failed after the target database was recreated. Restore the
# pre-restore snapshot automatically when one existed; otherwise remove the
# partial database so it is not mistaken for a successful restore.
echo '[restore] import failed; attempting to recover the pre-restore database state.' >&2
if [[ "$DB_EXISTS" == 1 && -s "$SAFETY_BACKUP" ]]; then
  if mysql --host="$DB_HOST" --user="$DB_ROOT_USER" --batch --skip-column-names \
    -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" \
    && gunzip -c -- "$SAFETY_BACKUP" | mysql --host="$DB_HOST" --user="$DB_ROOT_USER" "$DB_NAME"; then
    echo "[restore] previous database state recovered from ${SAFETY_BACKUP}" >&2
  else
    echo "[restore] CRITICAL: automatic recovery failed. Preserve ${SAFETY_BACKUP} and recover manually." >&2
    exit 3
  fi
else
  mysql --host="$DB_HOST" --user="$DB_ROOT_USER" --batch --skip-column-names \
    -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`;" || true
fi
unset MYSQL_PWD
echo '[restore] restore did not complete; do not reopen traffic until data integrity has been checked.' >&2
exit 1
