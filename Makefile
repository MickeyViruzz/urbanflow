.PHONY: setup db-start db-stop api web seed collect test build

setup:
	./scripts/setup.sh

db-start:
	./scripts/start_db.sh

db-stop:
	./scripts/stop_db.sh

migrate:
	./scripts/migrate.sh

api:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

seed:
	cd backend && .venv/bin/python -m etl.run_pipeline --seed-demo

collect:
	cd backend && .venv/bin/python -m etl.run_pipeline --all

test:
	cd backend && .venv/bin/pytest

build:
	cd frontend && npm run build
