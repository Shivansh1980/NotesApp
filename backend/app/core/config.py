from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = f"sqlite:///{(BACKEND_DIR / 'notes_app.db').as_posix()}"


class Settings(BaseSettings):
    app_name: str = "Notion Style Notes"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api"
    database_url: str = DEFAULT_DATABASE_URL
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 14
    upload_dir: Path = BACKEND_DIR / "storage" / "uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_upload_types: set[str] = Field(
        default_factory=lambda: {
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/plain",
            "text/markdown",
            "application/zip",
        }
    )
    cors_origins: Annotated[list[str | AnyHttpUrl], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    cors_origin_regex: str | None = None
    allowed_hosts: Annotated[list[str], NoDecode] = ["*"]
    frontend_url: str = "http://localhost:5173"
    google_calendar_client_id: str | None = None
    google_calendar_client_secret: str | None = None
    google_calendar_redirect_uri: str | None = None
    oauth_token_encryption_key: str | None = None
    outbound_http_proxy: str | None = None

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", "allowed_hosts", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def normalize_and_validate(self) -> "Settings":
        sqlite_prefix = "sqlite:///"
        if self.database_url.startswith(sqlite_prefix):
            database_path = self.database_url.removeprefix(sqlite_prefix)
            if database_path != ":memory:" and not Path(database_path).is_absolute():
                resolved_path = (BACKEND_DIR / database_path).resolve()
                self.database_url = f"{sqlite_prefix}{resolved_path.as_posix()}"

        if not self.upload_dir.is_absolute():
            self.upload_dir = (BACKEND_DIR / self.upload_dir).resolve()

        if self.environment == "production":
            if self.secret_key == "change-me-in-production" or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be a unique value of at least 32 characters in production")
            if not self.cors_origins and not self.cors_origin_regex:
                raise ValueError("At least one production CORS origin or origin regex is required")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
