from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models import User
from app.schemas.calendar import (
    CalendarAuthorizationResponse,
    CalendarEventsResponse,
    CalendarStatusResponse,
)
from app.services.calendar_service import CalendarService


router = APIRouter(prefix="/integrations/google-calendar", tags=["calendar"])


@router.get("/status", response_model=CalendarStatusResponse)
def calendar_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CalendarService(db).status(current_user)


@router.post("/authorize", response_model=CalendarAuthorizationResponse)
def authorize_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"authorization_url": CalendarService(db).authorization_url(current_user)}


@router.get("/callback")
async def calendar_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    if error or not code or not state:
        query = urlencode({"calendar": "error", "reason": error or "invalid_callback"})
        return RedirectResponse(f"{settings.frontend_url.rstrip('/')}?{query}")

    try:
        await CalendarService(db).connect(code, state)
    except Exception as exc:
        detail = getattr(exc, "detail", "authorization_failed")
        query = urlencode({"calendar": "error", "reason": str(detail)})
        return RedirectResponse(f"{settings.frontend_url.rstrip('/')}?{query}")
    return RedirectResponse(f"{settings.frontend_url.rstrip('/')}?calendar=connected")


@router.get("/events", response_model=CalendarEventsResponse)
async def calendar_events(
    max_results: int = Query(default=8, ge=1, le=25),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"events": await CalendarService(db).events(current_user, max_results)}


@router.delete("", status_code=204)
async def disconnect_calendar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await CalendarService(db).disconnect(current_user)
