#!/bin/sh
set -eu

echo "Checking database connections before applying migrations..."
python -m app.db.check_connections

echo "Database connections verified. Applying migrations..."
alembic upgrade head

echo "Starting LearnMate AI API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
