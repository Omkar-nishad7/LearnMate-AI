#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the production server from the project root after DNS points here and
# ports 80/443 are open. The initial HTTP Nginx configuration must be running.
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
read_env() { sed -n "s/^$1=//p" .env | tail -n 1 | sed -e 's/^"//' -e 's/"$//'; }
DOMAIN="${SERVER_NAME:-$(read_env SERVER_NAME)}"
EMAIL="${CERTBOT_EMAIL:-$(read_env CERTBOT_EMAIL)}"

[[ -n "$DOMAIN" && "$DOMAIN" != CHANGE_ME_DOMAIN && "$DOMAIN" != localhost ]] || { echo 'Set SERVER_NAME to your real domain in .env first.' >&2; exit 2; }
[[ -n "$EMAIL" && "$EMAIL" != CHANGE_ME_ADMIN_EMAIL && "$EMAIL" == *@* ]] || { echo 'Set CERTBOT_EMAIL to a real monitored email in .env first.' >&2; exit 2; }
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || { echo 'SERVER_NAME must be a plain DNS hostname.' >&2; exit 2; }

"${COMPOSE[@]}" config --quiet
mkdir -p certbot/conf certbot/www
"${COMPOSE[@]}" up -d --build mysql redis backend worker frontend nginx backup

for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://${DOMAIN}/health" >/dev/null; then break; fi
  if [[ "$i" == 30 ]]; then echo 'Nginx did not become reachable on HTTP; inspect docker compose logs nginx.' >&2; exit 1; fi
  sleep 2
done

"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot --email "$EMAIL" --agree-tos --no-eff-email \
  --non-interactive -d "$DOMAIN"

CERT="certbot/conf/live/${DOMAIN}/fullchain.pem"
KEY="certbot/conf/live/${DOMAIN}/privkey.pem"
test -s "$CERT" && test -s "$KEY"
TMP="nginx/conf.d/learnmate.https.conf.tmp"
sed "s/YOUR_DOMAIN/${DOMAIN}/g" nginx/conf.d/learnmate.https.conf.example > "$TMP"
mv "$TMP" nginx/conf.d/learnmate.https.conf

if ! "${COMPOSE[@]}" exec -T nginx nginx -t; then
  rm -f nginx/conf.d/learnmate.https.conf
  echo 'Generated HTTPS configuration failed validation; removed it. HTTP configuration remains active.' >&2
  exit 1
fi
"${COMPOSE[@]}" exec -T nginx nginx -s reload
curl -fsSI --max-time 15 "https://${DOMAIN}/" >/dev/null
printf 'HTTPS is enabled for https://%s\n' "$DOMAIN"
printf 'Verify renewal with: docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint certbot certbot renew --dry-run\n'
