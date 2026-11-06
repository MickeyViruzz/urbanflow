from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy import Select, or_

from app.models import Incident
from etl.gazetteer import IST


def _start_of_day(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=IST)


def _end_of_day(value: date) -> datetime:
    return datetime.combine(value, time.max, tzinfo=IST)


def apply_incident_filters(
    statement: Select,
    category: str | None = None,
    status: str | None = None,
    location: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    origin: str | None = None,
) -> Select:
    if category:
        statement = statement.where(Incident.category == category)
    if status:
        statement = statement.where(Incident.status == status)
    if location:
        statement = statement.where(Incident.location_name.ilike(f"%{location.strip()}%"))
    if origin in {"live", "demo"}:
        statement = statement.where(Incident.origin == origin)
    if search:
        term = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Incident.title.ilike(term),
                Incident.description.ilike(term),
                Incident.location_name.ilike(term),
            )
        )
    if date_from:
        statement = statement.where(Incident.start_time >= _start_of_day(date_from))
    if date_to:
        statement = statement.where(Incident.start_time <= _end_of_day(date_to))
    return statement
