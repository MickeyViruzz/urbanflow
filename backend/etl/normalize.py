from __future__ import annotations

import hashlib
import re
from datetime import date, datetime, time
from typing import Any
from urllib.parse import urlparse

from dateutil import parser as date_parser

from .gazetteer import IST, extract_locations, find_place, is_within_mumbai
from .nlp import CATEGORIES, classify_incident, clean_text, summarize

SEVERITIES = {"low", "medium", "high"}


class ValidationError(ValueError):
    pass


def parse_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time(hour=9))
    elif isinstance(value, (int, float)):
        parsed = datetime.fromtimestamp(value, tz=IST)
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            parsed = date_parser.parse(text, fuzzy=True)
        except (ValueError, TypeError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=IST)
    return parsed.astimezone(IST)


def derive_status(
    start_time: datetime | None, end_time: datetime | None, now: datetime | None = None
) -> str:
    now = now or datetime.now(tz=IST)
    if start_time and start_time > now:
        return "upcoming"
    if end_time and end_time < now:
        return "resolved"
    if start_time:
        return "active"
    return "upcoming"


def _hash(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def build_fingerprint(
    source_slug: str,
    external_id: str | None,
    title: str,
    location_name: str | None,
    start_time: datetime | None,
) -> str:
    if external_id:
        return _hash("source", source_slug, "external", str(external_id).strip().lower())
    return _hash(
        "source",
        source_slug,
        "content",
        title.strip().lower(),
        (location_name or "").strip().lower(),
        start_time.date().isoformat() if start_time else "",
    )


def content_hash(record: dict) -> str:
    parts = [
        str(record.get("title") or ""),
        str(record.get("description") or ""),
        str(record.get("location_name") or ""),
        str(record.get("start_time") or ""),
        str(record.get("end_time") or ""),
        str(record.get("status") or ""),
        str(record.get("category") or ""),
        str(record.get("severity") or ""),
    ]
    return _hash(*parts)


def _valid_http_url(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return value[:600]


def prepare_incident(
    raw: dict,
    source_slug: str,
    origin: str = "live",
    now: datetime | None = None,
) -> dict:
    """Normalise, classify, validate and fingerprint one raw record."""
    now = now or datetime.now(tz=IST)
    title = clean_text(str(raw.get("title") or ""))[:300]
    description = clean_text(str(raw.get("description") or ""))
    if len(title) < 6:
        raise ValidationError("title is missing or too short")
    if len(description) < 10:
        raise ValidationError("description is missing or too short")

    start_time = parse_datetime(raw.get("start_time"))
    end_time = parse_datetime(raw.get("end_time"))
    published_at = parse_datetime(raw.get("published_at"))
    last_updated_at = parse_datetime(raw.get("last_updated_at"))

    if start_time is None and published_at is not None:
        start_time = published_at
    requested_status = str(raw.get("status") or "").lower()
    if start_time is None and requested_status != "unknown":
        raise ValidationError("start time could not be parsed")
    if end_time is not None and start_time is not None and end_time < start_time:
        end_time = None
    if published_at is None and start_time is not None:
        published_at = start_time
    if last_updated_at is None:
        last_updated_at = now
    if published_at is not None and last_updated_at < published_at:
        last_updated_at = now
    if last_updated_at > now:
        last_updated_at = now

    # Some sources, notably OpenStreetMap construction tags, do not publish a
    # confirmed start/end or operational status. Preserve "unknown" rather than
    # inferring that the disruption is active.
    status = "unknown" if requested_status == "unknown" else derive_status(
        start_time, end_time, now
    )

    severity = str(raw.get("severity") or "medium").lower()
    if severity not in SEVERITIES:
        severity = "medium"

    location_name = clean_text(str(raw.get("location_name") or "")) or None
    text_for_location = f"{title}. {description}"
    if not location_name:
        places = extract_locations(text_for_location)
        locality = next((place for place in places if place.kind == "locality"), None)
        location_name = locality.name if locality else (places[0].name if places else None)

    latitude = raw.get("latitude")
    longitude = raw.get("longitude")
    try:
        latitude = float(latitude) if latitude not in (None, "") else None
        longitude = float(longitude) if longitude not in (None, "") else None
    except (TypeError, ValueError):
        latitude, longitude = None, None
    if latitude is not None and longitude is not None:
        if not is_within_mumbai(latitude, longitude):
            latitude, longitude = None, None
    else:
        latitude, longitude = None, None

    location_precision = str(raw.get("location_precision") or "locality")
    # Older OSM records used "exact"; that overstated precision. A road-segment
    # centre is now represented explicitly as "segment".
    if location_precision == "exact":
        location_precision = "segment"
    if latitude is None and location_name:
        place = find_place(location_name)
        if place:
            latitude, longitude = place.lat, place.lon
            location_name = place.name
            location_precision = "locality"
    if latitude is not None and location_precision not in {"segment", "locality", "unknown"}:
        location_precision = "locality"
    if latitude is None:
        location_precision = "unknown"

    requested_category = str(raw.get("category") or "").strip()
    classification_method = "supplied"
    confidence = 1.0
    if requested_category not in CATEGORIES:
        category, confidence, classification_method = classify_incident(title, description)
    else:
        category = requested_category

    summary = clean_text(str(raw.get("summary") or "")) or summarize(description)
    source_url = _valid_http_url(raw.get("source_url"))
    external_id = str(raw["external_id"])[:160] if raw.get("external_id") else None

    record = {
        "external_id": external_id,
        "title": title,
        "category": category,
        "status": status,
        "severity": severity,
        "description": description,
        "summary": summary,
        "location_name": location_name,
        "latitude": latitude,
        "longitude": longitude,
        "location_precision": location_precision,
        "start_time": start_time,
        "end_time": end_time,
        "published_at": published_at,
        "last_updated_at": last_updated_at,
        "source_url": source_url,
        "origin": origin if origin in {"live", "demo"} else "live",
        "raw_payload": raw.get("raw_payload"),
    }
    record["fingerprint"] = raw.get("fingerprint") or build_fingerprint(
        source_slug, external_id, title, location_name, start_time
    )
    record["content_hash"] = content_hash(record)
    record["classification"] = {
        "method": classification_method,
        "confidence": confidence,
    }
    if not location_name and not latitude:
        record["location_name"] = None
    return record


def clean_web_text(value: str) -> str:
    """Remove notices-site boilerplate and collapse whitespace."""
    cleaned = clean_text(value)
    cleaned = re.sub(r"(?i)click here.*?$", "", cleaned)
    cleaned = re.sub(r"(?i)read more\s*[»>]*\s*$", "", cleaned)
    return cleaned.strip()


def incident_date(record: dict) -> date | None:
    start = record.get("start_time")
    return start.date() if isinstance(start, datetime) else None


__all__ = [
    "IST",
    "ValidationError",
    "build_fingerprint",
    "clean_web_text",
    "content_hash",
    "derive_status",
    "parse_datetime",
    "prepare_incident",
]
