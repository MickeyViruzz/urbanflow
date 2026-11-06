from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import analytics, dashboard, incidents, meta, route, sources, web_analytics
from etl.pipeline import initialize_data

logger = logging.getLogger("urbanflow")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            initialize_data(session, seed_demo_enabled=settings.demo_autoseed)
    except Exception:
        logger.exception("Database initialisation failed; API will start but data endpoints may fail")
    yield


app = FastAPI(
    title="UrbanFlow API",
    description=(
        "Smart Traffic & Road Disruption Intelligence for Mumbai. "
        "All dashboard values are aggregated from records held in PostgreSQL."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(incidents.router)
app.include_router(analytics.router)
app.include_router(route.router)
app.include_router(sources.router)
app.include_router(web_analytics.router)
app.include_router(meta.router)


@app.get("/", tags=["system"])
def root() -> dict:
    return {
        "name": "UrbanFlow API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health", tags=["system"])
def health() -> dict:
    database = "ok"
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "demo_autoseed": settings.demo_autoseed,
    }
