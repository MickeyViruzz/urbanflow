from datetime import datetime

from etl.extractors.weather import merge_weather_records
from etl.gazetteer import IST


def _record(day: int, kind: str, precipitation: float) -> dict:
    return {
        "observed_at": datetime(2026, 11, day, 12, tzinfo=IST),
        "kind": kind,
        "temperature_c": 29.0,
        "precipitation_mm": precipitation,
        "precipitation_probability": 70 if kind == "forecast" else None,
        "wind_speed_kmh": 10.0,
        "weather_code": 61,
        "condition": "Light rain",
        "origin": "live",
    }


def test_forecast_does_not_overwrite_observed_archive_records():
    archive = [_record(1, "observed", 5.0), _record(2, "observed", 6.0)]
    forecast = [_record(2, "forecast", 99.0), _record(3, "forecast", 8.0)]

    merged = merge_weather_records(archive, forecast)
    by_day = {record["observed_at"].day: record for record in merged}

    assert by_day[2]["kind"] == "observed"
    assert by_day[2]["precipitation_mm"] == 6.0
    assert by_day[3]["kind"] == "forecast"
    assert len(merged) == 3


def test_merge_is_sorted_and_handles_empty_inputs():
    assert merge_weather_records([], []) == []
    merged = merge_weather_records([_record(2, "observed", 1.0)], [_record(1, "forecast", 2.0)])
    assert [record["observed_at"].day for record in merged] == [1, 2]
