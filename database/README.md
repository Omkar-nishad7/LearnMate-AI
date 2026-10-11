# Database

- **Engine:** MySQL 8
- **Migrations:** Alembic (`backend/migrations/`)
- **Schema:** managed via `alembic upgrade head`

`schema.sql` is a reference stub. The authoritative schema lives in Alembic.

For dev seed data, run `seed.sql` **only** in development after migrations.