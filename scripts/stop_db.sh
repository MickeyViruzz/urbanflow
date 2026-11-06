#!/usr/bin/env bash
# Stop the project-local PostgreSQL cluster started by scripts/start_db.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/.localdb"

if command -v pg_ctl >/dev/null 2>&1; then
  PG_BIN="$(dirname "$(command -v pg_ctl)")"
elif [ -x "/opt/homebrew/opt/postgresql@16/bin/pg_ctl" ]; then
  PG_BIN="/opt/homebrew/opt/postgresql@16/bin"
else
  PG_BIN="/usr/lib/postgresql/16/bin"
fi

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  echo "No local UrbanFlow database cluster found."
  exit 0
fi

"$PG_BIN/pg_ctl" -D "$DATA_DIR" stop -m fast
