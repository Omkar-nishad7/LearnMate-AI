# LearnMate AI — Production Deployment Runbook

This runbook is a configuration template, not proof of a successful deployment. Replace the example values and test each stage on your own server before opening the application to users.

## GitHub upload, staging, and production release flow

The repository includes three separate gates: a release preflight for safe source publication, CI tests/builds, and environment-protected deployments. These checks do not create a GitHub account/repository, provision a VPS, issue your domain certificate, or supply third-party credentials.

### Upload the full project to the replacement repository

1. Extract the complete project folder `LearnMate-AI` from the source ZIP. Work inside that folder; do not upload the ZIP itself as the only repository file.
2. Confirm `.env`, API keys, SSH keys, `certbot/conf` private material, user uploads, backup dumps, `node_modules`, `.next`, and `__MACOSX` are not staged. The `.gitignore` excludes these paths, but it cannot remove a secret that was already committed in an earlier commit. Rotate any secret previously exposed in source archives or Git history.
3. Initialize Git if the folder is not already a repository, set the initial branch to `main`, then stage the project and run the preflight script:

   ```bash
   git init
   git branch -M main
   git add -A
   bash scripts/release_preflight.sh
   git status --short
   ```

   If this folder is already a Git repository, do not run `git init` again. Inspect `git remote -v` and `git status` first. If the script fails, fix each reported path or ignore rule before committing.
4. Create an empty repository on GitHub, then commit and push the full project (replace the owner and repository with yours):

   ```bash
   git commit -m "Prepare LearnMate AI for release"
   git remote add origin git@github.com:OWNER/NEW_REPOSITORY.git
   git push -u origin main
   ```

   If `origin` already exists, inspect `git remote -v` before changing it. Keep the repo private while you confirm you have publishing rights to the source and assets. Never put credentials into the Git remote URL.
5. Require the `tests` workflow to pass on `main` and `develop` before merging/releasing. It checks backend tests/lint, Docker image builds including the frontend, production Compose syntax, and the configured Playwright tests. A skipped or failed required check is not release approval.

### Deploy to staging first

Use a separate staging VPS (recommended because this Compose stack uses fixed container names) and a staging-only domain, database, storage bucket, AI/email credentials, and test accounts. Never copy production user data or production secrets into staging.

1. Create/push a `develop` branch (for a new repository: `git switch -c develop` followed by `git push -u origin develop`). The `tests` workflow must pass on that branch.
2. Create a GitHub **staging** environment and add these environment secrets: `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_PRIVATE_KEY`, and `STAGING_SSH_KNOWN_HOSTS`. The server's deployment user also needs read-only Git access to the replacement repository if it is private.
3. Create the repository variable `ENABLE_STAGING_DEPLOY=true` only after that separate VPS is ready. The `deploy-staging` workflow then deploys the exact commit tested by CI from `develop`; you can also manually run it on the `develop` branch.
4. On the staging server, clone the new repo to `/opt/learnmate-staging`, configure a private staging `.env` from `.env.production.example`, set the staging domain and independent credentials, open ports 80/443, and run `bash scripts/enable_https.sh`. Use staging-only email/AI/storage configuration and test certificate renewal. Do not enable the workflow until `https://STAGING_DOMAIN/health` succeeds.
5. Test registration/email verification, login and role permissions, teacher course creation/publishing, student course access, video import, assignments/quizzes, AI calls, uploads/downloads, worker jobs, and a backup/restore drill using disposable staging data. Review logs and browser errors.

The staging workflow fails closed if the server's `origin` does not match the repository that triggered the workflow, if environment placeholders remain, if HTTPS is not bootstrapped, if the required backup or migration step fails, or if any required service/public health check is not healthy. The workflow's staging gate is opt-in so a new repository will not try to contact an unconfigured server.

### Enable public production only after staging passes

1. Prepare the production VPS at `/opt/learnmate` independently of staging. Configure a separate production `.env`, domain/DNS, TLS certificate, SMTP, Gemini, YouTube (if used), private durable storage, off-site backups, firewall, and monitoring. The server checkout's `origin` must match this replacement GitHub repository.
2. Create a GitHub **production** environment with required reviewers/branch restrictions, and configure `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, and `SSH_KNOWN_HOSTS` as environment secrets. Verify the SSH host key through a trusted provider/source.
3. Do **not** set `ENABLE_PRODUCTION_DEPLOY` until the staging smoke tests and restore drill pass. When deliberately launching, create the repository variable `ENABLE_PRODUCTION_DEPLOY=true`. The production workflow only deploys a tested `main` commit and still requires approval from the protected environment. An unset variable causes the production job to be skipped.
4. Production checks refuse placeholder values, repeated secret values, a stale Git remote, missing HTTPS certificate/configuration, failed pre-migration backup, failed migration, unhealthy services, or failed public HTTPS checks. The Compose production override uses built images and a persistent host `./storage` bind mount for local upload/export data; verify the merged Compose configuration before the first launch and preserve any existing upload files.
5. If a post-migration health check fails, keep the site out of service if needed and inspect logs. The provided rollback script restores application code only; it does not undo database migrations. Restore DB data only through a reviewed procedure and a verified backup. Do not blindly downgrade a production database.

### Renewal scheduling

After HTTPS has been issued on each VPS, install and enable the included systemd certificate-renewal timer, adjusting the service's `WorkingDirectory` and `ExecStart` for the staging checkout (`/opt/learnmate-staging`) versus the production checkout (`/opt/learnmate`). Verify `systemctl list-timers`, run a Certbot dry-run, inspect renewal logs, and confirm Nginx reloads successfully. A renewal script without an enabled scheduler does not provide automatic renewal.

## 1. Requirements and DNS

- Ubuntu 22.04/24.04 VPS with a supported Docker Engine and Docker Compose v2 plugin.
- A domain you control, for example `learnmate.example.com`.
- DNS `A` record for the domain pointing to the VPS public IPv4 address (and an `AAAA` record only if IPv6 is configured and reachable).
- Firewall/security-group inbound access limited to TCP 22 (preferably restricted to your IP), 80 and 443. Do not open 3306, 6379 or 8000.
- Provider accounts/credentials for Gemini, SMTP, and private object storage if those integrations are enabled.

Verify DNS before requesting a certificate:

```bash
dig +short A YOUR_DOMAIN
dig +short AAAA YOUR_DOMAIN
```

## 2. Install Docker and prepare the server

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
# Install Docker Engine and the Compose plugin using Docker's official instructions for your Ubuntu release.
docker --version
docker compose version
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Use a non-root deployment account with least privilege. Keep the OS and Docker patched.

## 3. Connect a newly created GitHub repository

If the previous GitHub repository was deleted, deploy from the replacement repository only after confirming the server checkout's `origin` points to the new repository. The deploy workflow compares the owner/repository slug from GitHub Actions with the server's Git remote and fails closed on a mismatch.

For a fresh server, clone the new repository (use its actual owner/name and clone URL):

```bash
sudo install -d -o "$USER" -g "$USER" /opt/learnmate
git clone git@github.com:OWNER/NEW_REPOSITORY.git /opt/learnmate
cd /opt/learnmate
git remote -v
```

If the directory already contains an old checkout, do **not** blindly delete or reclone it: first back up the private `.env`, `certbot/conf`, and any bind-mounted uploads/local storage; Docker named database/backup volumes are separate but should also be protected. Then deliberately set `origin` to the replacement repository and verify it:

```bash
cd /opt/learnmate
git remote set-url origin git@github.com:OWNER/NEW_REPOSITORY.git
git remote -v
git fetch origin main
git cat-file -e 'origin/main^{commit}'
```

For a private GitHub repository, install a read-only deploy key on the VPS and add its public key as a deploy key on the replacement repository. Do not put a personal access token or password in the remote URL. The SSH key used by GitHub Actions to enter the VPS is separate from the key the VPS uses to fetch a private GitHub repository. Keep `/opt/learnmate/.env` outside Git and preserve the existing certificate/data directories before switching remotes.

## 4. Configure secrets and environment

Place the project in `/opt/learnmate` (or your chosen deployment directory), then:

```bash
cd /opt/learnmate
cp .env.production.example .env
chmod 600 .env
openssl rand -hex 32  # generate SECRET_KEY
openssl rand -hex 32  # run again for a different JWT_SECRET_KEY
openssl rand -hex 24  # generate MYSQL_ROOT_PASSWORD
openssl rand -hex 24  # run again for a different MYSQL_PASSWORD
```

Edit `.env` and replace every `CHANGE_ME` value. Do not paste secrets into source control, issue trackers, logs, or chat. Generate `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD` using `openssl rand -hex 24` so they are long and URL-safe; use two different values. Compose generates backend database URLs from these values, so do not use special characters in either database password. Keep the `MYSQL_USER`, database name, and password values consistent with the database service. Use a supported Gemini model name confirmed in your Google AI account/documentation.

Set `FRONTEND_URL`, `SERVER_NAME`, `CORS_ORIGINS`, and `SMTP_FROM` to the exact domain you own. Keep `REDIS_URL` and database hosts as Compose service names (`redis`, `mysql`), not `localhost`.

## 5. Configure email, AI, and storage

- **Gemini:** create an API key in your provider account, set `GEMINI_API_KEY`, choose a currently supported `GEMINI_MODEL`, and test a real AI tutor request. Monitor quotas and costs.
- **YouTube:** set `YOUTUBE_API_KEY` only if the project's enabled YouTube functionality needs it; verify API restrictions and quota.
- **SMTP:** use a real provider and its host/port/username/password. Verify sender/domain and test registration verification and password-reset emails. Port 587 is commonly used for STARTTLS, but confirm the provider's settings and the app's SMTP implementation.
- **Object storage:** production validation requires a private S3-compatible media bucket and a separate off-site backup bucket with least-privilege credentials. Set bucket names, region, and endpoint where required. Test upload, read, delete, backup upload verification, and a restore drill before public launch.
- **Sentry:** optionally configure `SENTRY_DSN`; confirm no tokens, passwords, or sensitive user content are sent in events.

Do not use real credentials in `.env.production.example`; keep only placeholders in the repository.

## 6. Validate Compose before starting

Review the merged configuration without printing secrets into a public log:

```bash
bash scripts/validate_deploy_env.sh production
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

Inspect the resolved service definitions locally and confirm `mysql`, `redis`, and `backend` have no host `ports` mappings. Only `nginx` should publish `80:80` and `443:443`. This configuration requires Docker Compose v2.24.4 or newer for the `!reset` and `!override` merge tags. If they are unsupported, upgrade Compose; do not deploy until the merged configuration has the intended network exposure and only Nginx publishes public ports.

The production override explicitly replaces development source-code bind mounts with built-image execution while preserving the host `./storage` path for the backend and worker. Check the merged output before deployment. When changing from an older deployment, inspect `/opt/learnmate/storage` and any previous upload mount before the first update; never delete or overwrite existing uploads as part of deployment.

## 7. Start the HTTP bootstrap configuration

The checked-in `nginx/conf.d/learnmate.conf` is an HTTP reverse-proxy configuration suitable for the initial certificate challenge. Confirm `SERVER_NAME` and the ACME webroot mount in Compose, then run:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build mysql redis backend worker frontend nginx

docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend nginx
curl -fsS http://YOUR_DOMAIN/health
```

Do not continue if health checks fail. Apply database migrations using the repository's verified migration command and inspect the migration logs before directing users to the app. Back up the database before production migrations.

## 8. Issue HTTPS certificate

Make sure DNS points to this server and inbound port 80 is reachable from the public internet. The HTTP server must serve `/.well-known/acme-challenge/` from `/var/www/certbot`.

```bash
mkdir -p certbot/conf certbot/www
# Replace email/domain values with real values you control.
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  --email ADMIN_EMAIL_FOR_CERT_NOTICES \
  --agree-tos --no-eff-email \
  -d YOUR_DOMAIN
```

If the Compose service/entrypoint differs in your checked-out version, run the equivalent `certbot/certbot` container with `./certbot/conf:/etc/letsencrypt` and `./certbot/www:/var/www/certbot` mounted. Confirm certificate files exist under `certbot/conf/live/YOUR_DOMAIN/` before enabling TLS.

Then configure the Nginx TLS server using `nginx/conf.d/learnmate.https.conf.example` as a reference: copy it to a `.conf` filename, replace `YOUR_DOMAIN`, validate Nginx, and reload. Disable or replace the default HTTP-only server block carefully so there are no conflicting `default_server` declarations. Keep port 80 open for ACME renewal and redirect ordinary HTTP requests to HTTPS. Do not enable the TLS config before its certificate and key files exist, or Nginx may fail to start.

```bash
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
curl -I https://YOUR_DOMAIN/
```

Verify renewal with a staging/dry-run test supported by your Certbot setup, and schedule/monitor renewal. Test from outside the VPS, not only from localhost.

## 9. Verify security and application workflows

- From another machine, confirm ports 3306, 6379 and 8000 are not reachable on the public IP.
- Confirm HTTPS certificate hostname and validity; HTTP redirects to HTTPS after TLS is enabled.
- Test registration, verification email, login/logout, password reset, student and teacher access controls, course/video/assignment/quiz flows, uploads, and AI requests.
- Verify rate limiting, CORS, file-size limits, error logging, and that secrets are not present in frontend bundles or API responses.
- Run GitHub Actions CI and review all checks; a green deployment command is not a substitute for application tests.

## 10. Backups and rollback

Create automated, encrypted off-server database and object-storage backups with a defined retention period. Perform a restore drill before launch. A named Docker volume alone is not a backup. Before upgrading, record the deployed Git commit and take a database backup. Roll back application code if necessary, but do not blindly downgrade database migrations without a tested recovery plan.

## 11. GitHub Actions deployment secrets

Production deploy is opt-in and requires the repository variable `ENABLE_PRODUCTION_DEPLOY=true`. Use a protected GitHub `production` environment with required reviewers and the secrets `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, and `SSH_KNOWN_HOSTS`. Staging uses the separate `staging` environment and secrets `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_PRIVATE_KEY`, and `STAGING_SSH_KNOWN_HOSTS`, plus repository variable `ENABLE_STAGING_DEPLOY=true`. Restrict allowed branches and SSH privileges, verify host fingerprints through a trusted source, and test staging before enabling production. Pin third-party Actions to reviewed commit SHAs as part of your supply-chain policy.

## 11. Release checklist

- [ ] DNS and firewall verified
- [ ] `.env` populated, mode `600`, not committed
- [ ] Compose merge validated; DB/Redis/backend not publicly exposed
- [ ] Migrations, health checks, and logs reviewed
- [ ] Gemini and YouTube integrations tested as used
- [ ] SMTP verification and reset emails tested
- [ ] Private upload and backup storage tested; restore drill completed
- [ ] HTTPS and certificate renewal tested
- [ ] CI green and student/teacher smoke tests completed
- [ ] Monitoring, backups, rollback owner, and incident contact documented

## 12. Automated deployment hardening added in this release

The production workflow now refuses to deploy until HTTPS has been bootstrapped and a certificate exists for `SERVER_NAME`. This is deliberate: do not enable the GitHub production environment until the first manual HTTPS setup succeeds.

### First deployment / HTTPS bootstrap

1. Configure DNS A/AAAA records to point to the VPS and allow inbound TCP ports 80 and 443 in the provider firewall and host firewall.
2. Copy `.env.production.example` to `.env`; replace all `CHANGE_ME` values, set `SERVER_NAME` and `CERTBOT_EMAIL`, and use independent random secrets. Generate database passwords with `openssl rand -hex 24` (two different values) because Compose places them into database URL values. Keep the file private (`chmod 600 .env`). Do not commit `.env`.
3. Validate the production Compose merge and start the initial HTTP stack:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build mysql redis backend worker frontend nginx backup
   ```

4. From the repository root on the VPS, run `bash scripts/enable_https.sh`. It obtains the certificate, renders `nginx/conf.d/learnmate.https.conf`, tests Nginx, reloads it, and checks the HTTPS homepage. If it fails, inspect logs and fix the cause before enabling CI deployment.
5. Test renewal and Nginx reload with `bash scripts/renew_certificates.sh` after initial setup. Schedule it on the host (for example, twice daily using root's crontab) so renewal also reloads Nginx:

   ```cron
   17 3,15 * * * cd /opt/learnmate && /bin/bash scripts/renew_certificates.sh >> /var/log/learnmate-cert-renew.log 2>&1
   ```

   Do not run the cron example until `/opt/learnmate` is the real repository path and HTTPS has been successfully enabled.

### Database backups and restore expectations

The `backup` service now runs a compressed MySQL-compatible dump immediately and then approximately every 24 hours. Backups are stored in the named `backups` Docker volume and local files are pruned using `BACKUP_RETENTION_DAYS`. The deployment workflow also makes a one-off backup before migrations; deployment stops if that dump fails. Check logs with:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backup
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps backup /usr/local/bin/backup_db.sh
```

A local Docker volume is not disaster recovery. Configure `BACKUP_S3_BUCKET` and dedicated least-privilege `BACKUP_S3_*` credentials for off-server copies, then verify that the objects appear in the private bucket. Keep the bucket private and enable its own lifecycle/versioning policy. Perform a restore drill on a separate test database before public launch. Never test restore against production data.

### CI deployment prerequisites

The test workflow builds backend, worker, frontend, and backup images. The staging and production deployment workflows are opt-in and require their matching GitHub environments, SSH secrets, DNS/TLS bootstrap, and server-side repo access. Public production additionally requires `ENABLE_PRODUCTION_DEPLOY=true` as a repository variable and a protected `production` environment with required reviewers. The production workflow requires these secrets:

- `SSH_HOST`: VPS hostname/IP.
- `SSH_USER`: deployment user with only the permissions needed for `/opt/learnmate` and Docker.
- `SSH_PRIVATE_KEY`: deployment private key.
- `SSH_KNOWN_HOSTS`: pre-verified SSH host-key line for the VPS. Obtain/verify the fingerprint through your VPS provider or another trusted channel; do not blindly trust a fresh `ssh-keyscan` result.

Before enabling the workflow, clone the replacement repository at `/opt/learnmate` and verify `git remote get-url origin` matches the owner/repository that contains this workflow. Configure and validate `.env`, ensure the VPS can fetch the private repository if applicable, install a compatible Docker Compose plugin, run `scripts/enable_https.sh`, and verify `https://YOUR_DOMAIN/health`. The workflow rejects a stale or mismatched Git remote. The workflow checks HTTPS and saves the previous Git revision. If deployment fails, inspect container and migration logs before using `scripts/rollback_release.sh`.

**Database rollback warning:** the rollback script reverts application code only. It does not reverse Alembic migrations or restore a database backup. If a migration has changed the schema, restore only through a reviewed recovery procedure using the pre-deployment backup; automatic database downgrades are intentionally not attempted.

### Operational validation still required

This patch cannot verify your real VPS, DNS, firewall, secrets, mail provider, AI API key/model, object-storage permissions, GitHub environment, or application workflows. After GitHub Actions passes, test `/health`, HTTPS redirect/certificate, registration and email verification, login, teacher/student permissions, course/video/assignment/quiz flows, file upload, AI calls, backup creation, and a test restore before opening public access.


## 13. Operational hardening follow-up

### Schedule certificate renewal with systemd

After HTTPS has been enabled successfully and the repository is deployed at `/opt/learnmate`, install the included systemd timer:

```bash
sudo install -m 0644 systemd/learnmate-cert-renew.service /etc/systemd/system/learnmate-cert-renew.service
sudo install -m 0644 systemd/learnmate-cert-renew.timer /etc/systemd/system/learnmate-cert-renew.timer
sudo systemctl daemon-reload
sudo systemctl enable --now learnmate-cert-renew.timer
systemctl list-timers learnmate-cert-renew.timer
sudo systemctl start learnmate-cert-renew.service
sudo journalctl -u learnmate-cert-renew.service --no-pager -n 100
```

The timer assumes the checkout is `/opt/learnmate`. If your actual checkout differs, edit the unit's `WorkingDirectory` and `ExecStart` before installing it. Test a Certbot dry run separately before relying on unattended renewal. Deploy automation starts and health-checks MySQL and Redis before taking the required pre-migration backup, so it can also initialize a clean host.

### Restore a database backup (destructive)

**Restore replaces the target database. Never use production as a restore test.** The normal backup service deliberately does not receive `MYSQL_ROOT_PASSWORD`; grant root access only to this one-off restore container. First verify the input backup and test in an isolated database/server whenever possible. The restore script validates the gzip file, requires typing the exact `DATABASE@HOST`, creates a verified pre-restore dump when the target DB exists, and attempts to recover that snapshot if the import fails. That protection is not a substitute for an off-server backup.

```bash
read -rsp 'MySQL root password: ' MYSQL_ROOT_PASSWORD; echo
export MYSQL_ROOT_PASSWORD
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps \
  -e MYSQL_ROOT_PASSWORD backup /usr/local/bin/restore_db.sh /backups/learnmate-YYYYMMDDTHHMMSSZ.sql.gz
restore_status=$?
unset MYSQL_ROOT_PASSWORD
if [ "$restore_status" -ne 0 ]; then exit "$restore_status"; fi
```

Use the actual backup filename. The command passes the password only to this one-shot container; do not add it to the long-running backup service or `.env` command history. The script uses `MYSQL_PWD` internally to avoid putting the password in MySQL process arguments. After restore, verify Docker health, application logs, critical record counts, and representative student/teacher workflows before reopening traffic. If recovery reports a critical failure, preserve the safety snapshot and stop writes while you recover manually.

### Health checks and database naming

The Compose file now uses `MYSQL_DATABASE` and `MYSQL_USER` consistently for MySQL initialization and backend/worker connection URLs. If database credentials contain reserved URL characters, percent-encode the password in connection URLs or use a dedicated URL-safe password. The Nginx health check selects HTTP during certificate bootstrap and HTTPS once the matching certificate file exists. Deployment success requires backend, frontend, and Nginx health checks plus public HTTPS checks.

### Off-site backup verification

When `BACKUP_S3_BUCKET` is set, the backup script checks that the uploaded object can be queried with `head-object` before reporting success. Configure bucket encryption, private access, versioning/lifecycle policy, and least-privilege credentials at the provider. This verifies upload visibility, not restore integrity: schedule a restore drill into an isolated database and document the result.

### Release archive hygiene

Create release archives without macOS metadata, for example from the repository root: `zip -r LearnMate-AI-release.zip LearnMate-AI -x '*/__MACOSX/*' '*/.DS_Store' '*/._*'`. Do not include `.env`, certificates/private keys, database dumps, or local storage.
