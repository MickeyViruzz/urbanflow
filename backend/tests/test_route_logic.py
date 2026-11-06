from datetime import datetime, timedelta

import pytest
from sqlalchemy import delete

from app.database import SessionLocal
from app.models import DataSource, Incident
from app.services import routing
from app.services.geo import GeocodeResult, distance_to_route_m, haversine_m
from app.services.routing import RouteOption, check_route
from etl.gazetteer import IST
from etl.loader import load_incidents


def test_point_to_route_distance():
    route = [(19.05, 72.83), (19.15, 72.83)]
    distance, fraction = distance_to_route_m(19.10, 72.831, route)
    assert 90 < distance < 115
    assert 0.4 < fraction < 0.6
    far_distance, _ = distance_to_route_m(19.10, 72.90, route)
    assert far_distance > 5_000


def test_haversine_reasonable():
    distance = haversine_m(19.0596, 72.8295, 19.1136, 72.8697)
    assert 6_000 < distance < 8_000


def test_route_check_recommends_lower_hazard_alternative(monkeypatch):
    primary = RouteOption(
        option_id="primary",
        distance_m=12_000,
        duration_s=900,
        geometry=[(19.02, 72.8295), (19.08, 72.8295), (19.14, 72.8295)],
        hazards=[],
    )
    alternative = RouteOption(
        option_id="alternative-1",
        distance_m=14_000,
        duration_s=1_050,
        geometry=[(19.02, 72.7790), (19.08, 72.7790), (19.14, 72.7790)],
        hazards=[],
    )

    def fake_geocode(query: str) -> GeocodeResult:
        if "origin" in query.lower():
            return GeocodeResult(query, "Test origin", 19.02, 72.8295, "test")
        return GeocodeResult(query, "Test destination", 19.14, 72.8295, "test")

    monkeypatch.setattr(routing, "geocode", fake_geocode)
    monkeypatch.setattr(routing, "_fetch_osrm", lambda _origin, _dest: [primary, alternative])

    with SessionLocal() as session:
        result = check_route(session, "Test origin", "Test destination")

    assert result["route"]["distance_m"] == 12_000
    assert result["suggested_alternative"] is not None
    assert result["suggested_alternative"]["option_id"] == "alternative-1"
    assert result["suggested_alternative"]["hazard_count"] == 0
    assert result["disruptions"], "Expected at least one seeded disruption near the route"
    assert any(
        incident["location_name"] == "Bandra West" for incident in result["disruptions"]
    )
    assert result["disruptions"][0]["match_type"] == "corridor_proximity"
    assert result["context"]["corridor_m"] == 350


def test_route_check_rejects_same_place(monkeypatch):
    def fake_geocode(query: str) -> GeocodeResult:
        return GeocodeResult(query, "Same place", 19.07, 72.87, "test")

    monkeypatch.setattr(routing, "geocode", fake_geocode)
    with SessionLocal() as session:
        with pytest.raises(Exception) as error:
            check_route(session, "Bandra", "Bandra")
    assert "same place" in str(error.value).lower()


def test_route_check_ignores_old_unknown_osm_records(monkeypatch):
    now = datetime.now(tz=IST)
    with SessionLocal() as session:
        source = DataSource(
            slug="test-route-osm",
            name="Route OSM test source",
            source_type="API",
        )
        session.add(source)
        session.commit()
        try:
            load_incidents(
                session,
                [
                    {
                        "external_id": "old-osm-record",
                        "title": "Road construction: old mapped segment",
                        "description": "Mapped road construction with an old OSM edit.",
                        "category": "Construction",
                        "status": "unknown",
                        "location_name": "Mulund",
                        "latitude": 19.30,
                        "longitude": 72.90,
                        "location_precision": "segment",
                        "start_time": now - timedelta(days=500),
                        "last_updated_at": now - timedelta(days=500),
                    },
                    {
                        "external_id": "recent-osm-record",
                        "title": "Road construction: recent mapped segment",
                        "description": "Mapped road construction with a recent OSM edit.",
                        "category": "Construction",
                        "status": "unknown",
                        "location_name": "Mulund",
                        "latitude": 19.31,
                        "longitude": 72.90,
                        "location_precision": "segment",
                        "start_time": now - timedelta(days=10),
                        "last_updated_at": now - timedelta(days=10),
                    },
                ],
                source,
                origin="live",
                now=now,
            )
            session.commit()

            primary = RouteOption(
                option_id="primary",
                distance_m=8_000,
                duration_s=600,
                geometry=[(19.25, 72.90), (19.35, 72.90)],
                hazards=[],
            )

            def fake_geocode(query: str) -> GeocodeResult:
                if "origin" in query.lower():
                    return GeocodeResult(query, "Test origin", 19.25, 72.90, "test")
                return GeocodeResult(query, "Test destination", 19.35, 72.90, "test")

            monkeypatch.setattr(routing, "geocode", fake_geocode)
            monkeypatch.setattr(routing, "_fetch_osrm", lambda _origin, _dest: [primary])

            result = check_route(session, "Test origin", "Test destination")
            titles = {incident["title"] for incident in result["disruptions"]}
            assert "Road construction: recent mapped segment" in titles
            assert "Road construction: old mapped segment" not in titles
            assert result["context"]["unknown_lookback_days"] == 365
        finally:
            session.execute(delete(Incident).where(Incident.source_id == source.id))
            session.delete(source)
            session.commit()
