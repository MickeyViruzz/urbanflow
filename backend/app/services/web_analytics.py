from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AnalyticsEvent, Incident
from etl.gazetteer import IST

ALLOWED_EVENT_TYPES = {
    "page_view",
    "search",
    "map_interaction",
    "incident_view",
    "route_check",
    "filter_apply",
    "feature_use",
}

FEATURE_LABELS = {
    "page_view": "Page views",
    "search": "Searches",
    "map_interaction": "Map interactions",
    "incident_view": "Incident detail views",
    "route_check": "Route checks",
    "filter_apply": "Filter applications",
    "feature_use": "Other feature usage",
}

MAX_METADATA_KEYS = 10


def hash_session(session_id: str | None) -> str | None:
    if not session_id:
        return None
    return hashlib.sha256(f"urbanflow-analytics:{session_id}".encode("utf-8")).hexdigest()[:32]


def sanitize_metadata(metadata: dict | None) -> dict:
    if not metadata:
        return {}
    cleaned: dict = {}
    for key, value in list(metadata.items())[:MAX_METADATA_KEYS]:
        if not isinstance(key, str) or len(key) > 40:
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            if isinstance(value, str):
                cleaned[key] = value[:240]
            else:
                cleaned[key] = value
    return cleaned


def record_event(session: Session, event_type: str, page_path: str | None, metadata: dict, session_id: str | None) -> AnalyticsEvent:
    event = AnalyticsEvent(
        event_type=event_type,
        page_path=(page_path or None),
        session_hash=hash_session(session_id),
        event_metadata=sanitize_metadata(metadata),
    )
    session.add(event)
    session.commit()
    return event


def build_website_analytics(session: Session, days: int = 30) -> dict:
    now = datetime.now(tz=IST)
    start = now - timedelta(days=days)
    events = session.scalars(
        select(AnalyticsEvent).where(AnalyticsEvent.created_at >= start)
    ).all()

    sessions = {event.session_hash for event in events if event.session_hash}
    page_views = [event for event in events if event.event_type == "page_view"]
    searches = [event for event in events if event.event_type == "search"]
    incident_views = [event for event in events if event.event_type == "incident_view"]
    route_checks = [event for event in events if event.event_type == "route_check"]
    map_interactions = [event for event in events if event.event_type == "map_interaction"]

    top_pages = Counter(event.page_path for event in page_views if event.page_path)
    search_terms = Counter(
        str((event.event_metadata or {}).get("query", "")).strip().lower()
        for event in searches
        if (event.event_metadata or {}).get("query")
    )
    incident_counts: Counter[int] = Counter()
    for event in incident_views:
        incident_id = (event.event_metadata or {}).get("incident_id")
        try:
            incident_counts[int(incident_id)] += 1
        except (TypeError, ValueError):
            continue

    incident_titles: dict[int, dict] = {}
    if incident_counts:
        incidents = session.scalars(
            select(Incident).where(Incident.id.in_(incident_counts.keys()))
        ).all()
        incident_titles = {
            incident.id: {
                "id": incident.id,
                "title": incident.title,
                "category": incident.category,
                "location_name": incident.location_name,
            }
            for incident in incidents
        }
    top_incidents = [
        {**incident_titles.get(incident_id, {"id": incident_id, "title": "Removed incident"}), "views": count}
        for incident_id, count in incident_counts.most_common(8)
    ]

    timeline_map: dict[str, dict] = defaultdict(lambda: {"page_views": 0, "sessions": set()})
    for event in events:
        day = event.created_at.astimezone(IST).date().isoformat()
        if event.event_type == "page_view":
            timeline_map[day]["page_views"] += 1
        if event.session_hash:
            timeline_map[day]["sessions"].add(event.session_hash)
    timeline = []
    for offset in range(days):
        day = (now.date() - timedelta(days=days - 1 - offset)).isoformat()
        entry = timeline_map.get(day, {"page_views": 0, "sessions": set()})
        timeline.append(
            {
                "date": day,
                "page_views": entry["page_views"],
                "visits": len(entry["sessions"]),
            }
        )

    feature_usage = [
        {"feature": FEATURE_LABELS.get(event_type, event_type), "event_type": event_type, "count": count}
        for event_type, count in Counter(event.event_type for event in events).most_common()
    ]

    return {
        "generated_at": now.isoformat(),
        "range_days": days,
        "totals": {
            "visits": len(sessions),
            "page_views": len(page_views),
            "searches": len(searches),
            "incident_views": len(incident_views),
            "route_checks": len(route_checks),
            "map_interactions": len(map_interactions),
            "events": len(events),
        },
        "top_pages": [
            {"path": path, "views": count} for path, count in top_pages.most_common(10)
        ],
        "top_searches": [
            {"query": query, "count": count} for query, count in search_terms.most_common(10)
        ],
        "top_incidents": top_incidents,
        "feature_usage": feature_usage,
        "timeline": timeline,
        "available": bool(events),
        "privacy_note": (
            "First-party analytics only. No IP address, user agent, cookie or account identifier "
            "is stored; sessions are represented by a salted one-way hash generated in the browser."
        ),
    }
