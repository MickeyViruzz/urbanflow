"""Command-line entry point for the UrbanFlow ETL pipeline.

Examples:
    python -m etl.run_pipeline --init-db --seed-demo --all
    python -m etl.run_pipeline --update-only
    python -m etl.run_pipeline --refresh-statuses
"""

from __future__ import annotations

import argparse
import json
import sys

from app.database import Base, SessionLocal, engine
from etl.pipeline import (
    ensure_sources,
    refresh_statuses,
    run_all,
    run_osm,
    run_traffic_police,
    run_weather,
    seed_demo,
)
from etl.quality import build_quality_report


def main() -> int:
    parser = argparse.ArgumentParser(description="UrbanFlow ETL pipeline")
    parser.add_argument("--init-db", action="store_true", help="Create database tables")
    parser.add_argument("--seed-demo", action="store_true", help="Insert the labelled demonstration dataset")
    parser.add_argument("--force-demo", action="store_true", help="Regenerate demo records if present")
    parser.add_argument("--all", action="store_true", help="Run every live collector")
    parser.add_argument("--weather", action="store_true", help="Collect Open-Meteo weather data")
    parser.add_argument("--osm", action="store_true", help="Collect OpenStreetMap roadworks")
    parser.add_argument("--traffic-police", action="store_true", help="Attempt the traffic police scraper")
    parser.add_argument("--refresh-statuses", action="store_true", help="Recompute time-based incident statuses")
    parser.add_argument("--quality-report", action="store_true", help="Print a pandas data-quality report")
    args = parser.parse_args()

    if not any(
        [
            args.init_db,
            args.seed_demo,
            args.all,
            args.weather,
            args.osm,
            args.traffic_police,
            args.refresh_statuses,
            args.quality_report,
        ]
    ):
        parser.print_help()
        return 1

    if args.init_db:
        Base.metadata.create_all(bind=engine)
        print(json.dumps({"schema": "created"}))

    with SessionLocal() as session:
        ensure_sources(session)
        results: list[dict] = []
        if args.force_demo:
            demo = seed_demo(session, triggered_by="cli", force=True)
            results.append(demo)
        elif args.seed_demo:
            results.append(seed_demo(session, triggered_by="cli"))
        if args.all:
            results.extend(run_all(session, triggered_by="cli"))
        else:
            if args.weather:
                results.append(run_weather(session, triggered_by="cli"))
            if args.osm:
                results.append(run_osm(session, triggered_by="cli"))
            if args.traffic_police:
                results.append(run_traffic_police(session, triggered_by="cli"))
        if args.refresh_statuses:
            changed = refresh_statuses(session)
            results.append({"pipeline": "status-refresh", "status": "success", "updated": changed})
        if args.quality_report:
            results.append(
                {
                    "pipeline": "quality-report",
                    "status": "success",
                    "report": build_quality_report(session),
                }
            )

    for result in results:
        print(json.dumps(result, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
