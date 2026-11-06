"""Create the UrbanFlow schema. Safe to run repeatedly."""

from sqlalchemy import text

from app.database import Base, SessionLocal, engine
from app.models import DataSource  # noqa: F401  (register models)
from etl.pipeline import ensure_sources


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        ensure_sources(session)
        session.execute(text("ANALYZE"))
        session.commit()


if __name__ == "__main__":
    init_db()
    print("UrbanFlow schema created and data sources registered.")
