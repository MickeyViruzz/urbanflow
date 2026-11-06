from datetime import datetime, timedelta

from sqlalchemy import delete

from app.database import SessionLocal
from app.models import DataSource, Incident
from etl.gazetteer import IST
from etl.loader import load_incidents
from etl.pipeline import refresh_statuses


def test_status_refresh_preserves_unknown_but_updates_time_based_records():
    now = datetime.now(tz=IST)
    with SessionLocal() as session:
        source = DataSource(
            slug="test-status-refresh",
            name="Status refresh test source",
            source_type="API",
        )
        session.add(source)
        session.commit()
        try:
            load_incidents(
                session,
                [
                    {
                        "external_id": "unknown-record",
                        "title": "Mapped construction with unknown status",
                        "description": "A mapped construction record without confirmed dates.",
                        "category": "Construction",
                        "status": "unknown",
                        "location_name": "Bandra West",
                        "latitude": 19.0596,
                        "longitude": 72.8295,
                        "start_time": now - timedelta(days=400),
                    },
                    {
                        "external_id": "active-record",
                        "title": "Active road closure test record",
                        "description": "A time-window record that should update when it expires.",
                        "category": "Road Closure",
                        "status": "active",
                        "location_name": "Kurla",
                        "latitude": 19.0726,
                        "longitude": 72.8845,
                        "start_time": now - timedelta(hours=4),
                        "end_time": now - timedelta(hours=1),
                    },
                ],
                source,
                origin="live",
                now=now,
            )
            session.commit()

            refresh_statuses(session, now=now)

            records = session.query(Incident).filter(Incident.source_id == source.id).all()
            by_external = {record.external_id: record for record in records}
            assert by_external["unknown-record"].status == "unknown"
            assert by_external["active-record"].status == "resolved"
        finally:
            session.execute(delete(Incident).where(Incident.source_id == source.id))
            session.delete(source)
            session.commit()
