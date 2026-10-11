#!/bin/sh
set -eu

echo "Waiting for database and applying migrations..."
alembic upgrade head

echo "Starting LearnMate AI API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
