# Database

UrbanFlow uses PostgreSQL 16 as its primary store.

## Initialisation

The application creates tables with SQLAlchemy's metadata and registers source definitions:

```bash
cd backend
.venv/bin/python -m app.init_db
```

This command is safe to run repeatedly. It is also invoked automatically by the ETL pipeline
(`--init-db`) and by the FastAPI startup lifespan.

## `schema.sql`

`schema.sql` is a `pg_dump --schema-only` snapshot of the current schema. It is provided for
documentation and for manual database setup, not applied automatically:

```bash
createdb urbanflow
psql -d urbanflow -f database/schema.sql
```

If you use this file, still run the backend with `DEMO_AUTOSEED=true` or seed data through the
pipeline afterwards.

## Tables

| Table | Purpose |
| --- | --- |
| `data_sources` | Attribution and metadata for every collector or sample dataset |
| `incidents` | Normalised traffic, construction and disruption records |
| `weather_observations` | Daily Mumbai observations and short-term forecasts |
| `collection_logs` | Per-attempt ETL audit trail, including failures and rejected counts |
| `analytics_events` | Privacy-conscious first-party website analytics events |

## Migrations

Initialisation uses SQLAlchemy metadata for fresh databases. Incremental changes are kept as
numbered SQL migrations:

```bash
./scripts/migrate.sh
# or: make migrate
```

`001_incident_authenticity.sql` is idempotent. It updates legacy OSM records to
`status = 'unknown'`, changes `location_precision` from `exact` to `segment`, aligns OSM dates with
the OSM last-edit timestamp, and adds category/severity/status/precision check constraints.

After applying schema changes, refresh the documented snapshot:

```bash
pg_dump -h 127.0.0.1 -p 5433 -U urbanflow -d urbanflow --schema-only \
  --no-owner --no-privileges > database/schema.sql
```

## Local development

`scripts/start_db.sh` creates a cluster in `.localdb/` on port **5433** and creates the
`urbanflow` database. The default connection string in `backend/.env.example` matches this setup.
The cluster is separate from any system PostgreSQL service.

The local cluster uses trust authentication for developer convenience. It is not a production
database configuration.
