from sqlalchemy import delete

from app.models import Incident
from app.services.stats import build_analytics, build_dashboard


def test_dashboard_and_analytics_handle_empty_records(db_session):
    db_session.execute(delete(Incident))
    db_session.flush()

    dashboard = build_dashboard(db_session)
    assert dashboard["stats"]["total_incidents"] == 0
    assert dashboard["stats"]["active_disruptions"] == 0
    assert dashboard["dataset"]["total"] == 0
    assert len(dashboard["timeline"]) == 30
    assert all(item["count"] == 0 for item in dashboard["timeline"])
    assert all(category["count"] == 0 for category in dashboard["categories"])
    assert dashboard["recent_updates"] == []
    assert dashboard["announcements"] == []

    analytics = build_analytics(db_session, days=30)
    assert analytics["totals"]["incidents"] == 0
    assert analytics["totals"]["peak_day"] is None
    assert analytics["frequency"]["available"] is False
    assert analytics["weather"]["insufficient_data"] is True
    assert analytics["weather"]["correlation"] is None

    # The fixture closes the session without committing, restoring shared test data.
    db_session.rollback()
