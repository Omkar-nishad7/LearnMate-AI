#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-}"
ENV_FILE="${2:-.env}"
if [[ "$MODE" != production && "$MODE" != staging ]]; then
  echo 'usage: validate_deploy_env.sh production|staging [env-file]' >&2
  exit 2
fi
[[ -f "$ENV_FILE" && -r "$ENV_FILE" ]] || { echo "[deploy-env] env file is not readable: $ENV_FILE" >&2; exit 2; }

errors=0
ENV_VALUE=''
fail() { printf '[deploy-env] ERROR: %s\n' "$1" >&2; errors=$((errors + 1)); }

# Read a simple KEY=value dotenv assignment without sourcing/executing the file.
# Values are returned through ENV_VALUE so error accounting stays in this shell.
env_value() {
  local key="$1" count line value
  count="$(grep -Ec "^[[:space:]]*${key}=" "$ENV_FILE" || true)"
  [[ "$count" == 1 ]] || return 1
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE")"
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" == \\"*\\" && ${#value} -ge 2 ]]; then value="${value:1:${#value}-2}"; fi
  if [[ "$value" == \'*\' && ${#value} -ge 2 ]]; then value="${value:1:${#value}-2}"; fi
  ENV_VALUE="$value"
}

require_key() {
  local key="$1"
  if ! env_value "$key"; then
    fail "missing or duplicate required setting: $key"
    ENV_VALUE=''
  elif [[ -z "$ENV_VALUE" ]]; then
    fail "required setting is empty: $key"
  fi
}

required=(ENVIRONMENT DEBUG SERVER_NAME FRONTEND_URL CERTBOT_EMAIL SECRET_KEY JWT_SECRET_KEY \
  MYSQL_DATABASE MYSQL_USER MYSQL_ROOT_PASSWORD MYSQL_PASSWORD GEMINI_API_KEY \
  GEMINI_MODEL STORAGE_PROVIDER SMTP_HOST SMTP_PORT SMTP_FROM CORS_ORIGINS)
if [[ "$MODE" == production ]]; then
  required+=(BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY BACKUP_S3_REGION)
fi
for key in "${required[@]}"; do require_key "$key"; done

if grep -Eq '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=.*(CHANGE_ME|replace_with_)' "$ENV_FILE"; then
  fail 'environment file still contains CHANGE_ME/replace_with placeholders'
fi

for key in ENVIRONMENT DEBUG SERVER_NAME FRONTEND_URL CERTBOT_EMAIL SECRET_KEY JWT_SECRET_KEY MYSQL_DATABASE MYSQL_USER MYSQL_ROOT_PASSWORD MYSQL_PASSWORD GEMINI_API_KEY GEMINI_MODEL STORAGE_PROVIDER SMTP_HOST SMTP_PORT SMTP_FROM CORS_ORIGINS; do
  if env_value "$key"; then printf -v "$key" '%s' "$ENV_VALUE"; else printf -v "$key" '%s' ''; fi
done

[[ "$ENVIRONMENT" == production && "$DEBUG" == false ]] || fail 'the protected deployment stack requires ENVIRONMENT=production and DEBUG=false'
[[ "$SERVER_NAME" =~ ^[A-Za-z0-9.-]+$ && "$SERVER_NAME" == *.* && "$SERVER_NAME" != *..* && "$SERVER_NAME" != localhost ]] || fail 'SERVER_NAME must be a real DNS hostname'
[[ "$FRONTEND_URL" == "https://${SERVER_NAME}" ]] || fail 'FRONTEND_URL must equal https://SERVER_NAME'
[[ "$CERTBOT_EMAIL" == *@* && "$CERTBOT_EMAIL" != *CHANGE_ME* ]] || fail 'CERTBOT_EMAIL must be a real monitored email address'
[[ "$CORS_ORIGINS" == *"https://${SERVER_NAME}"* ]] || fail 'CORS_ORIGINS must include the HTTPS origin'
[[ "$SECRET_KEY" != "$JWT_SECRET_KEY" ]] || fail 'SECRET_KEY and JWT_SECRET_KEY must be different'
[[ ${#SECRET_KEY} -ge 32 && ${#JWT_SECRET_KEY} -ge 32 ]] || fail 'SECRET_KEY and JWT_SECRET_KEY must each be at least 32 characters'
[[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]+$ && "$MYSQL_USER" =~ ^[A-Za-z0-9_]+$ ]] || fail 'MYSQL_DATABASE and MYSQL_USER must contain only letters, digits, and underscores'
[[ "$MYSQL_ROOT_PASSWORD" != "$MYSQL_PASSWORD" ]] || fail 'MYSQL_ROOT_PASSWORD and MYSQL_PASSWORD must be different'
[[ "$MYSQL_ROOT_PASSWORD" =~ ^[A-Za-z0-9]{24,}$ && "$MYSQL_PASSWORD" =~ ^[A-Za-z0-9]{24,}$ ]] || fail 'MySQL passwords must each be at least 24 alphanumeric characters (use openssl rand -hex 24); this avoids breaking the Compose-generated database URLs'
[[ "$GEMINI_API_KEY" != CHANGE_ME* && "$GEMINI_MODEL" != CHANGE_ME* ]] || fail 'configure a real Gemini API key and a provider-supported model'
[[ "$SMTP_PORT" =~ ^[0-9]+$ ]] && (( SMTP_PORT >= 1 && SMTP_PORT <= 65535 )) || fail 'SMTP_PORT must be a valid TCP port'
[[ "$SMTP_HOST" != localhost && "$SMTP_HOST" != CHANGE_ME* ]] || fail 'SMTP_HOST must identify the configured mail provider'
[[ "$SMTP_FROM" == *@* && "$SMTP_FROM" != *CHANGE_ME* ]] || fail 'SMTP_FROM must be a configured sender address'

SMTP_USERNAME=''
SMTP_PASSWORD=''
env_value SMTP_USERNAME && SMTP_USERNAME="$ENV_VALUE"
env_value SMTP_PASSWORD && SMTP_PASSWORD="$ENV_VALUE"
if [[ -n "$SMTP_USERNAME" && -z "$SMTP_PASSWORD" ]] || [[ -z "$SMTP_USERNAME" && -n "$SMTP_PASSWORD" ]]; then
  fail 'SMTP_USERNAME and SMTP_PASSWORD must either both be set or both be empty'
fi

case "$STORAGE_PROVIDER" in
  s3)
    for key in STORAGE_BUCKET STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_REGION; do
      require_key "$key"
      if env_value "$key" && [[ "$ENV_VALUE" == CHANGE_ME* ]]; then fail "$key still contains a placeholder"; fi
    done
    ;;
  local)
    if [[ "$MODE" == production ]]; then
      fail 'production requires private durable S3-compatible object storage; local storage is allowed only in staging'
    fi
    ;;
  *) fail 'STORAGE_PROVIDER must be s3 (production/staging) or local (staging only)' ;;
esac

if [[ "$MODE" == production ]]; then
  for key in BACKUP_S3_BUCKET BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY BACKUP_S3_REGION; do
    if env_value "$key" && [[ "$ENV_VALUE" == CHANGE_ME* ]]; then fail "$key still contains a placeholder"; fi
  done
  MEDIA_BUCKET=''; BACKUP_BUCKET=''; MEDIA_ACCESS=''; BACKUP_ACCESS=''; MEDIA_SECRET=''; BACKUP_SECRET=''
  if env_value STORAGE_BUCKET; then MEDIA_BUCKET="$ENV_VALUE"; fi
  if env_value BACKUP_S3_BUCKET; then BACKUP_BUCKET="$ENV_VALUE"; fi
  if env_value STORAGE_ACCESS_KEY; then MEDIA_ACCESS="$ENV_VALUE"; fi
  if env_value BACKUP_S3_ACCESS_KEY; then BACKUP_ACCESS="$ENV_VALUE"; fi
  if env_value STORAGE_SECRET_KEY; then MEDIA_SECRET="$ENV_VALUE"; fi
  if env_value BACKUP_S3_SECRET_KEY; then BACKUP_SECRET="$ENV_VALUE"; fi
  [[ -n "$MEDIA_BUCKET" && -n "$BACKUP_BUCKET" && "$MEDIA_BUCKET" != "$BACKUP_BUCKET" ]] || fail 'media and off-site backup storage must use different bucket names'
  [[ -n "$MEDIA_ACCESS" && -n "$BACKUP_ACCESS" && "$MEDIA_ACCESS" != "$BACKUP_ACCESS" ]] || fail 'media and backup storage must use separate access keys'
  [[ -n "$MEDIA_SECRET" && -n "$BACKUP_SECRET" && "$MEDIA_SECRET" != "$BACKUP_SECRET" ]] || fail 'media and backup storage must use separate secret keys'
fi

if (( errors > 0 )); then
  printf '[deploy-env] FAILED: %d configuration issue(s); values were not printed.\n' "$errors" >&2
  exit 1
fi
printf '[deploy-env] PASS: required %s environment settings are present and internally consistent.\n' "$MODE"
