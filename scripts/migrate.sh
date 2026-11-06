#!/usr/bin/env bash
# Apply all numbered SQL migrations to the local UrbanFlow database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-urbanflow}"
DB_NAME="${DB_NAME:-urbanflow}"
DB_HOST="${DB_HOST:-127.0.0.1}"

if command -v psql >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v psql)")"
elif [ -x "/opt/homebrew/opt/postgresql@16/bin/psql" ]; then
  PG_BIN="/opt/homebrew/opt/postgresql@16/bin"
elif [ -x "/usr/lib/postgresql/16/bin/psql" ]; then
  PG_BIN="/usr/lib/postgresql/16/bin"
else
  echo "PostgreSQL tools not found. Install PostgreSQL 16 first." >&2
  exit 1
fi
export PATH="$PG_BIN:$PATH"

existing_table="$(psql -h "$DB_HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT to_regclass('public.incidents') || ''" 2>/dev/null || true)"
if [ -z "$existing_table" ]; then
  echo "No existing UrbanFlow schema found; nothing to migrate. Run app.init_db first."
  exit 0
fi

shopt -s nullglob
migrations=("$ROOT"/database/migrations/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "No migrations found."
  exit 0
fi

for migration in "${migrations[@]}"; do
  echo "Applying $(basename "$migration")"
  psql -h "$DB_HOST" -p "$PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 -f "$migration"
done

echo "Migrations applied."
