#!/usr/bin/env bash
set -Eeuo pipefail

# Manual application-code rollback only. This does NOT reverse database migrations.
# Restore the database from a verified pre-deploy backup only under a reviewed recovery plan.
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
cd "$(dirname "$0")/.."
test -f .previous-release || { echo 'No .previous-release file exists; cannot determine prior revision.' >&2; exit 2; }
PREVIOUS_SHA="$(cat .previous-release)"
git cat-file -e "${PREVIOUS_SHA}^{commit}"
printf 'This rolls application code back to %s but does not revert DB migrations. Continue? [type ROLLBACK] ' "$PREVIOUS_SHA"
read -r CONFIRM
[[ "$CONFIRM" == ROLLBACK ]] || { echo 'Cancelled.'; exit 1; }
git reset --hard "$PREVIOUS_SHA"
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --remove-orphans
"${COMPOSE[@]}" ps
printf 'Application code rolled back to %s. Verify health and schema compatibility before reopening traffic.\n' "$PREVIOUS_SHA"
