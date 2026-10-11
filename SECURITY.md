# Security Policy

## Supported reporting

Please do not disclose vulnerabilities in a public issue. Contact the repository maintainer privately through the contact method listed on the GitHub profile, and include steps to reproduce, impact, and affected versions. Do not include real user data or live credentials in the report.

## Deployment security checklist

- Keep `.env` and all provider credentials outside version control.
- Rotate any key/password that was ever committed or shared in logs.
- Use unique high-entropy application/JWT/database secrets.
- Keep MySQL, Redis, and the API container on the private Docker network; expose only the reverse proxy.
- Use HTTPS, secure cookies/token handling, least-privilege service accounts, and current base images.
- Configure rate limits and quotas for public AI endpoints.
- Back up the database and uploaded files to a separate durable location; periodically test restoration.
- Apply OS, Docker, dependency, and database security updates.
- Do not use real student information in local or CI environments.

## Secrets in Git history

Deleting a secret from the latest file is not enough. Revoke/rotate it immediately. If the repository has already been pushed, assess whether Git history must be rewritten before making it public.
