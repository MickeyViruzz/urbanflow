"""ETL orchestration shared by the CLI and the admin refresh endpoint."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import CollectionLog, DataSource, Incident, WeatherObservation
from etl.extractors import osm_roadworks, traffic_police, weather
from etl.gazetteer import IST
from etl.loader import LoadStats, load_incidents, load_weather
from etl.normalize import derive_status
from etl.sample_data import (
    DEMO_SOURCE_SLUG,
    DEMO_WEATHER_SOURCE_SLUG,
    LIVE_WEATHER_SOURCE_SLUG,
    generate_sample_incidents,
    generate_sample_weather,
)

logger = logging.getLogger("urbanflow.pipeline")


SOURCE_DEFINITIONS = (
    {
        "slug": "traffic-police-notices",
        "name": "Mumbai Traffic Police public notices",
        "source_type": "Web scraping",
        "base_url": settings.traffic_police_url,
        "description": (
            "Public traffic notices and advisories listed on the Mumbai Traffic Police website. "
            "Collected with BeautifulSoup after a robots.txt check. The site is intermittently "
            "unreachable from automated environments; failures are logged rather than replaced "
            "with invented records."
        ),
        "licence_note": "Public government notices; collected for academic, non-commercial use.",
    },
    {
        "slug": "open-meteo",
        "name": "Open-Meteo weather API",
        "source_type": "API",
        "base_url": "https://open-meteo.com/",
        "description": (
            "Daily Mumbai temperature, precipitation, wind and weather-code observations "
            "from the Open-Meteo archive and forecast APIs. No API key required."
        ),
        "licence_note": "Open-Meteo data, CC BY 4.0; see open-meteo.com/en/license.",
    },
    {
        "slug": "osm-overpass",
        "name": "OpenStreetMap roadworks (Overpass API)",
        "source_type": "API",
        "base_url": "https://www.openstreetmap.org/",
        "description": (
            "Road segments tagged highway=construction or construction=* within UrbanFlow's "
            "Mumbai coverage bounding box, retrieved through the Overpass API with OSM "
            "metadata. OSM does not confirm operational status, so these records are marked "
            "status unknown."
        ),
        "licence_note": "© OpenStreetMap contributors, ODbL 1.0.",
    },
    {
        "slug": DEMO_SOURCE_SLUG,
        "name": "UrbanFlow Demonstration Dataset",
        "source_type": "Sample dataset",
        "base_url": None,
        "description": (
            "Synthetic traffic disruption records generated deterministically for academic "
            "demonstration. Not a live source and never displayed without a demo label."
        ),
        "licence_note": "Generated in-repository; see docs/sample-dataset.md.",
    },
    {
        "slug": DEMO_WEATHER_SOURCE_SLUG,
        "name": "UrbanFlow Example Weather Data",
        "source_type": "Sample dataset",
        "base_url": None,
        "description": (
            "Synthetic daily weather observations used only when live Open-Meteo data is "
            "unavailable during an offline demonstration."
        ),
        "licence_note": "Generated in-repository; see docs/sample-dataset.md.",
    },
)


def ensure_sources(session: Session) -> dict[str, DataSource]:
    existing = {source.slug: source for source in session.scalars(select(DataSource)).all()}
    for definition in SOURCE_DEFINITIONS:
        source = existing.get(definition["slug"])
        if source is None:
            source = DataSource(**definition)
            session.add(source)
            session.flush()
            existing[source.slug] = source
        else:
            for key in ("name", "source_type", "base_url", "description", "licence_note"):
                setattr(source, key, definition[key])
    session.commit()
    return existing


def _start_log(
    session: Session, source: DataSource | None, pipeline: str, triggered_by: str
) -> CollectionLog:
    log = CollectionLog(
        source_id=source.id if source else None,
        pipeline=pipeline,
        triggered_by=triggered_by,
        status="running",
        started_at=datetime.now(tz=IST),
    )
    session.add(log)
    session.commit()
    return log


def _finish_log(session: Session, log: CollectionLog, stats: LoadStats, status: str, message: str):
    log.finished_at = datetime.now(tz=IST)
    log.status = status
    log.records_fetched = stats.fetched
    log.records_inserted = stats.inserted
    log.records_updated = stats.updated
    log.duplicates = stats.duplicates
    log.rejected = stats.rejected
    log.message = message
    session.commit()


def run_weather(session: Session, triggered_by: str = "cli") -> dict:
    sources = ensure_sources(session)
    source = sources[LIVE_WEATHER_SOURCE_SLUG]
    log = _start_log(session, source, "weather", triggered_by)
    stats = LoadStats()
    try:
        raw = weather.fetch_weather()
        stats = load_weather(session, raw, source, origin="live")
        session.commit()
        _finish_log(session, log, stats, stats.status, stats.message())
        return {
            "pipeline": "weather",
            "status": stats.status,
            "fetched": stats.fetched,
            "inserted": stats.inserted,
            "updated": stats.updated,
            "duplicates": stats.duplicates,
            "rejected": stats.rejected,
            "message": stats.message(),
        }
    except Exception as error:
        session.rollback()
        _finish_log(session, log, stats, "failed", str(error)[:700])
        return {
            "pipeline": "weather",
            "status": "failed",
            "fetched": 0,
            "inserted": 0,
            "updated": 0,
            "duplicates": 0,
            "rejected": 0,
            "message": str(error)[:700],
        }


def run_osm(session: Session, triggered_by: str = "cli") -> dict:
    sources = ensure_sources(session)
    source = sources["osm-overpass"]
    log = _start_log(session, source, "osm-roadworks", triggered_by)
    stats = LoadStats()
    try:
        raw = osm_roadworks.fetch_roadworks()
        stats = load_incidents(session, raw, source, origin="live")
        session.commit()
        _finish_log(session, log, stats, stats.status, stats.message())
        return {
            "pipeline": "osm-roadworks",
            "status": stats.status,
            "fetched": stats.fetched,
            "inserted": stats.inserted,
            "updated": stats.updated,
            "duplicates": stats.duplicates,
            "rejected": stats.rejected,
            "message": stats.message(),
        }
    except Exception as error:
        session.rollback()
        _finish_log(session, log, stats, "failed", str(error)[:700])
        return {
            "pipeline": "osm-roadworks",
            "status": "failed",
            "fetched": 0,
            "inserted": 0,
            "updated": 0,
            "duplicates": 0,
            "rejected": 0,
            "message": str(error)[:700],
        }


def run_traffic_police(session: Session, triggered_by: str = "cli") -> dict:
    sources = ensure_sources(session)
    source = sources["traffic-police-notices"]
    log = _start_log(session, source, "traffic-police-notices", triggered_by)
    stats = LoadStats()
    try:
        raw = traffic_police.fetch_notices()
        stats = load_incidents(session, raw, source, origin="live")
        session.commit()
        _finish_log(session, log, stats, stats.status, stats.message())
        return {
            "pipeline": "traffic-police-notices",
            "status": stats.status,
            "fetched": stats.fetched,
            "inserted": stats.inserted,
            "updated": stats.updated,
            "duplicates": stats.duplicates,
            "rejected": stats.rejected,
            "message": stats.message(),
        }
    except Exception as error:
        session.rollback()
        _finish_log(session, log, stats, "failed", str(error)[:700])
        return {
            "pipeline": "traffic-police-notices",
            "status": "failed",
            "fetched": 0,
            "inserted": 0,
            "updated": 0,
            "duplicates": 0,
            "rejected": 0,
            "message": str(error)[:700],
        }


DEMO_REFRESH_DAYS = 14


def _demo_dataset_is_stale(session: Session, now: datetime | None = None) -> bool:
    """Return True when the synthetic demo set no longer has current dates."""
    now = now or datetime.now(tz=IST)
    latest_created = session.scalar(
        select(func.max(Incident.created_at)).where(Incident.origin == "demo")
    )
    if latest_created is None:
        return False
    if latest_created.tzinfo is None:
        latest_created = latest_created.replace(tzinfo=IST)
    return (now - latest_created) >= timedelta(days=DEMO_REFRESH_DAYS)


def seed_demo(session: Session, triggered_by: str = "cli", force: bool = False) -> dict:
    sources = ensure_sources(session)
    demo_source = sources[DEMO_SOURCE_SLUG]
    demo_weather_source = sources[DEMO_WEATHER_SOURCE_SLUG]
    existing = session.scalar(
        select(func.count(Incident.id)).where(Incident.origin == "demo")
    )
    if existing and force:
        session.execute(delete(Incident).where(Incident.origin == "demo"))
        session.execute(delete(WeatherObservation).where(WeatherObservation.origin == "demo"))
        session.commit()
        existing = 0
    if existing and not force:
        return {
            "pipeline": "demo-seed",
            "status": "skipped",
            "message": f"{existing} demonstration incidents already present",
        }

    log = _start_log(session, demo_source, "demo-seed", triggered_by)
    stats = load_incidents(
        session, generate_sample_incidents(), demo_source, origin="demo"
    )
    weather_log = _start_log(session, demo_weather_source, "demo-weather", triggered_by)
    weather_stats = load_weather(
        session, generate_sample_weather(), demo_weather_source, origin="demo"
    )
    session.commit()
    _finish_log(session, log, stats, stats.status, stats.message())
    _finish_log(session, weather_log, weather_stats, weather_stats.status, weather_stats.message())
    return {
        "pipeline": "demo-seed",
        "status": "success",
        "incidents": stats.inserted,
        "weather_observations": weather_stats.inserted,
        "message": "Demonstration dataset inserted with origin=demo",
    }


def refresh_statuses(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(tz=IST)
    incidents = session.scalars(select(Incident)).all()
    changed = 0
    for incident in incidents:
        # "unknown" is an explicit statement about the source (for example an
        # OSM construction tag), not a stale time-window status. Never turn it
        # into "active" merely because a date happens to be in the past.
        if incident.status == "unknown":
            continue
        status = derive_status(incident.start_time, incident.end_time, now)
        if incident.status != status:
            incident.status = status
            changed += 1
    if changed:
        session.commit()
    return changed


def run_all(session: Session, triggered_by: str = "cli") -> list[dict]:
    return [
        run_weather(session, triggered_by),
        run_osm(session, triggered_by),
        run_traffic_police(session, triggered_by),
    ]


def ensure_weather_data(session: Session) -> None:
    """Fallback for offline demos: seed labelled sample weather if none exists."""
    live_count = session.scalar(select(func.count(WeatherObservation.id)))
    if live_count:
        return
    sources = ensure_sources(session)
    source = sources[DEMO_WEATHER_SOURCE_SLUG]
    stats = load_weather(session, generate_sample_weather(), source, origin="demo")
    session.commit()
    if stats.inserted:
        log = _start_log(session, source, "demo-weather-fallback", "startup")
        _finish_log(session, log, stats, "success", stats.message())


def initialize_data(session: Session, seed_demo_enabled: bool = True) -> None:
    """Register sources and keep derived state current on every API startup."""
    ensure_sources(session)
    count = session.scalar(select(func.count(Incident.id)))
    if seed_demo_enabled:
        demo_count = session.scalar(
            select(func.count(Incident.id)).where(Incident.origin == "demo")
        )
        if count == 0:
            seed_demo(session, triggered_by="startup")
        elif demo_count and _demo_dataset_is_stale(session):
            seed_demo(session, triggered_by="startup-refresh", force=True)
    refresh_statuses(session)
    legacy_precision = session.scalar(
        select(func.count(Incident.id)).where(Incident.location_precision == "exact")
    )
    if legacy_precision:
        logger.warning(
            "%s incidents still use legacy location_precision='exact'. "
            "Run scripts/migrate.sh to apply database migrations.",
            legacy_precision,
        )
    if seed_demo_enabled:
        ensure_weather_data(session)


def autoseed_if_empty(session: Session) -> None:
    initialize_data(session, seed_demo_enabled=True)
