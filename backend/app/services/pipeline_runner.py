from __future__ import annotations

import logging
import threading

from app.database import SessionLocal
from etl.pipeline import (
    ensure_sources,
    run_all,
    run_osm,
    run_traffic_police,
    run_weather,
)

logger = logging.getLogger("urbanflow.pipeline")
_run_lock = threading.Lock()

RUNNERS = {
    "weather": run_weather,
    "osm": run_osm,
    "traffic-police": run_traffic_police,
}


def run_pipeline_job(source_keys: list[str], triggered_by: str = "admin") -> None:
    if not _run_lock.acquire(blocking=False):
        logger.warning("Pipeline refresh already running; skipping duplicate request")
        return
    try:
        with SessionLocal() as session:
            ensure_sources(session)
            if "all" in source_keys:
                results = run_all(session, triggered_by=triggered_by)
            else:
                results = [
                    RUNNERS[key](session, triggered_by=triggered_by)
                    for key in source_keys
                    if key in RUNNERS
                ]
            logger.info("Manual pipeline refresh completed: %s", results)
    except Exception:  # pragma: no cover - defensive background task guard
        logger.exception("Manual pipeline refresh crashed")
    finally:
        _run_lock.release()
