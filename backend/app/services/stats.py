from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CATEGORIES, CollectionLog, Incident, WeatherObservation
from app.services.serialization import incident_to_dict, iso, log_to_dict, weather_to_dict
from etl.gazetteer import IST


def _now() -> datetime:
    return datetime.now(tz=IST)


def _count(session: Session, *conditions) -> int:
    statement = select(func.count(Incident.id))
    for condition in conditions:
        statement = statement.where(condition)
    return int(session.scalar(statement) or 0)


def latest_weather_by_date(
    session: Session, start: date | None = None, end: date | None = None
) -> dict[date, WeatherObservation]:
    statement = select(WeatherObservation).order_by(WeatherObservation.observed_at)
    if start:
        statement = statement.where(WeatherObservation.observed_at >= datetime.combine(start, datetime.min.time(), tzinfo=IST))
    if end:
        statement = statement.where(WeatherObservation.observed_at <= datetime.combine(end, datetime.max.time(), tzinfo=IST))
    records = session.scalars(statement).all()
    combined: dict[date, WeatherObservation] = {}
    for record in records:
        day = record.observed_at.astimezone(IST).date()
        current = combined.get(day)
        if current is None or (record.origin == "live" and current.origin == "demo"):
            combined[day] = record
    return combined


def weather_alerts(session: Session, limit: int = 6) -> list[dict]:
    today = _now().date()
    observations = latest_weather_by_date(session, start=today, end=today + timedelta(days=5))
    alerts = []
    for day, record in sorted(observations.items()):
        if record.kind != "forecast":
            continue
        probability = record.precipitation_probability or 0
        precipitation = record.precipitation_mm or 0
        if probability >= 60 or precipitation >= 10:
            level = "high" if probability >= 80 or precipitation >= 20 else "moderate"
            alerts.append(
                {
                    "date": day.isoformat(),
                    "condition": record.condition,
                    "precipitation_mm": precipitation,
                    "probability": probability,
                    "alert_level": level,
                    "origin": record.origin,
                    "source_name": record.source.name if record.source else None,
                }
            )
    return alerts[:limit]


def _last_collection(session: Session) -> dict | None:
    log = session.scalars(
        select(CollectionLog)
        .where(CollectionLog.status.in_(["success", "partial"]))
        .order_by(CollectionLog.finished_at.desc())
        .limit(1)
    ).first()
    return log_to_dict(log) if log else None


def build_dashboard(session: Session, days: int = 30) -> dict:
    now = _now()
    today = now.date()
    range_start = today - timedelta(days=days - 1)

    total = _count(session)
    live = _count(session, Incident.origin == "live")
    demo = _count(session, Incident.origin == "demo")
    active = _count(session, Incident.status == "active")
    upcoming = _count(session, Incident.status == "upcoming")
    resolved = _count(session, Incident.status == "resolved")
    closures = _count(
        session, Incident.status == "active", Incident.category == "Road Closure"
    )
    construction_active = _count(
        session, Incident.status == "active", Incident.category == "Construction"
    )
    construction_mapped = _count(
        session, Incident.status == "unknown", Incident.category == "Construction"
    )
    construction = construction_active + construction_mapped
    active_live = _count(session, Incident.status == "active", Incident.origin == "live")
    active_demo = _count(session, Incident.status == "active", Incident.origin == "demo")
    closures_live = _count(
        session,
        Incident.status == "active",
        Incident.category == "Road Closure",
        Incident.origin == "live",
    )
    closures_demo = _count(
        session,
        Incident.status == "active",
        Incident.category == "Road Closure",
        Incident.origin == "demo",
    )
    construction_live = _count(
        session,
        Incident.category == "Construction",
        Incident.origin == "live",
        Incident.status.in_(["active", "unknown"]),
    )
    construction_demo = _count(
        session,
        Incident.category == "Construction",
        Incident.origin == "demo",
        Incident.status.in_(["active", "unknown"]),
    )
    last_week = _count(
        session,
        Incident.start_time >= now - timedelta(days=7),
        Incident.start_time <= now,
    )
    alerts = weather_alerts(session)
    outlook_records = latest_weather_by_date(session, start=today, end=today + timedelta(days=5))
    weather_outlook = [
        {
            "date": day.isoformat(),
            "kind": record.kind,
            "condition": record.condition,
            "temperature_c": record.temperature_c,
            "precipitation_mm": record.precipitation_mm or 0.0,
            "probability": record.precipitation_probability,
            "origin": record.origin,
            "source_name": record.source.name if record.source else None,
        }
        for day, record in sorted(outlook_records.items())
    ]

    start_times = session.scalars(
        select(Incident.start_time).where(
            Incident.start_time >= datetime.combine(range_start, datetime.min.time(), tzinfo=IST),
            Incident.start_time <= now,
        )
    ).all()
    daily = Counter(
        value.astimezone(IST).date() for value in start_times if value is not None
    )
    timeline = [
        {"date": (range_start + timedelta(days=offset)).isoformat(), "count": daily.get(range_start + timedelta(days=offset), 0)}
        for offset in range(days)
    ]

    category_rows = session.execute(
        select(
            Incident.category,
            func.count(Incident.id),
            func.count(Incident.id).filter(Incident.status == "active"),
        )
        .group_by(Incident.category)
    ).all()
    category_counts = {row[0]: {"count": int(row[1]), "active": int(row[2])} for row in category_rows}
    categories = [
        {
            "category": category,
            "count": category_counts.get(category, {}).get("count", 0),
            "active": category_counts.get(category, {}).get("active", 0),
        }
        for category in CATEGORIES
    ]
    categories.sort(key=lambda item: item["count"], reverse=True)

    location_rows = session.execute(
        select(
            Incident.location_name,
            func.count(Incident.id),
            func.count(Incident.id).filter(Incident.status == "active"),
        )
        .where(Incident.location_name.is_not(None))
        .group_by(Incident.location_name)
        .order_by(func.count(Incident.id).desc())
        .limit(7)
    ).all()
    locations = [
        {"location": row[0], "count": int(row[1]), "active": int(row[2])}
        for row in location_rows
    ]

    recent_updates = session.scalars(
        select(Incident).order_by(Incident.last_updated_at.desc().nullslast()).limit(6)
    ).all()
    announcements = session.scalars(
        select(Incident)
        .where(Incident.status.in_(["active", "upcoming"]))
        .order_by(Incident.published_at.desc().nullslast())
        .limit(5)
    ).all()
    active_locations = session.scalar(
        select(func.count(func.distinct(Incident.location_name))).where(
            Incident.status == "active", Incident.location_name.is_not(None)
        )
    )

    return {
        "generated_at": now.isoformat(),
        "range_days": days,
        "dataset": {
            "total": total,
            "live": live,
            "demo": demo,
            "demo_mode": demo > 0,
            "last_data_update": iso(
                session.scalar(select(func.max(Incident.updated_at)))
            ),
            "last_collection": _last_collection(session),
        },
        "stats": {
            "total_incidents": total,
            "active_disruptions": active,
            "upcoming_disruptions": upcoming,
            "resolved_incidents": resolved,
            "road_closures": closures,
            "construction_notices": construction,
            "construction_active": construction_active,
            "construction_mapped": construction_mapped,
            "active_live": active_live,
            "active_demo": active_demo,
            "road_closures_live": closures_live,
            "road_closures_demo": closures_demo,
            "construction_live": construction_live,
            "construction_demo": construction_demo,
            "weather_alerts": len(alerts),
            "incidents_last_7_days": last_week,
            "active_locations": int(active_locations or 0),
        },
        "weather_alerts": alerts,
        "weather_outlook": weather_outlook,
        "timeline": timeline,
        "categories": categories,
        "locations": locations,
        "recent_updates": [incident_to_dict(item) for item in recent_updates],
        "announcements": [incident_to_dict(item) for item in announcements],
    }


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3 or len(xs) != len(ys):
        return None
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator = (
        sum((x - mean_x) ** 2 for x in xs) ** 0.5
        * sum((y - mean_y) ** 2 for y in ys) ** 0.5
    )
    if denominator == 0:
        return None
    return round(numerator / denominator, 3)


def build_analytics(session: Session, days: int = 90) -> dict:
    now = _now()
    today = now.date()
    start = today - timedelta(days=days - 1)
    range_start = datetime.combine(start, datetime.min.time(), tzinfo=IST)

    incidents = session.scalars(
        select(Incident).where(
            Incident.start_time >= range_start,
            Incident.start_time <= now,
        )
    ).all()

    daily_counts: Counter[date] = Counter()
    for incident in incidents:
        if incident.start_time:
            daily_counts[incident.start_time.astimezone(IST).date()] += 1

    frequency = [
        {"date": (start + timedelta(days=offset)).isoformat(), "count": daily_counts.get(start + timedelta(days=offset), 0)}
        for offset in range(days)
    ]

    weekly_counts: Counter[date] = Counter()
    weekly_status: dict[date, Counter] = defaultdict(Counter)
    for incident in incidents:
        if not incident.start_time:
            continue
        day = incident.start_time.astimezone(IST).date()
        week_start = day - timedelta(days=day.weekday())
        weekly_counts[week_start] += 1
        weekly_status[week_start][incident.status] += 1
    week_cursor = start - timedelta(days=start.weekday())
    weekly = []
    while week_cursor <= today:
        weekly.append(
            {
                "week_start": week_cursor.isoformat(),
                "label": week_cursor.strftime("%d %b"),
                "count": weekly_counts.get(week_cursor, 0),
            }
        )
        week_cursor += timedelta(days=7)

    monthly_counter: Counter[str] = Counter()
    for day, count in daily_counts.items():
        monthly_counter[day.strftime("%Y-%m")] += count
    month_cursor = start.replace(day=1)
    months = []
    while month_cursor <= today:
        key = month_cursor.strftime("%Y-%m")
        months.append(
            {
                "month": key,
                "label": month_cursor.strftime("%b %Y"),
                "count": monthly_counter.get(key, 0),
            }
        )
        month_cursor = (month_cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

    categories_counter = Counter(incident.category for incident in incidents)
    categories = [
        {
            "category": category,
            "count": categories_counter.get(category, 0),
            "share": round(100 * categories_counter.get(category, 0) / len(incidents), 1)
            if incidents
            else 0.0,
        }
        for category in CATEGORIES
    ]
    categories.sort(key=lambda item: item["count"], reverse=True)

    locations_counter = Counter(
        incident.location_name for incident in incidents if incident.location_name
    )
    locations = [
        {"location": location, "count": count}
        for location, count in locations_counter.most_common(9)
    ]

    weekly_trend = []
    for week_start in [start + timedelta(days=offset) for offset in range(0, days, 7)]:
        normalized = week_start - timedelta(days=week_start.weekday())
        statuses = weekly_status.get(normalized, Counter())
        weekly_trend.append(
            {
                "week_start": normalized.isoformat(),
                "label": normalized.strftime("%d %b"),
                "active": statuses.get("active", 0),
                "resolved": statuses.get("resolved", 0),
                "upcoming": statuses.get("upcoming", 0),
                "unknown": statuses.get("unknown", 0),
                "total": sum(statuses.values()),
            }
        )
    deduped_trend: list[dict] = []
    seen_weeks: set[str] = set()
    for entry in weekly_trend:
        if entry["week_start"] in seen_weeks:
            continue
        seen_weeks.add(entry["week_start"])
        deduped_trend.append(entry)

    weather_by_day = latest_weather_by_date(session, start=start, end=today)
    weather_series = []
    for day in sorted(weather_by_day):
        record = weather_by_day[day]
        if record.kind != "observed":
            continue
        weather_series.append(
            {
                "date": day.isoformat(),
                "incidents": daily_counts.get(day, 0),
                "precipitation_mm": record.precipitation_mm or 0.0,
                "temperature_c": record.temperature_c,
                "condition": record.condition,
                "origin": record.origin,
            }
        )

    matched = [item for item in weather_series if item["precipitation_mm"] is not None]
    correlation = None
    rainy_avg = dry_avg = None
    rainy_days = sum(1 for item in matched if (item["precipitation_mm"] or 0) >= 5)
    dry_days = len(matched) - rainy_days
    if rainy_days and dry_days:
        rainy_avg = round(
            sum(item["incidents"] for item in matched if (item["precipitation_mm"] or 0) >= 5)
            / rainy_days,
            2,
        )
        dry_avg = round(
            sum(item["incidents"] for item in matched if (item["precipitation_mm"] or 0) < 5)
            / dry_days,
            2,
        )
    if len(matched) >= 10 and len(incidents) >= 5:
        correlation = _pearson(
            [float(item["precipitation_mm"] or 0) for item in matched],
            [float(item["incidents"]) for item in matched],
        )

    totals = {
        "incidents": len(incidents),
        "live": sum(1 for incident in incidents if incident.origin == "live"),
        "demo": sum(1 for incident in incidents if incident.origin == "demo"),
        "avg_per_week": round(len(incidents) / (days / 7), 1) if days else 0,
        "peak_day": (
            max(frequency, key=lambda item: item["count"])
            if any(item["count"] > 0 for item in frequency)
            else None
        ),
        "resolved_share": round(
            100 * sum(1 for incident in incidents if incident.status == "resolved") / len(incidents),
            1,
        )
        if incidents
        else 0.0,
        "most_affected_location": locations[0]["location"] if locations else None,
    }

    return {
        "generated_at": now.isoformat(),
        "range_days": days,
        "window": {"from": start.isoformat(), "to": today.isoformat()},
        "totals": totals,
        "frequency": {
            "available": bool(incidents),
            "series": frequency,
        },
        "weekly": {
            "available": bool(incidents),
            "series": weekly,
        },
        "monthly": {
            "available": bool(incidents),
            "series": months,
        },
        "categories": {
            "available": bool(incidents),
            "series": categories,
        },
        "locations": {
            "available": bool(locations),
            "series": locations,
        },
        "status_trend": {
            "available": bool(incidents),
            "series": deduped_trend,
        },
        "weather": {
            "available": bool(weather_series),
            "insufficient_data": len(matched) < 10 or len(incidents) < 5,
            "matched_days": len(matched),
            "correlation": correlation,
            "rainy_days": rainy_days,
            "dry_days": dry_days,
            "avg_incidents_rainy": rainy_avg,
            "avg_incidents_dry": dry_avg,
            "series": weather_series,
            "note": (
                "Correlation describes association in the collected dataset, not causation. "
                "Forecast days are excluded."
            ),
        },
        "weather_snapshot": [weather_to_dict(record) for record in list(weather_by_day.values())[-7:]],
    }
