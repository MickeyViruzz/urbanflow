from etl.extractors.osm_roadworks import parse_roadworks

FIXTURE = {
    "elements": [
        {
            "type": "way",
            "id": 123456,
            "timestamp": "2026-10-22T10:00:00Z",
            "center": {"lat": 19.0596, "lon": 72.8295},
            "tags": {
                "highway": "construction",
                "construction": "minor",
                "name": "Bandra Test Road",
                "check_date": "2019-05-01",
                "lanes": "2",
                "surface": "asphalt",
            },
        },
        {
            "type": "way",
            "id": 654321,
            "timestamp": "2026-10-01T09:00:00Z",
            "tags": {"highway": "construction", "name": "No centre available"},
        },
    ]
}


def test_osm_parser_marks_status_unknown_and_precision_as_segment():
    records = parse_roadworks(FIXTURE)
    assert len(records) == 1

    record = records[0]
    assert record["external_id"] == "osm-way-123456"
    assert record["status"] == "unknown"
    assert record["location_precision"] == "segment"
    assert record["location_name"] == "Bandra West"
    assert record["latitude"] == 19.0596
    assert record["longitude"] == 72.8295
    assert record["source_url"] == "https://www.openstreetmap.org/way/123456"
    assert record["start_time"].year == 2026
    assert record["raw_payload"]["status_basis"] == "osm_construction_tag"
    assert "does not confirm" in record["description"]
    assert "2019-05-01" in record["description"]


def test_osm_parser_ignores_elements_without_geometry():
    assert parse_roadworks({"elements": []}) == []
    assert parse_roadworks({}) == []
