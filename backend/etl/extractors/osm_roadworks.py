"""OpenStreetMap roadworks extraction through the public Overpass API.

Each record is attributed to its OpenStreetMap way. Coordinates are the way's
published centre, so they are marked as `location_precision = "segment"` — a
road-segment centre, not an exact incident location. OSM construction tags do
not publish a confirmed operational status or end date, so records are stored
with `status = "unknown"` rather than being presented as active closures.
"""

from __future__ import annotations

import time
from datetime import datetime

import requests

from app.config import settings
from etl.gazetteer import IST, nearest_place
from etl.normalize import parse_datetime

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
# Bounding box roughly covering Mumbai City and Mumbai Suburban districts.
QUERY = """
[out:json][timeout:35];
(
  way(18.89,72.77,19.30,73.02)["highway"="construction"];
  way(18.89,72.77,19.30,73.02)["construction"];
);
out center tags meta 80;
"""


class ExtractionError(RuntimeError):
    pass


def parse_roadworks(payload: dict) -> list[dict]:
    """Map an Overpass response to normalised raw records (pure, testable)."""
    records: list[dict] = []
    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        center = element.get("center") or {}
        latitude = center.get("lat")
        longitude = center.get("lon")
        if latitude is None or longitude is None:
            continue

        name = tags.get("name") or tags.get("ref") or f"Unnamed road (OSM way {element.get('id')})"
        place, distance = nearest_place(latitude, longitude)
        location_name = place.name if distance < 4_000 else name
        edited = parse_datetime(element.get("timestamp"))
        check_date = parse_datetime(tags.get("check_date"))
        observed_at = edited or check_date or datetime.now(tz=IST)
        construction_type = tags.get("construction", "road works").replace("_", " ")
        tag_bits = [
            f"highway={tags.get('highway')}" if tags.get("highway") else None,
            f"construction={tags.get('construction')}" if tags.get("construction") else None,
            f"lanes={tags.get('lanes')}" if tags.get("lanes") else None,
            f"surface={tags.get('surface')}" if tags.get("surface") else None,
        ]
        tag_summary = ", ".join(bit for bit in tag_bits if bit)
        check_note = (
            f"Latest OSM check date: {check_date.date().isoformat()}. " if check_date else ""
        )
        description = (
            f"OpenStreetMap records this road segment as under construction "
            f"({construction_type}). {tag_summary + '. ' if tag_summary else ''}"
            f"The OSM way was last edited on {edited.date().isoformat() if edited else 'an unknown date'}. "
            f"{check_note}"
            "OSM does not confirm that the road is currently closed; verify with official "
            "traffic advisories before relying on this record."
        )
        records.append(
            {
                "external_id": f"osm-way-{element.get('id')}",
                "title": f"Road construction: {name}"[:300],
                "description": description,
                "category": "Construction",
                "severity": "medium",
                "location_name": location_name,
                "latitude": latitude,
                "longitude": longitude,
                "location_precision": "segment",
                "start_time": observed_at,
                "end_time": None,
                "published_at": observed_at,
                "last_updated_at": observed_at,
                "status": "unknown",
                "source_url": f"https://www.openstreetmap.org/way/{element.get('id')}",
                "raw_payload": {
                    "osm_type": element.get("type"),
                    "osm_id": element.get("id"),
                    "tags": tags,
                    "osm_timestamp": element.get("timestamp"),
                    "status_basis": "osm_construction_tag",
                },
            }
        )
    return records


def fetch_roadworks() -> list[dict]:
    payload = None
    errors: list[str] = []
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = requests.post(
                endpoint,
                data={"data": QUERY},
                timeout=50,
                headers={
                    "User-Agent": settings.http_user_agent,
                    "Accept": "application/json",
                },
            )
            response.raise_for_status()
            payload = response.json()
            break
        except (requests.RequestException, ValueError) as error:
            errors.append(f"{endpoint}: {error}")
            time.sleep(0.8)

    if payload is None:
        raise ExtractionError(
            "OpenStreetMap Overpass request failed after trying all mirrors: "
            + "; ".join(errors[-3:])
        )
    return parse_roadworks(payload)
