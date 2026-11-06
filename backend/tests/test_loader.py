from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import DataSource, Incident, WeatherObservation
from etl.gazetteer import IST
from etl.loader import load_incidents, load_weather


def _raw_incident(now: datetime) -> dict:
    return {
        "external_id": "loader-test-1",
        "title": "Road closure on a test corridor",
        "description": "The road is closed for traffic while a test repair is completed safely.",
        "category": "Road Closure",
        "start_time": now - timedelta(hours=1),
        "end_time": now + timedelta(hours=3),
        "location_name": "Kurla",
        "latitude": 19.0726,
        "longitude": 72.8845,
    }


def test_incident_loader_deduplicates_and_updates():
    now = datetime.now(tz=IST)
    with SessionLocal() as session:
        source = DataSource(
            slug="test-loader-source",
            name="Loader test source",
            source_type="API",
            base_url="https://example.org",
        )
        session.add(source)
        session.commit()
        try:
            first = load_incidents(session, [_raw_incident(now)], source, origin="live", now=now)
            session.commit()
            assert first.inserted == 1
            assert first.rejected == 0

            second = load_incidents(session, [_raw_incident(now)], source, origin="live", now=now)
            session.commit()
            assert second.inserted == 0
            assert second.duplicates == 1

            changed = _raw_incident(now)
            changed["description"] = (
                "The closure has been shortened; one lane is now open while final repair work ends."
            )
            third = load_incidents(session, [changed], source, origin="live", now=now)
            session.commit()
            assert third.updated == 1
            assert third.inserted == 0

            record = session.scalar(
                select(Incident).where(Incident.source_id == source.id)
            )
            assert record is not None
            assert "one lane" in record.description
            assert record.raw_payload["_classification"]["method"] == "supplied"
        finally:
            session.execute(delete(Incident).where(Incident.source_id == source.id))
            session.delete(source)
            session.commit()


def test_weather_loader_deduplicates():
    now = datetime.now(tz=IST)
    with SessionLocal() as session:
        source = DataSource(
            slug="test-weather-source",
            name="Weather test source",
            source_type="API",
        )
        session.add(source)
        session.commit()
        try:
            observation = {
                "observed_at": now.replace(hour=12, minute=0, second=0, microsecond=0),
                "kind": "observed",
                "temperature_c": 30.0,
                "precipitation_mm": 2.4,
                "precipitation_probability": None,
                "wind_speed_kmh": 12.0,
                "weather_code": 61,
                "condition": "Light rain",
                "origin": "live",
            }
            first = load_weather(session, [observation], source, origin="live")
            session.commit()
            second = load_weather(session, [observation], source, origin="live")
            session.commit()
            assert first.inserted == 1
            assert second.duplicates == 1
        finally:
            session.execute(
                delete(WeatherObservation).where(WeatherObservation.source_id == source.id)
            )
            session.delete(source)
            session.commit()
