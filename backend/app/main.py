from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import api_router
from app.core.config import get_settings
from app.core.database import init_db


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.cors_origins],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
if settings.allowed_hosts != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
