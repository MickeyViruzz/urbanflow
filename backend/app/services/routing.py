from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import requests
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Incident
from app.services.geo import (
    GeocodeError,
    GeocodeResult,
    decimate_route,
    distance_to_route_m,
    geocode,
)
from app.services.serialization import incident_to_dict
from etl.gazetteer import IST

CORRIDOR_METRES = 350
UNKNOWN_RECORD_LOOKBACK_DAYS = 365


class RoutingError(RuntimeError):
    pass


@dataclass
class RouteOption:
    option_id: str
    distance_m: float
    duration_s: float
    geometry: list[tuple[float, float]]
    hazards: list[dict]


def _fetch_osrm(origin: GeocodeResult, destination: GeocodeResult) -> list[RouteOption]:
    url = (
        f"{settings.osrm_base_url}/route/v1/driving/"
        f"{origin.longitude},{origin.latitude};{destination.longitude},{destination.latitude}"
    )
    try:
        response = requests.get(
            url,
            params={
                "overview": "full",
                "geometries": "geojson",
                "alternatives": 2,
                "steps": "false",
            },
            timeout=20,
            headers={"User-Agent": settings.http_user_agent, "Accept": "application/json"},
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as error:
        raise RoutingError(f"Routing service unavailable: {error}") from error

    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise RoutingError(
            "No drivable route could be calculated between those locations in the routing network."
        )

    options: list[RouteOption] = []
    seen: set[tuple[float, float]] = set()
    for index, route in enumerate(payload["routes"]):
        coordinates = route.get("geometry", {}).get("coordinates") or []
        geometry = [(float(lat), float(lon)) for lon, lat in coordinates]
        if len(geometry) < 2:
            continue
        signature = (round(route.get("distance", 0) / 50), round(route.get("duration", 0) / 30))
        if signature in seen:
            continue
        seen.add(signature)
        options.append(
            RouteOption(
                option_id="primary" if index == 0 else f"alternative-{index}",
                distance_m=float(route.get("distance", 0)),
                duration_s=float(route.get("duration", 0)),
                geometry=geometry,
                hazards=[],
            )
        )
    if not options:
        raise RoutingError("Routing service returned no usable geometry.")
    return options


def _incidents_near(option: RouteOption, incidents: list[Incident]) -> list[dict]:
    hazards: list[dict] = []
    for incident in incidents:
        if incident.latitude is None or incident.longitude is None:
            continue
        distance, fraction = distance_to_route_m(
            incident.latitude, incident.longitude, option.geometry
        )
        if distance <= CORRIDOR_METRES:
            payload = incident_to_dict(incident)
            payload["distance_from_route_m"] = round(distance, 1)
            payload["route_fraction"] = round(fraction, 3)
            payload["match_type"] = "corridor_proximity"
            hazards.append(payload)
    hazards.sort(key=lambda item: item["distance_from_route_m"])
    return hazards


def check_route(session: Session, origin_query: str, destination_query: str) -> dict:
    origin = geocode(origin_query)
    destination = geocode(destination_query)
    if abs(origin.latitude - destination.latitude) < 0.0005 and abs(
        origin.longitude - destination.longitude
    ) < 0.0005:
        raise GeocodeError("Starting point and destination resolve to the same place.")

    unknown_cutoff = datetime.now(tz=IST) - timedelta(days=UNKNOWN_RECORD_LOOKBACK_DAYS)
    incidents = session.scalars(
        select(Incident).where(
            Incident.status.in_(["active", "upcoming", "unknown"]),
            # OSM records have no confirmed status. Only consider recently edited
            # mapped records for route relevance; older mapped records remain in
            # the historical table and map but are not treated as current hazards.
            or_(
                Incident.status != "unknown",
                Incident.last_updated_at >= unknown_cutoff,
            ),
            Incident.latitude.is_not(None),
            Incident.longitude.is_not(None),
        )
    ).all()

    options = _fetch_osrm(origin, destination)
    primary = options[0]
    for option in options:
        option.hazards = _incidents_near(option, incidents)

    primary_hazards = primary.hazards
    viable = [
        option
        for option in options[1:]
        if len(option.hazards) < len(primary_hazards)
    ]
    recommended = None
    if viable:
        viable.sort(key=lambda option: (len(option.hazards), option.duration_s))
        recommended = viable[0]

    alternatives = [
        {
            "option_id": option.option_id,
            "distance_m": round(option.distance_m),
            "duration_s": round(option.duration_s),
            "hazard_count": len(option.hazards),
            "hazards": [hazard["id"] for hazard in option.hazards],
            "recommended": option is recommended,
            "geometry": decimate_route(option.geometry),
        }
        for option in options[1:]
    ]

    dataset_origins = {
        "live": sum(1 for incident in incidents if incident.origin == "live"),
        "demo": sum(1 for incident in incidents if incident.origin == "demo"),
    }

    if not primary_hazards:
        message = (
            "No matching disruption was found in the currently collected dataset for this "
            "corridor. This does not confirm that the route is clear: official advisories may "
            "be missing, delayed or not yet collected."
        )
    else:
        message = (
            f"{len(primary_hazards)} reported disruption"
            f"{'s' if len(primary_hazards) != 1 else ''} fall within "
            f"{CORRIDOR_METRES} m of the calculated route corridor."
        )

    return {
        "generated_at": datetime.now(tz=IST).isoformat(),
        "origin": origin.to_dict(),
        "destination": destination.to_dict(),
        "route": {
            "distance_m": round(primary.distance_m),
            "duration_s": round(primary.duration_s),
            "geometry": decimate_route(primary.geometry),
        },
        "disruptions": primary_hazards,
        "alternatives": alternatives,
        "suggested_alternative": (
            {
                "option_id": recommended.option_id,
                "distance_m": round(recommended.distance_m),
                "duration_s": round(recommended.duration_s),
                "hazard_count": len(recommended.hazards),
                "geometry": decimate_route(recommended.geometry),
            }
            if recommended
            else None
        ),
        "message": message,
        "context": {
            "corridor_m": CORRIDOR_METRES,
            "incidents_considered": len(incidents),
            "statuses_considered": ["active", "upcoming", "unknown"],
            "unknown_lookback_days": UNKNOWN_RECORD_LOOKBACK_DAYS,
            "dataset_origins": dataset_origins,
            "routing_engine": "OSRM public demo server",
            "routing_note": (
                "Distance and duration are free-flow network estimates from OSRM, not live "
                "traffic speeds. Active, upcoming and status-unknown mapped records are matched "
                "geometrically to a corridor around the route. OSM records are considered only "
                "when edited within the last 12 months and remain unconfirmed. These are "
                "reported disruptions, not confirmed closures."
            ),
        },
        "disclaimer": (
            "UrbanFlow analyses the records it has collected. Always follow official traffic "
            "police diversions and on-ground signage."
        ),
    }
