"""Open-Meteo integration: a working, key-free weather data source.

Historical daily observations come from the Open-Meteo archive API and recent
observations plus a short forecast come from the forecast API. Both are public,
documented endpoints subject to Open-Meteo's terms of use.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

import requests

from app.config import settings
from etl.gazetteer import IST
from etl.sample_data import WEATHER_CODES

MUMBAI_LAT = 19.0760
MUMBAI_LON = 72.8777
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


class ExtractionError(RuntimeError):
    pass


def _get(url: str, params: dict, timeout: int = 25) -> dict:
    try:
        response = requests.get(
            url,
            params=params,
            timeout=timeout,
            headers={"User-Agent": settings.http_user_agent, "Accept": "application/json"},
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as error:
        raise ExtractionError(f"Open-Meteo request failed: {error}") from error


def _daily_records(payload: dict, kind: str) -> list[dict]:
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    records: list[dict] = []
    for index, day in enumerate(dates):
        try:
            parsed_day = date.fromisoformat(day)
        except ValueError:
            continue
        code = daily.get("weather_code", [None] * len(dates))[index]
        probability = (
            daily.get("precipitation_probability_max", [None] * len(dates))[index]
            if kind == "forecast"
            else None
        )
        records.append(
            {
                "observed_at": datetime.combine(parsed_day, time(hour=12), tzinfo=IST),
                "kind": kind,
                "temperature_c": daily.get("temperature_2m_mean", [None] * len(dates))[index],
                "precipitation_mm": daily.get("precipitation_sum", [None] * len(dates))[index],
                "precipitation_probability": probability,
                "wind_speed_kmh": daily.get("wind_speed_10m_max", [None] * len(dates))[index],
                "weather_code": code,
                "condition": WEATHER_CODES.get(code, "Unknown") if code is not None else None,
                "origin": "live",
            }
        )
    return records


def merge_weather_records(archive_records: list[dict], forecast_records: list[dict]) -> list[dict]:
    """Merge archive observations and forecast data without relabelling model output.

    The archive API is kept as the only source of `observed` records. Forecast API
    values for overlapping days must not overwrite them or be labelled observed.
    """
    records: dict[date, dict] = {}
    for record in archive_records:
        records[record["observed_at"].date()] = record
    for record in forecast_records:
        day = record["observed_at"].date()
        if day in records:
            continue
        records[day] = record
    return sorted(records.values(), key=lambda item: item["observed_at"])


def fetch_weather(days: int = 90, now: datetime | None = None) -> list[dict]:
    """Fetch historical daily observations and a short forecast."""
    today = (now or datetime.now(tz=IST)).date()
    start = today - timedelta(days=days)
    archive_end = today - timedelta(days=6)

    archive_records: list[dict] = []
    if archive_end >= start:
        archive = _get(
            ARCHIVE_URL,
            {
                "latitude": MUMBAI_LAT,
                "longitude": MUMBAI_LON,
                "start_date": start.isoformat(),
                "end_date": archive_end.isoformat(),
                "daily": "temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weather_code",
                "timezone": "Asia/Kolkata",
            },
        )
        archive_records = _daily_records(archive, "observed")

    forecast = _get(
        FORECAST_URL,
        {
            "latitude": MUMBAI_LAT,
            "longitude": MUMBAI_LON,
            "daily": (
                "temperature_2m_mean,precipitation_sum,precipitation_probability_max,"
                "wind_speed_10m_max,weather_code"
            ),
            "past_days": 7,
            "forecast_days": 6,
            "timezone": "Asia/Kolkata",
        },
    )
    forecast_records = _daily_records(forecast, "forecast")
    return merge_weather_records(archive_records, forecast_records)
