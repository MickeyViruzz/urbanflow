from __future__ import annotations

from datetime import datetime

from app.models import CollectionLog, Incident, WeatherObservation


def iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def incident_to_dict(incident: Incident, include_description: bool = True) -> dict:
    source = incident.source
    payload = {
        "id": incident.id,
        "external_id": incident.external_id,
        "title": incident.title,
        "category": incident.category,
        "status": incident.status,
        "severity": incident.severity,
        "summary": incident.summary,
        "location_name": incident.location_name,
        "latitude": incident.latitude,
        "longitude": incident.longitude,
        "location_precision": incident.location_precision,
        "start_time": iso(incident.start_time),
        "end_time": iso(incident.end_time),
        "published_at": iso(incident.published_at),
        "last_updated_at": iso(incident.last_updated_at),
        "source_name": source.name if source else None,
        "source_slug": source.slug if source else None,
        "source_type": source.source_type if source else None,
        "source_url": incident.source_url,
        "origin": incident.origin,
        "classification": (
            incident.raw_payload.get("_classification")
            if isinstance(incident.raw_payload, dict)
            else None
        ),
    }
    if include_description:
        payload["description"] = incident.description
    return payload


def weather_to_dict(observation: WeatherObservation) -> dict:
    return {
        "id": observation.id,
        "date": observation.observed_at.date().isoformat(),
        "observed_at": iso(observation.observed_at),
        "kind": observation.kind,
        "temperature_c": observation.temperature_c,
        "precipitation_mm": observation.precipitation_mm,
        "precipitation_probability": observation.precipitation_probability,
        "wind_speed_kmh": observation.wind_speed_kmh,
        "weather_code": observation.weather_code,
        "condition": observation.condition,
        "origin": observation.origin,
        "source_name": observation.source.name if observation.source else None,
    }


def log_to_dict(log: CollectionLog) -> dict:
    duration = None
    if log.started_at and log.finished_at:
        duration = round((log.finished_at - log.started_at).total_seconds(), 1)
    return {
        "id": log.id,
        "pipeline": log.pipeline,
        "source_id": log.source_id,
        "source_name": log.source.name if log.source else None,
        "triggered_by": log.triggered_by,
        "started_at": iso(log.started_at),
        "finished_at": iso(log.finished_at),
        "duration_seconds": duration,
        "status": log.status,
        "records_fetched": log.records_fetched,
        "records_inserted": log.records_inserted,
        "records_updated": log.records_updated,
        "duplicates": log.duplicates,
        "rejected": log.rejected,
        "message": log.message,
    }
