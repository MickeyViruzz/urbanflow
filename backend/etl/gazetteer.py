"""Curated Mumbai gazetteer used for location extraction and geocoding.

Coordinates are approximate locality centroids sourced from OpenStreetMap
place records. They are deliberately labelled as approximate in the UI: an
incident reported for a locality is not an exact incident position.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class Place:
    name: str
    lat: float
    lon: float
    zone: str
    kind: str = "locality"
    aliases: tuple[str, ...] = field(default_factory=tuple)


PLACES: tuple[Place, ...] = (
    Place("Colaba", 18.9067, 72.8147, "City", aliases=("Colaba Causeway",)),
    Place("Fort", 18.9339, 72.8355, "City", aliases=("Fort Mumbai",)),
    Place("Churchgate", 18.9322, 72.8264, "City"),
    Place("Marine Lines", 18.9435, 72.8230, "City", aliases=("Marine Drive",)),
    Place("Chhatrapati Shivaji Terminus", 18.9398, 72.8355, "City", aliases=("CST", "CSMT")),
    Place("Masjid Bunder", 18.9510, 72.8390, "City", aliases=("Masjid Bandar",)),
    Place("Byculla", 18.9750, 72.8258, "City"),
    Place("Mazgaon", 18.9667, 72.8333, "City"),
    Place("Dockyard Road", 18.9600, 72.8450, "City"),
    Place("Sewri", 19.0000, 72.8600, "City"),
    Place("Wadala", 19.0176, 72.8560, "City"),
    Place("Parel", 18.9977, 72.8376, "City"),
    Place("Lower Parel", 18.9953, 72.8253, "City"),
    Place("Prabhadevi", 19.0160, 72.8286, "City"),
    Place("Worli", 19.0176, 72.8153, "City", aliases=("Worli Sea Face",)),
    Place("Mahalaxmi", 18.9820, 72.8250, "City"),
    Place("Haji Ali", 18.9826, 72.8185, "City"),
    Place("Tardeo", 18.9700, 72.8150, "City"),
    Place("Malabar Hill", 18.9500, 72.8050, "City"),
    Place("Dadar", 19.0186, 72.8443, "City", aliases=("Dadar West", "Dadar East")),
    Place("Matunga", 19.0272, 72.8560, "City"),
    Place("Mahim", 19.0353, 72.8397, "City"),
    Place("Sion", 19.0390, 72.8619, "City"),
    Place("Bandra West", 19.0596, 72.8295, "Western Suburbs", aliases=("Bandra",)),
    Place("Bandra East", 19.0653, 72.8475, "Western Suburbs"),
    Place("Bandra-Kurla Complex", 19.0662, 72.8697, "Western Suburbs", aliases=("BKC",)),
    Place("Santacruz", 19.0800, 72.8400, "Western Suburbs", aliases=("Santa Cruz",)),
    Place("Vile Parle", 19.0990, 72.8470, "Western Suburbs"),
    Place("Juhu", 19.1075, 72.8263, "Western Suburbs"),
    Place("Andheri West", 19.1364, 72.8296, "Western Suburbs", aliases=("Andheri",)),
    Place("Andheri East", 19.1136, 72.8697, "Western Suburbs"),
    Place("Jogeshwari", 19.1200, 72.8500, "Western Suburbs", aliases=("Jogeshwari East",)),
    Place("Goregaon", 19.1646, 72.8493, "Western Suburbs"),
    Place("Malad", 19.1874, 72.8483, "Western Suburbs"),
    Place("Kandivali", 19.2090, 72.8520, "Western Suburbs"),
    Place("Borivali", 19.2307, 72.8567, "Western Suburbs"),
    Place("Dahisar", 19.2500, 72.8600, "Western Suburbs"),
    Place("Oshiwara", 19.1450, 72.8400, "Western Suburbs"),
    Place("Sahar", 19.1000, 72.8700, "Western Suburbs"),
    Place("Marol", 19.1150, 72.8820, "Western Suburbs"),
    Place("Sakinaka", 19.1000, 72.8850, "Western Suburbs"),
    Place("Kalina", 19.0720, 72.8600, "Western Suburbs"),
    Place("Kurla", 19.0726, 72.8845, "Eastern Suburbs"),
    Place("Vidyavihar", 19.0784, 72.8975, "Eastern Suburbs"),
    Place("Ghatkopar", 19.0864, 72.9085, "Eastern Suburbs"),
    Place("Chembur", 19.0522, 72.9005, "Eastern Suburbs"),
    Place("Powai", 19.1176, 72.9060, "Eastern Suburbs"),
    Place("Vikhroli", 19.1077, 72.9276, "Eastern Suburbs"),
    Place("Bhandup", 19.1448, 72.9375, "Eastern Suburbs"),
    Place("Mulund", 19.1726, 72.9425, "Eastern Suburbs"),
    Place("Thane", 19.2183, 72.9781, "Extended Mumbai"),
    Place("Airoli", 19.1550, 72.9930, "Extended Mumbai"),
    Place("Vashi", 19.0771, 72.9986, "Extended Mumbai"),
    Place("Panvel", 18.9894, 73.1175, "Extended Mumbai"),
    Place("Western Express Highway", 19.1600, 72.8500, "Western Suburbs", "corridor", ("WEH",)),
    Place("Eastern Express Highway", 19.1000, 72.9200, "Eastern Suburbs", "corridor", ("EEH",)),
    Place("Sion-Panvel Highway", 19.0300, 72.9500, "Eastern Suburbs", "corridor"),
    Place("LBS Marg", 19.1000, 72.9000, "Eastern Suburbs", "corridor", ("LBS Road",)),
    Place("SV Road", 19.1500, 72.8400, "Western Suburbs", "corridor", ("Swami Vivekanand Road",)),
    Place("Bandra-Worli Sea Link", 19.0300, 72.8100, "City", "corridor", ("Sea Link",)),
    Place("Santacruz-Chembur Link Road", 19.0600, 72.8800, "Eastern Suburbs", "corridor", ("SCLR",)),
    Place("Jogeshwari-Vikhroli Link Road", 19.1200, 72.9000, "Suburbs", "corridor", ("JVLR",)),
)

LOCALITY_PLACES = tuple(place for place in PLACES if place.kind == "locality")

ZONE_NAMES = ["City", "Western Suburbs", "Eastern Suburbs", "Extended Mumbai"]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


@lru_cache
def _index() -> tuple[tuple[str, Place], ...]:
    entries: list[tuple[str, Place]] = []
    for place in PLACES:
        entries.append((place.name, place))
        for alias in place.aliases:
            entries.append((alias, place))
    return tuple(sorted(entries, key=lambda item: len(item[0]), reverse=True))


def extract_locations(text: str, limit: int = 4) -> list[Place]:
    """Return gazetteer places mentioned in text, longest match first."""
    if not text:
        return []
    found: list[Place] = []
    seen: set[str] = set()
    for label, place in _index():
        if place.name in seen:
            continue
        if re.search(rf"(?<![A-Za-z]){re.escape(label)}(?![A-Za-z])", text, re.IGNORECASE):
            found.append(place)
            seen.add(place.name)
        if len(found) >= limit:
            break
    return found


def find_place(query: str) -> Place | None:
    """Resolve a user-entered locality against the gazetteer."""
    if not query:
        return None
    normalized = re.sub(r"\s+", " ", query.strip().lower())
    entries = _index()
    for label, place in entries:
        if normalized == label.lower():
            return place
    for label, place in entries:
        if len(label) >= 4 and label.lower() in normalized:
            return place
    for label, place in entries:
        if len(normalized) >= 4 and normalized in label.lower():
            return place
    return None


def nearest_place(lat: float, lon: float) -> tuple[Place, float]:
    best = min(LOCALITY_PLACES, key=lambda place: haversine_m(lat, lon, place.lat, place.lon))
    return best, haversine_m(lat, lon, best.lat, best.lon)


def now_ist() -> datetime:
    return datetime.now(tz=IST)


def is_within_mumbai(lat: float, lon: float) -> bool:
    return 18.85 <= lat <= 19.40 and 72.70 <= lon <= 73.25
