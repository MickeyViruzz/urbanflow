from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AnalyticsEventIn
from app.services.web_analytics import build_website_analytics, record_event

router = APIRouter(prefix="/api/analytics", tags=["website analytics"])


@router.post("/events", status_code=201)
def create_event(payload: AnalyticsEventIn, session: Session = Depends(get_db)) -> dict:
    record_event(
        session,
        event_type=payload.event_type,
        page_path=payload.page_path,
        metadata=payload.metadata,
        session_id=payload.session_id,
    )
    return {"status": "recorded"}


@router.get("/website")
def website_analytics(
    days: int = Query(default=30, ge=1, le=365),
    session: Session = Depends(get_db),
) -> dict:
    return build_website_analytics(session, days=days)
