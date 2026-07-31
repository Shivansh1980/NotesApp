from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, future=True)

if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_page_preferences()


def _migrate_page_preferences() -> None:
    """Keep existing local databases compatible without requiring Alembic."""

    page_columns = {column["name"] for column in inspect(engine).get_columns("pages")}
    additions = {
        "page_font": "VARCHAR(20) NOT NULL DEFAULT 'default'",
        "page_width": "VARCHAR(20) NOT NULL DEFAULT 'default'",
        "small_text": "BOOLEAN NOT NULL DEFAULT FALSE",
        "is_locked": "BOOLEAN NOT NULL DEFAULT FALSE",
        "is_favorite": "BOOLEAN NOT NULL DEFAULT FALSE",
    }
    missing = [(name, ddl) for name, ddl in additions.items() if name not in page_columns]
    if not missing:
        return

    with engine.begin() as connection:
        for name, ddl in missing:
            connection.execute(text(f"ALTER TABLE pages ADD COLUMN {name} {ddl}"))
