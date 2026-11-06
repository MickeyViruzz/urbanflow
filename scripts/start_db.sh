#!/usr/bin/env bash
# Start a project-local PostgreSQL 16 cluster on port 5433.
# No system-wide Postgres configuration is modified.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/.localdb"
PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-urbanflow}"
DB_NAME="${DB_NAME:-urbanflow}"

if command -v pg_ctl >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v pg_ctl)")"
elif [ -x "/opt/homebrew/opt/postgresql@16/bin/pg_ctl" ]; then
  PG_BIN="/opt/homebrew/opt/postgresql@16/bin"
elif [ -x "/usr/lib/postgresql/16/bin/pg_ctl" ]; then
  PG_BIN="/usr/lib/postgresql/16/bin"
else
  echo "PostgreSQL tools not found. Install PostgreSQL 16 (brew install postgresql@16 or apt install postgresql-16)." >&2
  exit 1
fi
export PATH="$PG_BIN:$PATH"

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  echo "Initialising local PostgreSQL cluster in $DATA_DIR"
  mkdir -p "$DATA_DIR"
  initdb -D "$DATA_DIR" -U "$DB_USER" --auth=trust --encoding=UTF8 >/dev/null
fi

if pg_ctl -D "$DATA_DIR" status >/dev/null 2>&1; then
  echo "PostgreSQL is already running on port $PORT."
else
  echo "Starting PostgreSQL on port $PORT"
  pg_ctl -D "$DATA_DIR" -o "-p $PORT -k /tmp" -l "$DATA_DIR/server.log" start >/dev/null
fi

for _ in $(seq 1 40); do
  if pg_isready -h 127.0.0.1 -p "$PORT" -U "$DB_USER" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! psql -h 127.0.0.1 -p "$PORT" -U "$DB_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  createdb -h 127.0.0.1 -p "$PORT" -U "$DB_USER" "$DB_NAME"
  echo "Created database '$DB_NAME'."
fi

echo
echo "Database ready:"
echo "  DATABASE_URL=postgresql+psycopg://$DB_USER@localhost:$PORT/$DB_NAME"
echo "Stop it with: scripts/stop_db.sh"
