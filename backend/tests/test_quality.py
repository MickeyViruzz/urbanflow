from etl.quality import build_quality_report


def test_quality_report_uses_loaded_records(db_session):
    report = build_quality_report(db_session)
    assert report["total_incidents"] >= 4
    assert report["by_category"]["Accident"] >= 1
    assert report["by_origin"]["live"] >= 1
    assert report["weather_rows"] >= 2
    assert 0 <= report["coordinate_coverage_pct"] <= 100
    assert report["missing"]["coordinates"] >= 0
    assert report["date_range"]["earliest"] is not None
