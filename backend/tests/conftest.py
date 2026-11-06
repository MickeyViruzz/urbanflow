from __future__ import annotations

import os
from datetime import datetime, timedelta

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://urbanflow@localhost:5433/urbanflow_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["DEMO_AUTOSEED"] = "false"
os.environ["ADMIN_TOKEN"] = "test-admin-token"

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import make_url

from app.database import Base, SessionLocal, engine
from app.main import app
from etl.gazetteer import IST
from etl.loader import load_incidents, load_weather
from etl.pipeline import ensure_sources


def _create_test_database() -> None:
    url = make_url(TEST_DATABASE_URL)
    admin_dsn = (
        f"postgresql://{url.username}@{url.host or 'localhost'}:{url.port or 5432}/postgres"
    )
    with psycopg.connect(admin_dsn, autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)
        ).fetchone()
        if not exists:
            connection.execute(f'CREATE DATABASE "{url.database}"')


def _seed(session) -> None:
    sources = ensure_sources(session)
    now = datetime.now(tz=IST)
    incidents = [
        {
            "external_id": "test-accident",
            "title": "Two-car collision on SV Road near Bandra West",
            "description": (
                "A collision involving two cars was reported near Bandra West. "
                "One lane is partially blocked and traffic is moving slowly."
            ),
            "category": "Accident",
            "severity": "high",
            "status": "active",
            "location_name": "Bandra West",
            "latitude": 19.0596,
            "longitude": 72.8295,
            "start_time": now - timedelta(hours=3),
            "end_time": now + timedelta(hours=3),
            "published_at": now - timedelta(hours=4),
            "source_url": "https://trafficpolice.maharashtra.gov.in/notice/test-1",
        },
        {
            "external_id": "test-closure",
            "title": "Road closure on LBS Marg near Kurla",
            "description": (
                "LBS Marg is closed for traffic near Kurla due to emergency repair work. "
                "Use the service road as a diversion."
            ),
            "category": "Road Closure",
            "severity": "medium",
            "status": "active",
            "location_name": "Kurla",
            "latitude": 19.0726,
            "longitude": 72.8845,
            "start_time": now - timedelta(hours=24),
            "end_time": now + timedelta(hours=24),
            "published_at": now - timedelta(hours=25),
        },
        {
            "external_id": "test-construction",
            "title": "Metro construction activity at Andheri East",
            "description": (
                "Metro construction activity has narrowed the carriageway near Andheri East. "
                "Barricades are present on the roadside."
            ),
            "category": "Construction",
            "severity": "medium",
            "status": "resolved",
            "location_name": "Andheri East",
            "latitude": 19.1136,
            "longitude": 72.8697,
            "start_time": now - timedelta(days=10),
            "end_time": now - timedelta(days=8),
            "published_at": now - timedelta(days=11),
        },
        {
            "external_id": "test-event",
            "title": "Festival procession through Dadar",
            "description": (
                "A public procession will pass through Dadar. Rolling road restrictions "
                "will apply along the route through the evening."
            ),
            "category": "Public Event",
            "severity": "low",
            "status": "upcoming",
            "location_name": "Dadar",
            "latitude": 19.0186,
            "longitude": 72.8443,
            "start_time": now + timedelta(days=2),
            "end_time": now + timedelta(days=2, hours=6),
            "published_at": now - timedelta(hours=2),
        },
    ]
    load_incidents(session, incidents, sources["traffic-police-notices"], origin="live", now=now)
    weather = [
        {
            "observed_at": (now - timedelta(days=1)).replace(hour=12, minute=0, second=0, microsecond=0),
            "kind": "observed",
            "temperature_c": 29.4,
            "precipitation_mm": 0.0,
            "precipitation_probability": None,
            "wind_speed_kmh": 14.2,
            "weather_code": 1,
            "condition": "Mainly clear",
            "origin": "live",
        },
        {
            "observed_at": now.replace(hour=12, minute=0, second=0, microsecond=0),
            "kind": "observed",
            "temperature_c": 28.1,
            "precipitation_mm": 14.6,
            "precipitation_probability": None,
            "wind_speed_kmh": 21.0,
            "weather_code": 63,
            "condition": "Moderate rain",
            "origin": "live",
        },
    ]
    load_weather(session, weather, sources["open-meteo"], origin="live")
    session.commit()


@pytest.fixture(scope="session")
def client():
    _create_test_database()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        _seed(session)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session():
    with SessionLocal() as session:
        yield session
