#!/bin/sh
set -eu

# One-off commands passed to `docker compose run backup ...` execute directly.
# With no command, run the scheduled backup loop used by the long-lived service.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

while :; do
  /usr/local/bin/backup_db.sh || echo '[backup] backup failed; check container logs' >&2
  sleep 86400
done
