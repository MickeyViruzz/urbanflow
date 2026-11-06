from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CATEGORIES, STATUSES, Incident
from app.services.serialization import iso

router = APIRouter(prefix="/api/meta", tags=["metadata"])


@router.get("")
def metadata(session: Session = Depends(get_db)) -> dict:
    location_rows = session.execute(
        select(
            Incident.location_name,
            func.count(Incident.id),
            func.count(Incident.id).filter(Incident.status == "active"),
        )
        .where(Incident.location_name.is_not(None))
        .group_by(Incident.location_name)
        .order_by(func.count(Incident.id).desc())
        .limit(80)
    ).all()
    total = int(session.scalar(select(func.count(Incident.id))) or 0)
    live = int(
        session.scalar(select(func.count(Incident.id)).where(Incident.origin == "live")) or 0
    )
    last_update = session.scalar(select(func.max(Incident.updated_at)))
    return {
        "categories": CATEGORIES,
        "statuses": STATUSES,
        "locations": [
            {"name": row[0], "count": int(row[1]), "active": int(row[2])} for row in location_rows
        ],
        "suggested_locations": [row[0] for row in location_rows[:10]],
        "dataset": {
            "total": total,
            "live": live,
            "demo": total - live,
            "demo_mode": total - live > 0,
            "last_updated": iso(last_update),
        },
        "coverage": {
            "region": "Mumbai, Maharashtra, India",
            "approximate_bounds": {
                "north": 19.40,
                "south": 18.85,
                "west": 72.70,
                "east": 73.25,
            },
        },
        "attribution": "© OpenStreetMap contributors (ODbL). Weather data by Open-Meteo (CC BY 4.0).",
    }
