#!/usr/bin/env bash
set -Eeuo pipefail

# Run after `git init` and `git add -A`, before the first push or release commit.
# This checks paths staged/tracked by Git; it never prints detected secret values.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo '[release-preflight] run this script inside an initialized Git repository' >&2
  exit 2
}
cd "$ROOT"
failures=0

report() {
  printf '[release-preflight] ERROR: %s\n' "$1" >&2
  failures=$((failures + 1))
}

# Verify expected sample env templates remain available for contributors/CI.
for required in .env.example .env.production.example frontend/.env.example; do
  [[ -f "$required" ]] || report "required example file is missing: $required"
  if git check-ignore --no-index -q -- "$required"; then
    report "environment example is unexpectedly ignored: $required"
  fi
done

# Verify important local-only paths are ignored even if they do not exist yet.
for protected in \
  .env frontend/.env frontend/.env.local \
  frontend/node_modules/playwright/index.js \
  backend/__pycache__/release_preflight.pyc \
  storage/release-preflight-upload.dat \
  backups/release-preflight.sql.gz \
  certbot/conf/live/example.invalid/privkey.pem \
  nginx/conf.d/learnmate.https.conf; do
  if ! git check-ignore --no-index -q -- "$protected"; then
    report "path is not covered by .gitignore: $protected"
  fi
done

# Inspect tracked, staged, and non-ignored untracked paths. Local ignored .env files
# remain available to the developer but are not included in this list unless force-added.
while IFS= read -r -d '' path; do
  base="${path##*/}"
  case "$base" in
    .env|.env.*)
      [[ "$base" == *.example ]] || report "secret environment file is staged/tracked: $path"
      ;;
    .DS_Store|._*) report "macOS metadata file is staged/tracked: $path" ;;
    *.pem|*.key|*.p12|*.pfx|*.p7b|*.p7c|*.crt|*.cer|*.cert|*.jks|*.keystore)
      report "private-key/certificate bundle file is staged/tracked: $path"
      ;;
    id_rsa|id_ed25519|id_ecdsa|credentials.json|service-account.json)
      report "credential file is staged/tracked: $path"
      ;;
    *.sql.gz|*.dump|*.sqlite|*.sqlite3)
      report "database dump/local database is staged/tracked: $path"
      ;;
    *.pyc|*.pyo) report "Python bytecode is staged/tracked: $path" ;;
  esac
  case "$path" in
    __MACOSX/*|*/__MACOSX/*) report "macOS archive metadata is staged/tracked: $path" ;;
    node_modules/*|*/node_modules/*|.next/*|*/.next/*) report "generated dependency/build output is staged/tracked: $path" ;;
    .venv/*|*/.venv/*|__pycache__/*|*/__pycache__/*) report "local environment/cache is staged/tracked: $path" ;;
    storage/*|backups/*) [[ "$base" == .gitkeep ]] || report "local user data/backup is staged/tracked: $path" ;;
    certbot/conf/*) [[ "$base" == .gitkeep ]] || report "generated TLS material is staged/tracked: $path" ;;
  esac
done < <(git ls-files --cached --others --exclude-standard -z)

# Detect common private-key and cloud/API token shapes without printing line contents.
if git grep -I -l -E -e \
  '-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}' -- . >/tmp/learnmate-release-secret-paths 2>/dev/null; then
  while IFS= read -r path; do
    report "possible hard-coded credential pattern found in: $path"
  done < /tmp/learnmate-release-secret-paths
fi
rm -f /tmp/learnmate-release-secret-paths

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  if ! git diff --check || ! git diff --cached --check; then
    report 'git diff --check failed; fix whitespace errors before publishing'
  fi
else
  # On the first source-import commit, avoid failing on pre-existing whitespace
  # in baseline files that are not part of this deployment patch.
  if ! git diff --check; then
    report 'working-tree git diff --check failed'
  fi
  printf '[release-preflight] NOTE: first commit detected; existing baseline whitespace is not treated as a blocker. CI must pass before release.\n'
fi

for script in \
  scripts/release_preflight.sh scripts/validate_deploy_env.sh scripts/backup-entrypoint.sh \
  scripts/backup_db.sh scripts/restore_db.sh scripts/enable_https.sh \
  scripts/renew_certificates.sh scripts/rollback_release.sh; do
  if [[ -f "$script" ]] && ! bash -n "$script"; then
    report "shell syntax check failed: $script"
  fi
done

if (( failures > 0 )); then
  printf '[release-preflight] FAILED with %d issue(s). Nothing was uploaded.\n' "$failures" >&2
  exit 1
fi
printf '[release-preflight] PASS: Git ignores, staged-file safety, text hygiene, and deployment shell syntax look good.\n'
printf '[release-preflight] Next: push to GitHub and require all CI jobs to pass. This script does not test Docker, GitHub secrets, DNS, HTTPS, or a live database restore.\n'
