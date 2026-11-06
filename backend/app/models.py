from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

CATEGORIES = [
    "Accident",
    "Road Closure",
    "Construction",
    "Traffic Diversion",
    "Public Event",
    "Parking Restriction",
    "Other",
]

STATUSES = ["active", "upcoming", "resolved", "unknown"]
SEVERITIES = ["low", "medium", "high"]
ORIGINS = ["live", "demo"]
SOURCES_TYPES = ["API", "Web scraping", "Sample dataset"]
LOCATION_PRECISIONS = ["locality", "segment", "unknown"]


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(400))
    description: Mapped[str | None] = mapped_column(Text)
    licence_note: Mapped[str | None] = mapped_column(String(300))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    incidents: Mapped[list["Incident"]] = relationship(back_populates="source")
    logs: Mapped[list["CollectionLog"]] = relationship(back_populates="source")


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint("origin IN ('live', 'demo')", name="ck_incidents_origin"),
        CheckConstraint(
            "status IN ('active', 'upcoming', 'resolved', 'unknown')",
            name="ck_incidents_status",
        ),
        CheckConstraint(
            "category IN ('Accident', 'Road Closure', 'Construction', "
            "'Traffic Diversion', 'Public Event', 'Parking Restriction', 'Other')",
            name="ck_incidents_category",
        ),
        CheckConstraint(
            "severity IN ('low', 'medium', 'high')", name="ck_incidents_severity"
        ),
        CheckConstraint(
            "location_precision IN ('locality', 'segment', 'unknown')",
            name="ck_incidents_location_precision",
        ),
        Index("ix_incidents_category_status", "category", "status"),
        Index("ix_incidents_start_time", "start_time"),
        Index("ix_incidents_location", "location_name"),
        Index("ix_incidents_geo", "latitude", "longitude"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    external_id: Mapped[str | None] = mapped_column(String(160))
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    location_name: Mapped[str | None] = mapped_column(String(180))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    location_precision: Mapped[str] = mapped_column(String(20), default="locality")
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_id: Mapped[int] = mapped_column(ForeignKey("data_sources.id"), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(600))
    origin: Mapped[str] = mapped_column(String(10), nullable=False, default="live")
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    source: Mapped[DataSource] = relationship(back_populates="incidents", lazy="joined")


class WeatherObservation(Base):
    __tablename__ = "weather_observations"
    __table_args__ = (
        UniqueConstraint("observed_at", "source_id", name="uq_weather_observation_source"),
        CheckConstraint("kind IN ('observed', 'forecast')", name="ck_weather_kind"),
        Index("ix_weather_observed_at", "observed_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="observed")
    temperature_c: Mapped[float | None] = mapped_column(Float)
    precipitation_mm: Mapped[float | None] = mapped_column(Float)
    precipitation_probability: Mapped[int | None] = mapped_column(Integer)
    wind_speed_kmh: Mapped[float | None] = mapped_column(Float)
    weather_code: Mapped[int | None] = mapped_column(Integer)
    condition: Mapped[str | None] = mapped_column(String(100))
    source_id: Mapped[int] = mapped_column(ForeignKey("data_sources.id"), nullable=False)
    origin: Mapped[str] = mapped_column(String(10), nullable=False, default="live")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    source: Mapped[DataSource] = relationship(lazy="joined")


class CollectionLog(Base):
    __tablename__ = "collection_logs"
    __table_args__ = (Index("ix_collection_logs_started_at", "started_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int | None] = mapped_column(ForeignKey("data_sources.id"))
    pipeline: Mapped[str] = mapped_column(String(50), nullable=False)
    triggered_by: Mapped[str] = mapped_column(String(30), nullable=False, default="cli")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    records_fetched: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_inserted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicates: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str | None] = mapped_column(Text)

    source: Mapped[DataSource | None] = relationship(back_populates="logs", lazy="joined")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (Index("ix_analytics_events_type_created", "event_type", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    page_path: Mapped[str | None] = mapped_column(String(200))
    session_hash: Mapped[str | None] = mapped_column(String(64))
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
