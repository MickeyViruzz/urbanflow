from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.stats import build_analytics

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/traffic")
def traffic_analytics(
    days: int = Query(default=90, ge=7, le=365),
    session: Session = Depends(get_db),
) -> dict:
    return build_analytics(session, days=days)
