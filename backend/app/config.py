from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://urbanflow@localhost:5433/urbanflow"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    admin_token: str = ""
    demo_autoseed: bool = True
    osrm_base_url: str = "https://router.project-osrm.org"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    http_user_agent: str = (
        "UrbanFlowAcademicProject/1.0 (student project; contact: urbanflow@example.edu)"
    )
    traffic_police_url: str = "https://trafficpolice.maharashtra.gov.in/"

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    @field_validator("database_url")
    @classmethod
    def normalize_driver(cls, value: str) -> str:
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
