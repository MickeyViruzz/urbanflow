# UrbanFlow — Smart Traffic & Road Disruption Intelligence

UrbanFlow is an academic **Data Engineering** project that collects public Mumbai traffic,
construction and weather data, processes it through a Python ETL pipeline, stores it in
PostgreSQL, and presents it through a FastAPI + React application.

The emphasis is on a traceable end-to-end data workflow: every record can be traced back to its
source, every collection attempt is logged, synthetic demonstration data is clearly separated from
live data, and all dashboard values are computed from database records.

## Screenshots

![UrbanFlow overview](docs/screenshots/overview.png)

## What is implemented

- **Overview dashboard** — counts, disruption map, incident timeline, category mix,
  frequently affected locations, recent updates and announcements, weather alerts.
- **Interactive traffic map** — Leaflet + OpenStreetMap markers, category/status/location/date/origin
  filters and a full incident detail panel.
- **Road disruptions** — searchable, filterable and paginated table with full records, source links
  and descriptions.
- **Traffic analytics** — daily frequency, weekly and monthly patterns, category distribution,
  location hotspots, historical status trends and weather/incident comparison with explicit
  insufficient-data states.
- **Route disruption checker** — Mumbai geocoding, OSRM route calculation, 350 m corridor matching,
  reported incidents and OSRM alternatives where available. It never claims live traffic speeds.
- **Data sources & pipeline** — source status, last success, record counts, rejected/duplicate
  counts, run log, and an admin-token-protected manual refresh.
- **Platform analytics** — first-party page views, visits, searches, map interactions, incident
  views, route checks and feature usage, without personal identifiers.
- **About** — problem statement, objectives, architecture, data ethics, limitations and future
  scope.

Live sources currently integrated:

| Source | Method | Status |
| --- | --- | --- |
| Open-Meteo weather | REST API, no key | Working |
| OpenStreetMap roadworks | Overpass API | Working; records use an unconfirmed `unknown` status |
| Mumbai Traffic Police notices | BeautifulSoup + robots.txt check | Implemented; source is often unreachable from automated environments and failures are logged |
| UrbanFlow sample dataset | Deterministic generator, `origin=demo` | Working, clearly labelled |

## Architecture

```text
Public sources ──► Python extractors ──► normalise / classify / validate / dedupe ──► PostgreSQL
                                                                                      │
                                     React + TypeScript ◄── FastAPI REST ◄───────────┘
                                           │
                                           └── first-party analytics events ──► PostgreSQL
```

Detailed Mermaid diagrams are in **[docs/architecture.md](docs/architecture.md)**: system
architecture, ingestion sequence, data model and runtime topology.

### Repository layout

```text
urbanflow/
├── backend/
│   ├── app/                 FastAPI application, models, schemas, routers, services
│   ├── etl/                 readers, normaliser, NLP, loaders, CLI pipeline, sample generator
│   ├── tests/               Pytest suite (API, ETL, NLP, route logic)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/      layout, design system, charts, map, drawers
│   │   ├── pages/           Overview, Map, Disruptions, Analytics, Platform analytics,
│   │   │                    Route checker, Data pipeline, About
│   │   └── lib/             typed API client, types, formatting, analytics
│   └── package.json
├── database/schema.sql      documented pg_dump schema snapshot
├── docs/                    architecture and sample dataset documentation
├── scripts/                 local PostgreSQL + setup scripts
├── docker-compose.yml       optional PostgreSQL container
└── Makefile
```

## Technology stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Leaflet / React-Leaflet.
**Backend:** Python 3.12, FastAPI, Pydantic, SQLAlchemy 2.
**Data engineering:** Requests, BeautifulSoup, pandas, scikit-learn, NLTK.
**Database:** PostgreSQL 16 (SQLAlchemy metadata + `database/schema.sql`).
**External services:** OpenStreetMap Overpass, Open-Meteo, Nominatim, OSRM.

No Kafka, Kubernetes, Redis or cloud infrastructure is required.

## Quick start

### Prerequisites

- Python **3.12** (3.11+ should work, but 3.12 is the tested version)
- Node.js **20+** and npm
- PostgreSQL **16** command-line tools (`pg_ctl`, `initdb`, `psql`, `createdb`)
- Internet access for live sources and external APIs; the sample dataset works offline

### One command

```bash
./scripts/setup.sh
```

This starts a **project-local PostgreSQL cluster** in `.localdb/` on port **5433**, creates the
`urbanflow` database, installs backend and frontend dependencies, creates `.env`, initialises the
schema and seeds the labelled demonstration dataset.

Then run the API and web app in two terminals:

```bash
# terminal 1
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend && npm run dev
```

Open **http://localhost:5173** and the API docs at **http://localhost:8000/docs**.

### Manual setup

```bash
# 1. Database
./scripts/start_db.sh

# 2. Backend
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m etl.run_pipeline --init-db --seed-demo

# 3. Frontend
cd ../frontend
npm install --include=dev
npm run dev
```

### Docker PostgreSQL instead of the local cluster

```bash
docker compose up -d
```

Then set the Docker connection string in `backend/.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://urbanflow:urbanflow@localhost:5433/urbanflow
```

## Configuration

`backend/.env` (copy from `backend/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://urbanflow@localhost:5433/urbanflow` | SQLAlchemy database URL |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins |
| `ADMIN_TOKEN` | `urbanflow-admin` in `.env.example`; empty disables refresh | Protects the manual pipeline refresh endpoint; change outside local demos |
| `DEMO_AUTOSEED` | `true` | Seed the labelled sample dataset when the database is empty |
| `OSRM_BASE_URL` | `https://router.project-osrm.org` | Routing service |
| `NOMINATIM_URL` | `https://nominatim.openstreetmap.org` | Address geocoding fallback |
| `HTTP_USER_AGENT` | academic-project string | Identifies requests to public services |
| `TRAFFIC_POLICE_URL` | official Mumbai Traffic Police URL | Configurable notice source |

The frontend uses relative `/api` calls in development through the Vite proxy. For a production
build, set `VITE_API_BASE_URL` in `frontend/.env` to the API origin.

## Data pipeline

```bash
cd backend

# create tables and source records
.venv/bin/python -m etl.run_pipeline --init-db

# seed 172 labelled demo incidents + sample weather
.venv/bin/python -m etl.run_pipeline --seed-demo

# collect all live sources (weather, OSM roadworks, traffic police attempt)
.venv/bin/python -m etl.run_pipeline --all

# individual collectors
.venv/bin/python -m etl.run_pipeline --weather
.venv/bin/python -m etl.run_pipeline --osm
.venv/bin/python -m etl.run_pipeline --traffic-police

# recompute time-based active/upcoming/resolved statuses (unknown is preserved)
.venv/bin/python -m etl.run_pipeline --refresh-statuses

# print a pandas data-quality report (origin/category split, missing fields, coverage)
.venv/bin/python -m etl.run_pipeline --quality-report
```

Each run writes a `collection_logs` row with status and counts. Re-running collectors does not
duplicate records: incidents are fingerprinted, and weather observations are unique per day/source.
Changed records are updated and counted separately.

### Record status and precision

- `active`, `upcoming` and `resolved` are derived from the start and end dates of time-based
  records and refreshed on API startup.
- `unknown` is used when a source does not confirm an operational status — currently OpenStreetMap
  construction tags. The status refresh never overwrites `unknown` with a time-derived value.
- `location_precision` is `locality` (approximate gazetteer centroid), `segment` (OpenStreetMap
  road-segment centre) or `unknown` (no coordinates). No record claims an exact incident position.
- The dashboard construction KPI reports active records plus OSM-mapped construction separately;
  active-disruption counts do not include unconfirmed OSM records.

### Pipeline stages

1. **Extract** — Requests + BeautifulSoup for HTML notices; JSON APIs for Overpass and Open-Meteo.
2. **Transform** — remove markup, normalise whitespace, parse IST dates, classify category, extract
   locations against a Mumbai gazetteer, generate an extractive summary.
3. **Validate** — required title/description/start time, HTTP URL checks, Mumbai coordinate bounds.
4. **Deduplicate** — stable SHA-256 fingerprints and content hashes; source/external-ID matching.
5. **Load** — write to PostgreSQL with attribution, `origin`, raw payload and timestamps.
6. **Log** — record success, failure reasons, fetched/inserted/updated/duplicates/rejected counts.

### Sources and compliance

- **OpenStreetMap** data is © OpenStreetMap contributors, licensed under ODbL 1.0. Roadworks are
  read through the public Overpass API and linked back to their OSM way. OSM does not confirm an
  active closure or start/end dates, so these records use `status = "unknown"` and
  `location_precision = "segment"` (the road-segment centre, not an incident position).
- **Open-Meteo** provides daily Mumbai weather data under CC BY 4.0; no API key is needed.
- **Mumbai Traffic Police** notices are treated as public government information. The scraper
  fetches `robots.txt` first and refuses to collect when the policy cannot be verified. The site is
  often unreachable from academic/automated environments; this is recorded as a failed run and is
  not replaced with invented records.
- **Nominatim** and **OSRM** are public demo services with usage limits. Calls are cached/rate-limited
  for geocoding; this project is not intended for production traffic.
- No restricted site is bypassed and no data is scraped from sources that prohibit automated access.

## Demonstration data

A synthetic dataset is included for offline evaluation: **172 incidents** and **126 weather
observations**. It is deterministic, generated in-repository, labelled `origin=demo`, and shown with
a demo badge and dashboard notice. Live and demo records remain separate and can be filtered apart.

Reset or regenerate it:

```bash
cd backend
.venv/bin/python -m etl.run_pipeline --seed-demo --force-demo
```

The labelled demo set is refreshed automatically when it is more than 14 days old; live records are
never affected. Read **[docs/sample-dataset.md](docs/sample-dataset.md)** for composition, labels and
limitations.

## API overview

All endpoints are under `/api`. Interactive OpenAPI documentation is available at `/docs`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | API and database health |
| GET | `/api/dashboard?days=30` | Database-driven overview payload |
| GET | `/api/incidents` | Paginated incidents; status is `active`, `upcoming`, `resolved` or `unknown`; supports search/category/location/date/origin filters |
| GET | `/api/incidents/map` | Incidents with coordinates for the map |
| GET | `/api/incidents/{id}` | Full incident plus related records |
| GET | `/api/analytics/traffic?days=90` | Frequency, weekly/monthly, categories, locations, weather, status trends |
| GET | `/api/meta` | Categories, statuses, locations, dataset metadata |
| POST | `/api/route/check` | Geocode → OSRM route → corridor incident matching and alternatives |
| GET | `/api/sources` | Source status, latest runs, record counts |
| GET | `/api/pipeline/logs` | Collection log history |
| POST | `/api/pipeline/run` | Admin-token-protected background collection trigger |
| POST | `/api/analytics/events` | Record a first-party analytics event |
| GET | `/api/analytics/website?days=30` | Platform usage report |

Example route request:

```bash
curl -X POST http://localhost:8000/api/route/check \
  -H "Content-Type: application/json" \
  -d '{"origin": "Bandra West", "destination": "Andheri West"}'
```

The response labels **reported disruptions within the corridor** and any **OSRM-suggested
alternative** separately. OSRM duration is a free-flow estimate, not live traffic. If no matching
incident is found, the response states that only the collected dataset was checked — not that the
route is clear.

## Upgrading an existing database

Fresh databases get the current schema from SQLAlchemy. Existing installations should apply the
included idempotent migration:

```bash
./scripts/migrate.sh
# or: make migrate
```

The migration is idempotent and also adds the category/severity/status/precision constraints.
It must be applied before starting an old database with this version of the application.

## Testing

```bash
cd backend
.venv/bin/pytest
```

The test suite creates `urbanflow_test` on the local PostgreSQL server and covers:

- text cleaning, tokenisation, classification, location extraction and summaries;
- the BeautifulSoup traffic-notice parser against an offline HTML fixture, including notice
  filtering, date parsing, source URLs and location extraction;
- date parsing, validation, coordinate bounds and fingerprint generation;
- incident and weather deduplication/update loading;
- API endpoints, filtering, dashboard aggregation, analytics, sources and admin-token protection;
- route corridor distance, alternative-route recommendation and same-endpoint validation;
- weather archive/forecast merge semantics and OSM parser mapping;
- unknown-status preservation during refresh and empty-dataset analytics;
- the pandas data-quality report.

The suite also covers OSM parsing, unknown-status preservation during refreshes, and empty-dataset
dashboard/analytics behaviour. Tests do not call external HTTP services.

Frontend validation:

```bash
cd frontend
npm run typecheck
npm run build
```

## Design and engineering decisions

- **Single PostgreSQL schema** rather than microservices keeps the project explainable and
  reproducible locally.
- **Explicit provenance**: `data_sources`, `source_url`, `origin`, `external_id` and collection logs
  make every stored record traceable.
- **Demo/live separation**: synthetic records are never mixed invisibly with live data.
- **No PostGIS**: centroid-level corridor matching does not require spatial extensions; the trade-off
  is documented.
- **Explainable NLP**: TF-IDF + linear SVM plus deterministic rules; no mandatory transformer
  download.
- **Honest route analysis**: routing geometry comes from OSRM, but incident matching is corridor
  proximity. The UI avoids “fastest route” or “real-time traffic” claims.
- **Privacy-conscious analytics**: no cookies, IPs, user agents or account identifiers; only event
  type, page path, optional structured metadata and a hashed session ID.

## Limitations

- No live traffic-speed provider; OSRM durations are free-flow network estimates.
- Official Mumbai Traffic Police data may be unavailable; the scraper is implemented but
  intermittent, and failures are logged.
- Coordinates are often locality centroids; 350 m corridor matching may miss or over-include
  records. OpenStreetMap roadworks show a road-segment centre and are stored with an **unknown
  status** because OSM does not confirm an active closure or its dates.
- Weather/incident correlation is descriptive and can be based on a limited overlap. The UI shows
  an explicit insufficient-data state where appropriate.
- The administrative token is a local protection mechanism, not a complete user authentication
  system.
- Mapped OpenStreetMap records are retained historically even when absent from a later OSM snapshot. Route checks consider unknown-status mapped records only when they were last edited within 12 months.
- Records with an unknown status are included in total/category/location views but are not counted as active disruptions. Analytics date axes use the source-recorded date (for OSM, the last-edit date) and label that basis.
- The application is scoped to Mumbai and is not an official traffic-control or navigation product.

## Future scope

Formal municipal/IMD data access, scheduled collection with alerting, PostGIS/road-network snapping,
a human verification workflow, richer hotspot/seasonality analysis, saved routes with opt-in
notifications, and a production-grade auth and deployment setup.

## Documentation

- [System architecture and data flow diagrams](docs/architecture.md)
- [Demonstration dataset details](docs/sample-dataset.md)
- [Database schema notes](database/README.md)
- FastAPI OpenAPI docs at `/docs` when the API is running

## Attribution

© OpenStreetMap contributors (ODbL 1.0) · Weather data by Open-Meteo (CC BY 4.0) · Routing by OSRM ·
Geocoding by Nominatim. Mumbai Traffic Police notices are public government information used for
academic, non-commercial analysis.

UrbanFlow is an academic project. It is not affiliated with any government agency and must not be
used as an official source of traffic instructions.
