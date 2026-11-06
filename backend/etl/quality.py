"""Data-quality reporting for the loaded warehouse using pandas.

This report is intentionally read-only and independent of the API. It is used
from the CLI to document missing fields, origin split and coverage.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Incident, WeatherObservation


def _iso(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def build_quality_report(session: Session) -> dict:
    rows = session.execute(
        select(
            Incident.category,
            Incident.status,
            Incident.origin,
            Incident.location_name,
            Incident.latitude,
            Incident.longitude,
            Incident.start_time,
            Incident.published_at,
        )
    ).all()
    columns = [
        "category",
        "status",
        "origin",
        "location_name",
        "latitude",
        "longitude",
        "start_time",
        "published_at",
    ]
    frame = pd.DataFrame(rows, columns=columns)

    if frame.empty:
        return {
            "total_incidents": 0,
            "by_category": {},
            "by_status": {},
            "by_origin": {},
            "missing": {
                "location_name": 0,
                "coordinates": 0,
                "start_time": 0,
            },
            "date_range": {"earliest": None, "latest": None},
            "weather_rows": int(
                session.scalar(select(func.count(WeatherObservation.id))) or 0
            ),
            "coordinate_coverage_pct": 0.0,
        }

    coordinate_missing = frame["latitude"].isna() | frame["longitude"].isna()
    total = int(len(frame))
    return {
        "total_incidents": total,
        "by_category": {
            str(key): int(value) for key, value in frame["category"].value_counts().items()
        },
        "by_status": {
            str(key): int(value) for key, value in frame["status"].value_counts().items()
        },
        "by_origin": {
            str(key): int(value) for key, value in frame["origin"].value_counts().items()
        },
        "missing": {
            "location_name": int(frame["location_name"].isna().sum()),
            "coordinates": int(coordinate_missing.sum()),
            "start_time": int(frame["start_time"].isna().sum()),
        },
        "date_range": {
            "earliest": _iso(frame["start_time"].min()),
            "latest": _iso(frame["start_time"].max()),
        },
        "weather_rows": int(session.scalar(select(func.count(WeatherObservation.id))) or 0),
        "coordinate_coverage_pct": round(100 * (1 - coordinate_missing.mean()), 1),
    }
