# Release-readiness notes

This package has been prepared for source control and a documented Docker-based deployment. It is not a claim that a live production environment has been deployed or that every feature has passed an end-to-end test.

## Prepared in this package

- Replaced contradictory milestone text with a single project README and local setup guide.
- Replaced the malformed `LICENSE` file with a standard MIT license (review the ownership/permission note in README before publishing).
- Added contribution and security guidance, architecture documentation, and GitHub issue/PR templates.
- Expanded Git ignore rules for local secrets (while keeping example env files tracked), dependencies, build output, caches, local uploads/backups, generated certificate data, and test reports.
- Restricted optional host bindings for MySQL, Redis, and the API to loopback instead of all network interfaces.
- Added a documented HTTPS bootstrap template and deployment steps; certificate issuance still requires your domain and server.
- CI checks backend lint/tests, builds backend/worker/frontend/backup images, validates production Compose config, and waits for the database/backend health checks before browser-based E2E tests. Deploy workflow verifies the VPS Git remote matches the active GitHub repository and requires healthy containers plus public HTTPS checks.
- Added ignore rules for dependency/build output and macOS metadata; generate the final full-project release archive with the documented metadata exclusions.

## Validation limits in the preparation environment

- Python source compilation passed.
- Backend pytest and Playwright E2E have not been run in this patch-preparation environment; GitHub Actions must pass on the replacement repository before launch.
- Docker/Compose is not installed in this preparation environment, so container builds, Compose merge, and live health behavior were not executed here.
- The Next.js production build has not been executed in this environment; CI builds the production image to verify it.
- No real domain, Gemini/YouTube credentials, SMTP provider, object-storage bucket, or VPS was supplied, so live deployment and external integrations have not been tested.

## Deployment safeguards in the latest targeted patch

- `.gitignore` now excludes local environment secrets, Node/Python build output, local storage/backups, generated TLS files and test reports while explicitly allowing `.env.example` and `.env.*.example` templates.
- Database restore now validates its compressed input, requires an explicit `DATABASE@HOST` confirmation, creates a verified pre-restore snapshot when a target database exists, and attempts to recover that snapshot if import fails. The normal backup service does not receive root credentials; pass the password only to the one-off restore command.
- The deployment workflow checks that `/opt/learnmate` points to the same GitHub owner/repository that triggered the workflow. For the deleted-repository replacement, the server checkout must be cloned/configured for the new URL, with separate read-only repository access if it is private.
- The E2E CI job waits for MySQL/backend health and checks `/login` and `/register` before running Playwright. The separate image-build job builds the Next.js production image.

## Required before public release / production use

1. Review the MIT license and confirm you have rights to publish all code and assets.
2. Rotate any credential that was ever present in an earlier project archive or Git history.
3. Run the CI workflow on GitHub and resolve failures before merging.
4. On your server, configure a private `.env`, domain, HTTPS certificate, email provider, AI keys, durable storage, backups, and firewall.
5. Test registration/login and representative student/teacher workflows against the actual deployed stack.
6. Keep the automatic deployment workflow disabled until you intentionally configure its protected GitHub environment and SSH secrets.
