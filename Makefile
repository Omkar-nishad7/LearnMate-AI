.PHONY: help up down logs migrate test test-e2e lint fmt backup restore shell psql redis-cli clean

help:
	@echo "LearnMate AI — common commands"
	@echo "  make up          start dev stack"
	@echo "  make prod-up     start production stack"
	@echo "  make down        stop stack"
	@echo "  make logs        tail all logs"
	@echo "  make migrate     run alembic upgrade head"
	@echo "  make test        run pytest"
	@echo "  make test-e2e    run Playwright"
	@echo "  make lint        run ruff (backend)"
	@echo "  make backup      dump DB to backups volume"
	@echo "  make restore F=  restore from file"
	@echo "  make shell       bash into backend"
	@echo "  make clean       remove containers + volumes"

up:
	docker compose up -d --build

prod-up:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

migrate:
	docker compose exec backend alembic upgrade head

test:
	docker compose exec backend pytest -v

test-e2e:
	cd tests/e2e && npm install --no-audit --no-fund && npx playwright install chromium && BASE_URL=http://localhost npx playwright test

lint:
	docker compose exec backend ruff check app

backup:
	docker compose exec mysql sh -c 'MYSQL_PWD=$$MYSQL_ROOT_PASSWORD mysqldump -u root --single-transaction --routines --triggers learnmate' | gzip -9 > backups/manual-$$(date -u +%Y%m%dT%H%M%SZ).sql.gz
	@echo "backup written to ./backups/"

restore:
	@test -n "$(F)" || (echo "usage: make restore F=backups/file.sql.gz" && exit 1)
	gunzip -c $(F) | docker compose exec -T mysql sh -c 'MYSQL_PWD=$$MYSQL_ROOT_PASSWORD mysql -u root learnmate'

shell:
	docker compose exec backend bash

clean:
	docker compose down -v