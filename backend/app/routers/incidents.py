from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Incident
from app.services.filters import apply_incident_filters
from app.services.serialization import incident_to_dict

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _filtered_statement(**kwargs):
    statement = select(Incident)
    return apply_incident_filters(statement, **kwargs)


@router.get("")
def list_incidents(
    search: str | None = Query(default=None, max_length=160),
    category: str | None = Query(default=None, max_length=40),
    status: str | None = Query(default=None, pattern="^(active|upcoming|resolved|unknown)$"),
    location: str | None = Query(default=None, max_length=120),
    date_from: date | None = None,
    date_to: date | None = None,
    origin: str | None = Query(default=None, pattern="^(live|demo)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_db),
) -> dict:
    filters = dict(
        search=search,
        category=category,
        status=status,
        location=location,
        date_from=date_from,
        date_to=date_to,
        origin=origin,
    )
    count_statement = apply_incident_filters(
        select(func.count(Incident.id)), **filters
    )
    total = int(session.scalar(count_statement) or 0)
    statement = (
        _filtered_statement(**filters)
        .order_by(Incident.start_time.desc().nullslast(), Incident.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    records = session.scalars(statement).all()
    return {
        "items": [incident_to_dict(item) for item in records],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/map")
def map_incidents(
    search: str | None = Query(default=None, max_length=160),
    category: str | None = Query(default=None, max_length=40),
    status: str | None = Query(default=None, pattern="^(active|upcoming|resolved|unknown)$"),
    location: str | None = Query(default=None, max_length=120),
    date_from: date | None = None,
    date_to: date | None = None,
    origin: str | None = Query(default=None, pattern="^(live|demo)$"),
    limit: int = Query(default=600, ge=1, le=1200),
    session: Session = Depends(get_db),
) -> dict:
    filters = dict(
        search=search,
        category=category,
        status=status,
        location=location,
        date_from=date_from,
        date_to=date_to,
        origin=origin,
    )
    statement = (
        _filtered_statement(**filters)
        .where(Incident.latitude.is_not(None), Incident.longitude.is_not(None))
        .order_by(Incident.start_time.desc().nullslast())
        .limit(limit + 1)
    )
    records = session.scalars(statement).all()
    truncated = len(records) > limit
    records = records[:limit]
    total = int(
        session.scalar(
            apply_incident_filters(select(func.count(Incident.id)), **filters).where(
                Incident.latitude.is_not(None), Incident.longitude.is_not(None)
            )
        )
        or 0
    )
    return {
        "items": [incident_to_dict(item, include_description=False) for item in records],
        "total": total,
        "returned": len(records),
        "truncated": truncated,
        "note": (
            "Coordinates are approximate locality centroids or OpenStreetMap road-segment "
            "centres. They are not exact incident positions."
        ),
    }


@router.get("/{incident_id}")
def get_incident(incident_id: int, session: Session = Depends(get_db)) -> dict:
    incident = session.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    payload = incident_to_dict(incident)
    nearby = []
    if incident.location_name:
        nearby = session.scalars(
            select(Incident)
            .where(
                Incident.id != incident.id,
                Incident.location_name == incident.location_name,
            )
            .order_by(Incident.start_time.desc().nullslast())
            .limit(3)
        ).all()
    payload["related"] = [incident_to_dict(item, include_description=False) for item in nearby]
    return payload
