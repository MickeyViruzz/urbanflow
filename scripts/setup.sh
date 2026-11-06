#!/usr/bin/env bash
# One-command local setup for UrbanFlow.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== 1/4 · Starting PostgreSQL =="
./scripts/start_db.sh

echo "== 2/4 · Preparing the Python environment =="
cd backend
if [ ! -d .venv ]; then
  if command -v python3.12 >/dev/null 2>&1; then
    python3.12 -m venv .venv
  else
    python3 -m venv .venv
  fi
fi
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "== 3/4 · Creating the schema and demonstration dataset =="
.venv/bin/python -m etl.run_pipeline --init-db --seed-demo
cd "$ROOT"
./scripts/migrate.sh
cd backend

echo "== 4/4 · Installing frontend packages =="
cd ../frontend
npm install --include=dev

cd "$ROOT"
cat <<'EOF'

UrbanFlow is ready.

Start the API (terminal 1):
  cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

Start the web app (terminal 2):
  cd frontend && npm run dev

Open http://localhost:5173

Optional: collect live OpenStreetMap roadworks and Open-Meteo weather:
  cd backend && .venv/bin/python -m etl.run_pipeline --all
EOF
