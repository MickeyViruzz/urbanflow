from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

EventType = Literal[
    "page_view",
    "search",
    "map_interaction",
    "incident_view",
    "route_check",
    "filter_apply",
    "feature_use",
]


class AnalyticsEventIn(BaseModel):
    event_type: EventType
    page_path: str | None = Field(default=None, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)
    session_id: str | None = Field(default=None, max_length=80)

    @field_validator("metadata")
    @classmethod
    def limit_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 10:
            raise ValueError("metadata accepts at most 10 fields")
        for key in value:
            if len(str(key)) > 40:
                raise ValueError("metadata keys must be 40 characters or fewer")
        return value


class RouteCheckIn(BaseModel):
    origin: str = Field(min_length=2, max_length=120)
    destination: str = Field(min_length=2, max_length=120)

    @field_validator("origin", "destination")
    @classmethod
    def strip_location(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("location must contain at least two characters")
        return cleaned


class PipelineRunIn(BaseModel):
    sources: list[Literal["all", "weather", "osm", "traffic-police"]] = Field(
        default_factory=lambda: ["all"]
    )
