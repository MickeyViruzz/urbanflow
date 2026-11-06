import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Incident


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["database"] == "ok"


def test_dashboard_is_database_driven(client):
    with SessionLocal() as session:
        total = int(session.scalar(select(func.count(Incident.id))) or 0)
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["total_incidents"] == total
    assert payload["dataset"]["total"] == total
    assert payload["dataset"]["demo"] == 0
    assert len(payload["timeline"]) == 30
    assert len(payload["categories"]) == 7
    assert any(category["count"] > 0 for category in payload["categories"])
    assert payload["announcements"], "Expected active/upcoming announcements"
    assert payload["stats"]["active_disruptions"] >= 2


def test_incident_list_filters_and_pagination(client):
    response = client.get("/api/incidents", params={"page_size": 2})
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 2
    assert payload["pages"] >= 2
    assert payload["total"] >= 4

    closed = client.get("/api/incidents", params={"status": "resolved"}).json()
    assert all(item["status"] == "resolved" for item in closed["items"])

    accidents = client.get("/api/incidents", params={"category": "Accident"}).json()
    assert accidents["items"]
    assert all(item["category"] == "Accident" for item in accidents["items"])

    searched = client.get("/api/incidents", params={"search": "procession"}).json()
    assert any("procession" in item["title"].lower() for item in searched["items"])

    assert client.get("/api/incidents", params={"status": "unknown"}).status_code == 200
    assert client.get("/api/incidents", params={"status": "nonsense"}).status_code == 422


def test_incident_detail_and_not_found(client):
    listing = client.get("/api/incidents").json()
    incident_id = listing["items"][0]["id"]
    response = client.get(f"/api/incidents/{incident_id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["description"]
    assert payload["source_name"]
    assert payload["classification"]["method"] == "supplied"
    assert client.get("/api/incidents/999999").status_code == 404


def test_map_returns_only_geocoded_records(client):
    response = client.get("/api/incidents/map")
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"]
    assert all(item["latitude"] is not None for item in payload["items"])
    assert payload["note"]


def test_traffic_analytics(client):
    response = client.get("/api/analytics/traffic", params={"days": 90})
    assert response.status_code == 200
    payload = response.json()
    assert payload["range_days"] == 90
    assert len(payload["frequency"]["series"]) == 90
    assert payload["totals"]["incidents"] > 0
    assert payload["weather"]["available"] is True
    assert payload["weather"]["insufficient_data"] is True
    assert payload["categories"]["series"]


def test_metadata_and_sources(client):
    meta = client.get("/api/meta")
    assert meta.status_code == 200
    assert len(meta.json()["categories"]) == 7
    assert meta.json()["locations"]

    sources = client.get("/api/sources")
    assert sources.status_code == 200
    payload = sources.json()
    assert len(payload["sources"]) >= 5
    assert payload["summary"]["total_records"] >= 4

    logs = client.get("/api/pipeline/logs")
    assert logs.status_code == 200
    assert "items" in logs.json()


def test_website_analytics_round_trip(client):
    before = client.get("/api/analytics/website").json()["totals"]["events"]
    payload = {
        "event_type": "page_view",
        "page_path": "/test-page-py",
        "metadata": {"source": "pytest"},
        "session_id": "pytest-session",
    }
    created = client.post("/api/analytics/events", json=payload)
    assert created.status_code == 201
    assert created.json()["status"] == "recorded"

    invalid = client.post(
        "/api/analytics/events",
        json={"event_type": "not_an_event", "metadata": {}},
    )
    assert invalid.status_code == 422

    report = client.get("/api/analytics/website").json()
    assert report["totals"]["events"] == before + 1
    assert any(page["path"] == "/test-page-py" for page in report["top_pages"])


def test_pipeline_refresh_requires_admin_token(client, monkeypatch):
    denied = client.post("/api/pipeline/run", json={"sources": ["weather"]})
    assert denied.status_code == 401

    wrong = client.post(
        "/api/pipeline/run",
        json={"sources": ["weather"]},
        headers={"X-Admin-Token": "wrong-token"},
    )
    assert wrong.status_code == 401

    # Avoid network access in tests while exercising token validation and dispatch.
    monkeypatch.setattr("app.routers.sources.run_pipeline_job", lambda *args, **kwargs: None)
    accepted = client.post(
        "/api/pipeline/run",
        json={"sources": ["weather"]},
        headers={"X-Admin-Token": "test-admin-token"},
    )
    assert accepted.status_code == 202
    assert accepted.json()["status"] == "accepted"


def test_admin_dependency_handles_unicode_and_disabled_configuration(monkeypatch):
    from app.config import settings
    from app.routers.sources import require_admin

    with pytest.raises(HTTPException) as error:
        require_admin("café")
    assert error.value.status_code == 401

    monkeypatch.setattr(settings, "admin_token", "")
    with pytest.raises(HTTPException) as disabled:
        require_admin("anything")
    assert disabled.value.status_code == 503
