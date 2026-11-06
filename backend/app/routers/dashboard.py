from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.stats import build_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard_overview(
    days: int = Query(default=30, ge=7, le=365),
    session: Session = Depends(get_db),
) -> dict:
    return build_dashboard(session, days=days)
