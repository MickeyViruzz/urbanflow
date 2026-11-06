"""Deterministic, clearly-labelled demonstration dataset.

This data is synthetic. It exists so the application can be evaluated without
depending on live sources, and is always stored with origin="demo" and the
source "UrbanFlow Demonstration Dataset". It must never be presented as a live
traffic feed.
"""

from __future__ import annotations

import hashlib
import random
from datetime import date, datetime, time, timedelta

from .gazetteer import IST, LOCALITY_PLACES, Place
from .nlp import summarize

DEMO_SOURCE_SLUG = "demo-dataset"
LIVE_WEATHER_SOURCE_SLUG = "open-meteo"
DEMO_WEATHER_SOURCE_SLUG = "demo-weather"

ROADS = [
    "SV Road",
    "Link Road",
    "LBS Marg",
    "Western Express Highway",
    "Eastern Express Highway",
    "Sion-Panvel Highway",
    "Dr Annie Besant Road",
    "Senapati Bapat Marg",
    "Veer Savarkar Marg",
    "Lamington Road",
    "Mohammed Ali Road",
    "Juhu Tara Road",
    "Hill Road",
    "Sahar Road",
    "Marol Maroshi Road",
    "Powai Main Road",
    "Ghatkopar-Mankhurd Link Road",
    "Thane-Belapur Road",
    "Palm Beach Road",
    "Bandra-Worli Sea Link approach",
]

CATEGORY_WEIGHTS = [
    ("Accident", 20),
    ("Road Closure", 16),
    ("Construction", 22),
    ("Traffic Diversion", 12),
    ("Public Event", 9),
    ("Parking Restriction", 9),
    ("Other", 12),
]

SEVERITY_WEIGHTS = [("low", 30), ("medium", 48), ("high", 22)]

TEMPLATES: dict[str, list[tuple[str, str]]] = {
    "Accident": [
        (
            "Two-vehicle collision on {road} near {place}",
            "A collision involving two vehicles was reported on {road} near {place}. One lane is partially blocked and traffic is moving slowly in both directions. Commuters should allow extra time or use a parallel road where possible.",
        ),
        (
            "Two-wheeler skids near {place}",
            "A two-wheeler skidded near {place} during the morning peak. The rider was attended to by emergency services. Traffic on the approach road is being regulated while the vehicle is cleared.",
        ),
        (
            "Vehicle breakdown blocks lane at {place}",
            "A stalled vehicle is blocking the left lane near {place}. A recovery vehicle has been requested. Southbound traffic is queuing for approximately one kilometre.",
        ),
    ],
    "Road Closure": [
        (
            "Road closure on {road} for utility works",
            "A section of {road} near {place} is closed to vehicular traffic for utility works. The closure is scheduled for the stated period. Motorists should follow the signed diversion via the parallel service road.",
        ),
        (
            "Lane closure near {place} after road damage",
            "Emergency barricades have been placed around a damaged section of road near {place}. One direction remains open with restricted movement. Heavy vehicles are advised to avoid the stretch.",
        ),
        (
            "Night closure on {road}, {place}",
            "The road will remain closed overnight between {place} and the next junction for maintenance. Local access will be maintained for residents. Commuters should plan an alternative route.",
        ),
    ],
    "Construction": [
        (
            "Resurfacing work on {road} near {place}",
            "Road resurfacing is under way on {road} near {place}. One lane is barricaded and speed is restricted through the work zone. The contractor expects to complete the current phase within the stated window.",
        ),
        (
            "Metro construction activity at {place}",
            "Metro construction activity near {place} has narrowed the carriageway. Barricades and construction vehicles are present on the roadside. Drivers should reduce speed and follow signage.",
        ),
        (
            "Pipeline repair work at {place}",
            "Utility pipeline repair work is taking place near {place}. A portion of the road is excavated and protected by barricades. Local traffic is being managed manually during peak hours.",
        ),
    ],
    "Traffic Diversion": [
        (
            "Traffic diverted around {place}",
            "Traffic is being diverted from the main carriageway near {place} through a parallel lane while emergency work is completed. Expect additional travel time during the evening peak.",
        ),
        (
            "Diversion announced for {road}",
            "A temporary traffic diversion is in place on {road} near {place}. Bus routes are being operated via the alternate road. Signage has been installed at the approach junction.",
        ),
        (
            "One-way loop near {place}",
            "Vehicles are being rerouted in a one-way loop around {place} for the duration of the work. Local access remains available. Commuters unfamiliar with the area should follow the diversion boards.",
        ),
    ],
    "Public Event": [
        (
            "Procession route through {place}",
            "A public procession will pass through {place} and nearby roads. Rolling restrictions will apply along the route. Commuters are advised to use the outer ring roads during the event.",
        ),
        (
            "Large gathering near {place}",
            "A large public gathering near {place} is expected to affect traffic on approach roads. Parking in the immediate area will be restricted and pedestrians may be on the carriageway.",
        ),
        (
            "Event-related road restrictions at {place}",
            "Event-related restrictions will be in force around {place} through the evening. Buses will operate on diverted routes and on-street parking is suspended.",
        ),
    ],
    "Parking Restriction": [
        (
            "No-parking restriction on {road}, {place}",
            "On-street parking is prohibited on {road} near {place} while the restriction is in force. Vehicles parked in the notified zone are liable to be towed. Use the nearest authorised parking facility.",
        ),
        (
            "Parking zone suspended near {place}",
            "The pay-and-park zone near {place} is temporarily suspended due to road work. Alternative parking is available at the adjoining municipal lot.",
        ),
    ],
    "Other": [
        (
            "Waterlogging reported at {place}",
            "Waterlogging has been reported at {place} following sustained rainfall. The left lane is submerged and traffic is moving slowly. Riders should avoid the flooded section.",
        ),
        (
            "Signal failure near {place}",
            "A traffic signal failure near {place} is causing congestion in all directions. Manual traffic control is in place. Commuters should approach the junction with caution.",
        ),
        (
            "Fallen tree obstructs road near {place}",
            "A fallen tree is obstructing the roadside near {place}. The municipal crew has been informed. One lane is open and traffic is being alternated manually.",
        ),
        (
            "Cattle on carriageway near {place}",
            "Cattle have been reported on the carriageway near {place}, causing intermittent slowdowns. Drivers are advised to maintain a safe distance and follow posted speed limits.",
        ),
    ],
}

DURATIONS_HOURS: dict[str, tuple[int, int]] = {
    "Accident": (2, 8),
    "Road Closure": (10, 72),
    "Construction": (24, 168),
    "Traffic Diversion": (6, 48),
    "Public Event": (4, 12),
    "Parking Restriction": (12, 96),
    "Other": (2, 24),
}

WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    51: "Light drizzle",
    53: "Moderate drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Rain showers",
    81: "Moderate rain showers",
    95: "Thunderstorm",
}


def _weighted(rng: random.Random, pairs: list[tuple[str, int]]) -> str:
    population = [value for value, _ in pairs]
    weights = [weight for _, weight in pairs]
    return rng.choices(population, weights=weights, k=1)[0]


def _fingerprint(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _content_hash(record: dict) -> str:
    payload = "|".join(
        str(record.get(key) or "")
        for key in ("title", "description", "location_name", "start_time", "end_time", "status")
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def generate_sample_incidents(
    anchor: datetime | None = None, total: int = 172
) -> list[dict]:
    """Generate a stable and realistic-looking synthetic incident dataset."""
    now = anchor or datetime.now(tz=IST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=IST)
    rng = random.Random(20261105)
    records: list[dict] = []
    seen_fingerprints: set[str] = set()
    used_titles: set[str] = set()

    for index in range(total):
        is_current = index < 42
        category = _weighted(rng, CATEGORY_WEIGHTS)
        place: Place = rng.choice(LOCALITY_PLACES)
        road = rng.choice(ROADS)
        title_template, description_template = rng.choice(TEMPLATES[category])
        title = title_template.format(place=place.name, road=road)
        description = description_template.format(place=place.name, road=road)

        if is_current:
            if index % 7 == 0:
                start_time = now + timedelta(hours=rng.randint(3, 40))
            else:
                start_time = now - timedelta(hours=rng.uniform(0.5, 34))
        else:
            days_ago = rng.randint(2, 165)
            start_time = datetime.combine(
                (now - timedelta(days=days_ago)).date(),
                time(hour=rng.randint(5, 22), minute=rng.choice([0, 15, 30, 45])),
                tzinfo=IST,
            )

        min_hours, max_hours = DURATIONS_HOURS[category]
        duration_hours = rng.uniform(min_hours, max_hours)
        end_time: datetime | None = start_time + timedelta(hours=duration_hours)
        if category in {"Public Event", "Other"} and rng.random() < 0.18:
            end_time = None

        if start_time > now:
            status = "upcoming"
        elif end_time is None or end_time >= now:
            status = "active"
        else:
            status = "resolved"

        published_at = start_time - timedelta(hours=rng.uniform(1, 20))
        if published_at > now:
            published_at = now - timedelta(minutes=rng.randint(10, 120))
        if status == "active":
            last_updated = now - timedelta(minutes=rng.randint(12, 60 * 30))
            if last_updated < start_time:
                last_updated = start_time + timedelta(minutes=rng.randint(20, 240))
        elif status == "upcoming":
            last_updated = min(now, published_at + timedelta(hours=rng.uniform(1, 6)))
        else:
            last_updated = min(now, (end_time or start_time) + timedelta(hours=rng.uniform(0, 10)))

        severity = _weighted(rng, SEVERITY_WEIGHTS)
        if category in {"Accident", "Road Closure"} and rng.random() < 0.28:
            severity = "high"

        summary = summarize(description)
        fingerprint = _fingerprint(
            DEMO_SOURCE_SLUG, title.lower(), place.name.lower(), start_time.date().isoformat()
        )
        # Guarantee uniqueness when the same template, place and day collide.
        attempt = 0
        while fingerprint in seen_fingerprints or title in used_titles:
            attempt += 1
            fingerprint = _fingerprint(
                DEMO_SOURCE_SLUG,
                title.lower(),
                place.name.lower(),
                start_time.date().isoformat(),
                str(attempt),
            )
            if attempt > 4:
                title = f"{title} (update {attempt})"
        seen_fingerprints.add(fingerprint)
        used_titles.add(title)

        record = {
            "external_id": f"demo-{index + 1:04d}",
            "title": title,
            "category": category,
            "status": status,
            "severity": severity,
            "description": description,
            "summary": summary,
            "location_name": place.name,
            "latitude": place.lat,
            "longitude": place.lon,
            "location_precision": "locality",
            "start_time": start_time,
            "end_time": end_time,
            "published_at": published_at,
            "last_updated_at": last_updated,
            "source_url": None,
            "origin": "demo",
            "raw_payload": {
                "synthetic": True,
                "generator": "etl/sample_data.py",
                "seed": 20261105,
                "zone": place.zone,
            },
        }
        record["fingerprint"] = fingerprint
        record["content_hash"] = _content_hash(record)
        records.append(record)

    return records


def _condition_for_code(code: int) -> str:
    return WEATHER_CODES.get(code, "Unknown")


def _weather_record(day: date, rng: random.Random, kind: str) -> dict:
    month = day.month
    monsoon = month in {6, 7, 8, 9}
    rain_chance = 0.72 if monsoon else 0.14 if month in {10, 11} else 0.04
    will_rain = rng.random() < rain_chance
    precipitation = round(rng.uniform(3, 55), 1) if will_rain else 0.0
    if kind == "forecast":
        precipitation = round(rng.uniform(4, 30), 1) if will_rain else 0.0
    code = 3 if not will_rain else rng.choice([61, 63, 65, 80, 81, 95])
    temperature = round(rng.uniform(26, 33) - (1.5 if will_rain else 0), 1)
    probability = (
        rng.randint(65, 95)
        if will_rain
        else rng.randint(5, 35)
        if kind == "forecast"
        else 0
    )
    return {
        "observed_at": datetime.combine(day, time(hour=12), tzinfo=IST),
        "kind": kind,
        "temperature_c": temperature,
        "precipitation_mm": precipitation,
        "precipitation_probability": probability,
        "wind_speed_kmh": round(rng.uniform(6, 32), 1),
        "weather_code": code,
        "condition": _condition_for_code(code),
        "origin": "demo",
    }


def generate_sample_weather(anchor: datetime | None = None, history_days: int = 120) -> list[dict]:
    now = anchor or datetime.now(tz=IST)
    if now.tzinfo is None:
        now = now.replace(tzinfo=IST)
    rng = random.Random(20261106)
    records: list[dict] = []
    for offset in range(history_days, 0, -1):
        records.append(_weather_record((now - timedelta(days=offset)).date(), rng, "observed"))
    records.append(_weather_record(now.date(), rng, "observed"))
    for offset in range(1, 6):
        day_record = _weather_record((now + timedelta(days=offset)).date(), rng, "forecast")
        if offset == 2:
            day_record.update(
                precipitation_mm=26.0,
                precipitation_probability=88,
                weather_code=65,
                condition="Heavy rain",
            )
        if offset == 3:
            day_record.update(
                precipitation_mm=11.0,
                precipitation_probability=72,
                weather_code=63,
                condition="Moderate rain",
            )
        records.append(day_record)
    return records
