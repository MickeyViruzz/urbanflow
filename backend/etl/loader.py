from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Incident, WeatherObservation
from etl.normalize import ValidationError, prepare_incident
from etl.gazetteer import IST


@dataclass
class LoadStats:
    fetched: int = 0
    inserted: int = 0
    updated: int = 0
    duplicates: int = 0
    rejected: int = 0
    errors: list[str] = field(default_factory=list)

    @property
    def status(self) -> str:
        if self.fetched == 0:
            return "success"
        if self.rejected and not (self.inserted or self.updated or self.duplicates):
            return "failed"
        if self.rejected:
            return "partial"
        return "success"

    def message(self) -> str:
        bits = [
            f"fetched={self.fetched}",
            f"inserted={self.inserted}",
            f"updated={self.updated}",
            f"duplicates={self.duplicates}",
            f"rejected={self.rejected}",
        ]
        if self.errors:
            bits.append("errors: " + "; ".join(self.errors[:3]))
        return " | ".join(bits)


INCIDENT_FIELDS = (
    "external_id",
    "title",
    "category",
    "status",
    "severity",
    "description",
    "summary",
    "location_name",
    "latitude",
    "longitude",
    "location_precision",
    "start_time",
    "end_time",
    "published_at",
    "last_updated_at",
    "source_url",
    "origin",
    "raw_payload",
    "fingerprint",
    "content_hash",
)


def load_incidents(
    session: Session,
    raw_records: list[dict],
    source,
    origin: str = "live",
    now: datetime | None = None,
) -> LoadStats:
    stats = LoadStats(fetched=len(raw_records))
    existing = session.scalars(
        select(Incident).where(Incident.source_id == source.id)
    ).all()
    by_fingerprint = {record.fingerprint: record for record in existing}
    by_external = {record.external_id: record for record in existing if record.external_id}
    batch_fingerprints: set[str] = set()

    for raw in raw_records:
        try:
            prepared = prepare_incident(raw, source.slug, origin=origin, now=now)
        except ValidationError as error:
            stats.rejected += 1
            stats.errors.append(str(error))
            continue

        # Keep the transparent classification provenance alongside the source
        # payload. It is exposed by the incident detail endpoint.
        provenance_payload = dict(prepared.get("raw_payload") or {})
        provenance_payload["_classification"] = prepared.get("classification")
        prepared["raw_payload"] = provenance_payload

        fingerprint = prepared["fingerprint"]
        if fingerprint in batch_fingerprints:
            stats.duplicates += 1
            continue
        batch_fingerprints.add(fingerprint)

        record = by_fingerprint.get(fingerprint)
        if record is None and prepared.get("external_id"):
            record = by_external.get(prepared["external_id"])

        if record is None:
            record = Incident(source_id=source.id, **{key: prepared[key] for key in INCIDENT_FIELDS})
            session.add(record)
            session.flush()
            by_fingerprint[fingerprint] = record
            if record.external_id:
                by_external[record.external_id] = record
            stats.inserted += 1
            continue

        if record.content_hash == prepared["content_hash"]:
            if not isinstance(record.raw_payload, dict) or "_classification" not in record.raw_payload:
                merged_payload = dict(record.raw_payload or {})
                merged_payload["_classification"] = prepared.get("classification")
                record.raw_payload = merged_payload
            stats.duplicates += 1
            continue

        for key in INCIDENT_FIELDS:
            if key in {"external_id", "fingerprint"}:
                continue
            setattr(record, key, prepared[key])
        record.updated_at = datetime.now(tz=IST)
        stats.updated += 1

    return stats


def load_weather(
    session: Session, raw_records: list[dict], source, origin: str = "live"
) -> LoadStats:
    stats = LoadStats(fetched=len(raw_records))
    existing = session.scalars(
        select(WeatherObservation).where(WeatherObservation.source_id == source.id)
    ).all()
    by_time = {record.observed_at: record for record in existing}
    seen: set[datetime] = set()

    for raw in raw_records:
        observed_at = raw.get("observed_at")
        if not isinstance(observed_at, datetime):
            stats.rejected += 1
            stats.errors.append("weather observation missing timestamp")
            continue
        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=IST)
        if observed_at in seen:
            stats.duplicates += 1
            continue
        seen.add(observed_at)

        values = {
            "kind": raw.get("kind", "observed"),
            "temperature_c": raw.get("temperature_c"),
            "precipitation_mm": raw.get("precipitation_mm"),
            "precipitation_probability": raw.get("precipitation_probability"),
            "wind_speed_kmh": raw.get("wind_speed_kmh"),
            "weather_code": raw.get("weather_code"),
            "condition": raw.get("condition"),
            "origin": origin,
        }
        record = by_time.get(observed_at)
        if record is None:
            record = WeatherObservation(
                observed_at=observed_at, source_id=source.id, **values
            )
            session.add(record)
            stats.inserted += 1
            continue
        changed = any(getattr(record, key) != value for key, value in values.items())
        if not changed:
            stats.duplicates += 1
            continue
        for key, value in values.items():
            setattr(record, key, value)
        stats.updated += 1

    return stats
