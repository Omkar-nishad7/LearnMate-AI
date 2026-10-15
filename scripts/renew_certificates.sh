#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot --quiet
"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" exec -T nginx nginx -s reload
