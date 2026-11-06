from datetime import datetime, timedelta

import pytest

from etl.gazetteer import IST
from etl.normalize import (
    ValidationError,
    build_fingerprint,
    derive_status,
    parse_datetime,
    prepare_incident,
)

NOW = datetime(2026, 1, 15, 12, 0, tzinfo=IST)


def test_parse_datetime_handles_strings_and_assumes_ist():
    parsed = parse_datetime("15 Jan 2026 09:30")
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parsed.hour == 9
    assert parse_datetime("") is None
    assert parse_datetime("not a date at all !!!") is None


def test_derive_status_uses_time_window():
    assert derive_status(NOW, NOW, NOW) == "active"
    assert derive_status(NOW, None, NOW) == "active"
    assert derive_status(NOW.replace(hour=14), None, NOW) == "upcoming"
    assert derive_status(NOW.replace(hour=8), NOW.replace(hour=10), NOW) == "resolved"


def test_prepare_incident_normalises_and_extracts_location():
    raw = {
        "title": "<b>Road closure</b> on SV Road",
        "description": "  The road is <i>closed</i> for repair work near Bandra West.  ",
        "start_time": "15 Jan 2026 08:00",
        "end_time": "16 Jan 2026 18:00",
        "source_url": "https://example.org/notices/1",
    }
    record = prepare_incident(raw, "test-source", origin="live", now=NOW)
    assert record["title"] == "Road closure on SV Road"
    assert record["category"] == "Road Closure"
    assert record["location_name"] == "Bandra West"
    assert record["latitude"] == pytest.approx(19.0596)
    assert record["location_precision"] == "locality"
    assert record["status"] == "active"
    assert record["fingerprint"] and record["content_hash"]
    assert len(record["summary"]) > 0


def test_prepare_incident_allows_undated_unknown_record():
    record = prepare_incident(
        {
            "title": "Traffic advisory without a listed date",
            "description": "The listing did not publish a date for this advisory.",
            "category": "Traffic Diversion",
            "status": "unknown",
        },
        "traffic-police-notices",
        now=NOW,
    )
    assert record["status"] == "unknown"
    assert record["start_time"] is None
    assert record["published_at"] is None
    assert record["last_updated_at"] == NOW


def test_prepare_incident_rejects_missing_fields():
    with pytest.raises(ValidationError):
        prepare_incident({"description": "No title here"}, "test", now=NOW)
    with pytest.raises(ValidationError):
        prepare_incident(
            {"title": "Valid title", "description": "Valid description of the event"},
            "test",
            now=NOW,
        )


def test_prepare_incident_preserves_unknown_status_and_legacy_precision():
    record = prepare_incident(
        {
            "title": "Road construction: mapped OSM segment",
            "description": "OpenStreetMap maps this road as under construction.",
            "category": "Construction",
            "start_time": NOW - timedelta(days=30),
            "latitude": 19.0596,
            "longitude": 72.8295,
            "location_name": "Bandra West",
            "location_precision": "exact",
            "status": "unknown",
        },
        "osm-overpass",
        now=NOW,
    )
    assert record["status"] == "unknown"
    assert record["location_precision"] == "segment"


def test_prepare_incident_drops_out_of_region_coordinates():
    record = prepare_incident(
        {
            "title": "Road closure in another city",
            "description": "Road closure on a distant road for maintenance work.",
            "start_time": NOW,
            "latitude": 12.9716,
            "longitude": 77.5946,
            "location_name": "Bandra West",
            "category": "Road Closure",
        },
        "source",
        now=NOW,
    )
    assert record["latitude"] == pytest.approx(19.0596)
    assert record["longitude"] == pytest.approx(72.8295)
    assert record["location_precision"] == "locality"


def test_prepare_incident_rejects_invalid_source_url():
    record = prepare_incident(
        {
            "title": "Road closure on LBS Marg",
            "description": "The road is closed for traffic near Kurla for repairs.",
            "start_time": NOW,
            "source_url": "javascript:alert(1)",
            "category": "Road Closure",
        },
        "source",
        now=NOW,
    )
    assert record["source_url"] is None


def test_fingerprint_is_stable_and_source_specific():
    start = NOW
    first = build_fingerprint("source-a", None, "Road closure", "Bandra", start)
    second = build_fingerprint("source-a", None, "Road closure", "Bandra", start)
    other_source = build_fingerprint("source-b", None, "Road closure", "Bandra", start)
    assert first == second
    assert first != other_source
    external_first = build_fingerprint("a", "osm-way-1", "Different title", None, start)
    external_second = build_fingerprint("a", "osm-way-1", "Updated title", None, start)
    assert external_first == external_second
