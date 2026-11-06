# UrbanFlow Demonstration Dataset

## Purpose

Live public sources can be slow, rate-limited or unavailable during an academic presentation.
UrbanFlow therefore includes a small, deterministic **synthetic** dataset so every page and chart
can be evaluated offline. It is never presented as a live traffic feed.

## Separation from collected records

- Every synthetic incident has `origin = "demo"`.
- Sample incidents belong to the source **UrbanFlow Demonstration Dataset**
  (`slug = demo-dataset`), a registered row in `data_sources`.
- Sample weather belongs to **UrbanFlow Example Weather Data** (`slug = demo-weather`).
- The UI labels demo records in tables, the map, detail drawers and the dashboard notice; demo and
  live data can be filtered separately.
- Live Open-Meteo and OpenStreetMap records are stored with `origin = "live"` under their own
  sources.

## Composition

The generator is `backend/etl/sample_data.py`.

- **172 incidents** are generated with a fixed random seed (`20261105`) and the current date as the
  anchor.
- Incident dates span roughly the last 165 days with additional active/upcoming records near the
  present, so the 30- and 90-day analytics views have data.
- Categories use the seven system categories (Accident, Road Closure, Construction, Traffic
  Diversion, Public Event, Parking Restriction, Other).
- Locations use the curated Mumbai gazetteer. Coordinates are **locality centroids**, never exact
  incident positions. These records are marked `location_precision = "locality"`.
- Status values are derived from each record's start/end time at ingestion and refreshed on API
  startup.
- Severity values are low, medium or high.
- Each record receives a stable fingerprint and content hash so re-running the seeder does not
  insert duplicates.
- **126 weather observations** are generated: 121 daily historical observations plus a 5-day
  forecast. Forecast values include two deliberately rainy days so the weather-alert UI can be
  evaluated when live Open-Meteo data is absent.

Descriptions are plausible but synthetic. They do not quote a specific real incident, person or
official statement. The sample source URL is `null` because there is no original public notice.

## Reset / regenerate

Demo data is seeded automatically on API startup when the database is empty
(`DEMO_AUTOSEED=true`). It is also regenerated automatically if the existing demo records were
created more than 14 days ago, so an older demonstration does not turn entirely into resolved
records. Live records are never touched. The pipeline command can regenerate it manually:

```bash
cd backend
.venv/bin/python -m etl.run_pipeline --seed-demo --force-demo
```

`--force-demo` deletes existing rows with `origin = 'demo'` (incidents and weather) before inserting
a fresh sample. Live records are untouched.

To start over completely, drop and recreate the database, then run:

```bash
.venv/bin/python -m etl.run_pipeline --init-db --seed-demo
```

## What evaluators should understand

- The demonstration data exists to exercise the pipeline and interface; it is clearly
  distinguishable from collected data.
- Analytics computed over the dataset are real aggregations of the stored sample records, not
  hardcoded chart values.
- Conclusions drawn from demo data must not be presented as real Mumbai traffic findings.
- Live records collected from OpenStreetMap and Open-Meteo remain in the same database but under
  separate sources, with their own timestamps and attribution.
