from __future__ import annotations

import hmac
from collections import defaultdict

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import CollectionLog, DataSource, Incident, WeatherObservation
from app.schemas import PipelineRunIn
from app.services.pipeline_runner import run_pipeline_job
from app.services.serialization import iso, log_to_dict

router = APIRouter(prefix="/api", tags=["sources"])


def require_admin(x_admin_token: str | None = Header(default=None, alias="X-Admin-Token")) -> None:
    if not settings.admin_token:
        raise HTTPException(
            status_code=503,
            detail="Admin refresh is disabled. Set ADMIN_TOKEN in the backend environment.",
        )
    if not x_admin_token or not hmac.compare_digest(
        x_admin_token.encode("utf-8"), settings.admin_token.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid or missing admin token.")


@router.get("/sources")
def list_sources(session: Session = Depends(get_db)) -> dict:
    sources = session.scalars(select(DataSource).order_by(DataSource.id)).all()
    incident_counts = dict(
        session.execute(
            select(Incident.source_id, func.count(Incident.id)).group_by(Incident.source_id)
        ).all()
    )
    weather_counts = dict(
        session.execute(
            select(WeatherObservation.source_id, func.count(WeatherObservation.id)).group_by(
                WeatherObservation.source_id
            )
        ).all()
    )
    logs = session.scalars(
        select(CollectionLog).order_by(CollectionLog.started_at.desc()).limit(200)
    ).all()
    latest_by_source: dict[int | None, CollectionLog] = {}
    success_by_source: dict[int | None, CollectionLog] = {}
    for log in logs:
        if log.source_id not in latest_by_source:
            latest_by_source[log.source_id] = log
        if log.source_id not in success_by_source and log.status in {"success", "partial"}:
            success_by_source[log.source_id] = log

    rows = []
    for source in sources:
        latest = latest_by_source.get(source.id)
        success = success_by_source.get(source.id)
        status = "idle"
        if latest is not None:
            status = "operational" if latest.status in {"success", "partial"} else latest.status
        rows.append(
            {
                "id": source.id,
                "slug": source.slug,
                "name": source.name,
                "source_type": source.source_type,
                "base_url": source.base_url,
                "description": source.description,
                "licence_note": source.licence_note,
                "is_active": source.is_active,
                "record_count": int(incident_counts.get(source.id, 0)),
                "weather_count": int(weather_counts.get(source.id, 0)),
                "status": status,
                "last_attempt_at": iso(latest.started_at) if latest else None,
                "last_success_at": iso(success.finished_at) if success else None,
                "latest_run": log_to_dict(latest) if latest else None,
                "last_success_run": log_to_dict(success) if success else None,
            }
        )

    all_logs = session.scalars(
        select(CollectionLog).order_by(CollectionLog.started_at.desc()).limit(15)
    ).all()
    rejected = sum(log.rejected for log in all_logs)
    duplicates = sum(log.duplicates for log in all_logs)
    total = int(session.scalar(select(func.count(Incident.id))) or 0)
    live = int(session.scalar(select(func.count(Incident.id)).where(Incident.origin == "live")) or 0)

    return {
        "sources": rows,
        "summary": {
            "total_records": total,
            "live_records": live,
            "demo_records": total - live,
            "recent_rejected": rejected,
            "recent_duplicates": duplicates,
            "last_run_at": iso(all_logs[0].finished_at or all_logs[0].started_at)
            if all_logs
            else None,
            "runs_considered": len(all_logs),
        },
    }


@router.get("/pipeline/logs")
def pipeline_logs(
    limit: int = Query(default=25, ge=1, le=100),
    session: Session = Depends(get_db),
) -> dict:
    logs = session.scalars(
        select(CollectionLog).order_by(CollectionLog.started_at.desc()).limit(limit)
    ).all()
    by_status: dict[str, int] = defaultdict(int)
    for log in logs:
        by_status[log.status] += 1
    return {
        "items": [log_to_dict(log) for log in logs],
        "status_counts": dict(by_status),
    }


@router.post("/pipeline/run", status_code=202)
def trigger_pipeline(
    payload: PipelineRunIn,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_admin),
) -> dict:
    keys = payload.sources or ["all"]
    background_tasks.add_task(run_pipeline_job, keys, "admin")
    return {
        "status": "accepted",
        "sources": keys,
        "message": "Collection started. Refresh the run log in a few seconds for results.",
    }
