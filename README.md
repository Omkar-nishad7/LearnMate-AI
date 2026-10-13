# LearnMate AI

LearnMate AI is an AI-assisted learning platform with separate student and teacher experiences, course management, learning activities, and AI-powered study tools.

> **Release status:** This repository contains deployment configuration and automated checks, but it is not a claim that a live production deployment or every end-to-end workflow has been verified. Review `RELEASE-READINESS.md` and `docs/DEPLOY.md` before launching publicly.


## Live website and homepage preview

- **Live website:** <https://learnmate-ai-frontend.vercel.app>

The following screenshot shows the LearnMate AI homepage currently presented by the deployed frontend:

![LearnMate AI homepage preview](docs/images/learnmate-ai-homepage.png)


## Technology stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** FastAPI on Python 3.12
- **Database and migrations:** MySQL 8, SQLAlchemy, Alembic
- **Background jobs/cache:** Celery and Redis
- **AI integration:** Google Gemini API (server-side)
- **Deployment:** Docker Compose, Nginx, Certbot, GitHub Actions
- **Browser tests:** Playwright

## Repository layout

```text
backend/                 FastAPI application, models, services, migrations, tests
frontend/                Next.js student/teacher application
database/                SQL schema and database documentation
docker/                  Backend, frontend, worker, and backup images
nginx/                   Reverse-proxy configuration and HTTPS template
scripts/                 Release checks, backup/restore, HTTPS, and deployment helpers
tests/e2e/               Playwright end-to-end tests
.github/workflows/       CI, staging, and opt-in production workflows
docker-compose.yml       Local development stack
docker-compose.prod.yml  Production Compose overrides
docs/DEPLOY.md           Deployment and operations runbook
```

## Quick start (local development)

Requirements: Docker Desktop or Docker Engine with the Docker Compose plugin.

1. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

2. Change `SECRET_KEY`, `JWT_SECRET_KEY`, `MYSQL_ROOT_PASSWORD`, and `MYSQL_PASSWORD` in `.env`. Keep `.env` local; it must not be committed.

3. Build and start the development stack:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

   The backend entrypoint applies Alembic migrations on startup. Wait for the services' health checks before testing the application.

4. Open the app at <http://localhost/>. The local API health endpoint is <http://localhost:8000/api/v1/health>; API documentation may be available at <http://localhost:8000/docs> in development mode.

Useful commands:

```bash
make logs
make test
make lint
```

## Automated checks

The `tests` GitHub Actions workflow runs backend lint/tests, builds the backend, worker, frontend, and backup images, validates the production Compose configuration, and runs the configured Playwright tests through the local Nginx reverse proxy.

For local browser tests, first start the Docker stack and wait until it is healthy, then run:

```bash
make test-e2e
```

The E2E suite installs Playwright dependencies on demand because `tests/e2e/package-lock.json` is not currently committed. CI must pass on the new repository before staging or production deployment is enabled.

## Before pushing to GitHub

Run the release preflight from this directory after initializing Git and staging the project:

```bash
git init
git branch -M main
git add -A
bash scripts/release_preflight.sh
git diff --cached --check
git status --short
```

If this is already a Git repository, inspect `git status` and `git remote -v` before running `git init` or changing a remote. Upload the contents of the `LearnMate-AI` folder, not the ZIP archive as a single repository file. Start with a private GitHub repository while reviewing ownership and publishing rights for all code and assets.

## Security and production deployment

- Never commit `.env`, API keys, passwords, private keys/certificates, user uploads, database dumps, generated certificate data, or production data.
- Example environment files (`.env.example`, `.env.production.example`, and `frontend/.env.example`) are templates, not production secrets.
- Rotate any credential that may have appeared in an earlier archive or Git history.
- Production deployment is opt-in and requires real environment settings, a configured server and GitHub environment/secrets, DNS, working HTTPS, private durable upload storage, off-site database backups, and a restore drill.
- Do not enable `ENABLE_PRODUCTION_DEPLOY` until staging, CI, and recovery tests have passed.

Follow [`docs/DEPLOY.md`](docs/DEPLOY.md) for the full upload, staging, HTTPS, backup/restore, and production checklist. Read [`SECURITY.md`](SECURITY.md) before reporting a vulnerability and [`CONTRIBUTING.md`](CONTRIBUTING.md) before proposing changes.

## License

See [`LICENSE`](LICENSE). Confirm you have the right to publish every included asset and dependency-related file before making the repository public.
