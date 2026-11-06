from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass
from functools import lru_cache

import requests

from app.config import settings
from etl.gazetteer import IST, find_place, is_within_mumbai

_geocode_lock = threading.Lock()
_last_nominatim_call = 0.0


@dataclass(frozen=True)
class GeocodeResult:
    query: str
    display_name: str
    latitude: float
    longitude: float
    source: str

    def to_dict(self) -> dict:
        return {
            "query": self.query,
            "display_name": self.display_name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "geocode_source": self.source,
        }


class GeocodeError(RuntimeError):
    pass


@lru_cache(maxsize=256)
def geocode(query: str) -> GeocodeResult:
    normalized = query.strip()
    place = find_place(normalized)
    if place is not None:
        return GeocodeResult(
            query=normalized,
            display_name=f"{place.name}, Mumbai",
            latitude=place.lat,
            longitude=place.lon,
            source="gazetteer",
        )

    global _last_nominatim_call
    with _geocode_lock:
        elapsed = time.monotonic() - _last_nominatim_call
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)
        try:
            response = requests.get(
                f"{settings.nominatim_url}/search",
                params={
                    "q": f"{normalized}, Mumbai, Maharashtra, India",
                    "format": "jsonv2",
                    "limit": 1,
                    "countrycodes": "in",
                    "viewbox": "72.70,19.40,73.25,18.85",
                    "bounded": 1,
                },
                timeout=12,
                headers={"User-Agent": settings.http_user_agent, "Accept": "application/json"},
            )
            _last_nominatim_call = time.monotonic()
            response.raise_for_status()
            results = response.json()
        except (requests.RequestException, ValueError) as error:
            raise GeocodeError(f"Location lookup failed: {error}") from error

    if not results:
        raise GeocodeError(
            f"Could not locate '{normalized}' within the Mumbai region. Try a locality such as Bandra or Powai."
        )
    result = results[0]
    try:
        latitude = float(result["lat"])
        longitude = float(result["lon"])
    except (KeyError, TypeError, ValueError) as error:
        raise GeocodeError("Location lookup returned an unreadable result") from error
    if not is_within_mumbai(latitude, longitude):
        raise GeocodeError(
            f"'{normalized}' is outside UrbanFlow's current Mumbai coverage area."
        )
    return GeocodeResult(
        query=normalized,
        display_name=result.get("display_name", normalized),
        latitude=latitude,
        longitude=longitude,
        source="nominatim",
    )


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _project_point_to_segment(
    point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]
) -> tuple[float, float]:
    """Return (distance_m, fraction_along_segment) using a local planar approximation."""
    lat, lon = point
    lat0 = math.radians((start[0] + end[0]) / 2)
    meters_per_deg_lat = 111_132.0
    meters_per_deg_lon = 111_320.0 * math.cos(lat0)

    px = (lon - start[1]) * meters_per_deg_lon
    py = (lat - start[0]) * meters_per_deg_lat
    vx = (end[1] - start[1]) * meters_per_deg_lon
    vy = (end[0] - start[0]) * meters_per_deg_lat
    length_sq = vx * vx + vy * vy
    if length_sq == 0:
        return haversine_m(lat, lon, start[0], start[1]), 0.0
    t = max(0.0, min(1.0, (px * vx + py * vy) / length_sq))
    closest_x, closest_y = vx * t, vy * t
    distance = math.hypot(px - closest_x, py - closest_y)
    return distance, t


def distance_to_route_m(
    latitude: float, longitude: float, route: list[tuple[float, float]]
) -> tuple[float, float]:
    """Minimum distance from a point to a route polyline and fraction along it."""
    if len(route) < 2:
        return float("inf"), 0.0
    segment_lengths = [
        haversine_m(route[index][0], route[index][1], route[index + 1][0], route[index + 1][1])
        for index in range(len(route) - 1)
    ]
    total_length = sum(segment_lengths) or 1.0
    travelled = 0.0
    best_distance = float("inf")
    best_fraction = 0.0
    for index in range(len(route) - 1):
        segment_start, segment_end = route[index], route[index + 1]
        distance, t = _project_point_to_segment(
            (latitude, longitude), segment_start, segment_end
        )
        if distance < best_distance:
            best_distance = distance
            best_fraction = (travelled + segment_lengths[index] * t) / total_length
        travelled += segment_lengths[index]
    return best_distance, best_fraction


def decimate_route(route: list[tuple[float, float]], max_points: int = 800) -> list[list[float]]:
    if len(route) <= max_points:
        return [[lat, lon] for lat, lon in route]
    step = max(1, len(route) // max_points)
    sampled = route[::step]
    if sampled[-1] != route[-1]:
        sampled.append(route[-1])
    return [[lat, lon] for lat, lon in sampled]


def ist_now_iso() -> str:
    from datetime import datetime

    return datetime.now(tz=IST).isoformat()
