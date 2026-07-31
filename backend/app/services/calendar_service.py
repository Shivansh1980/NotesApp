import asyncio
import base64
import hashlib
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_token, decode_token
from app.models import CalendarConnection, User


GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"

logger = logging.getLogger(__name__)


def _client_options(timeout: float) -> dict[str, Any]:
    options: dict[str, Any] = {"timeout": timeout, "trust_env": True}
    proxy = get_settings().outbound_http_proxy
    if proxy:
        options["proxy"] = proxy
    return options


def _sync_request(method: str, url: str, timeout: float, kwargs: dict[str, Any]) -> httpx.Response:
    with httpx.Client(**_client_options(timeout)) as client:
        return client.request(method, url, **kwargs)


async def _request_with_transport_fallback(
    method: str,
    url: str,
    *,
    timeout: float,
    **kwargs: Any,
) -> httpx.Response:
    """Retry through the sync transport when a hosting proxy rejects async sockets."""

    try:
        async with httpx.AsyncClient(**_client_options(timeout)) as client:
            return await client.request(method, url, **kwargs)
    except httpx.TransportError as async_error:
        logger.warning("Async request transport failed for %s; retrying through sync transport", url)
        try:
            return await asyncio.to_thread(_sync_request, method, url, timeout, kwargs)
        except httpx.HTTPError as sync_error:
            raise sync_error from async_error


class CalendarService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.cipher = Fernet(self._encryption_key())

    def status(self, user: User) -> dict[str, object]:
        return {
            "configured": self.is_configured,
            "connected": self._connection(user.id) is not None,
            "provider": "google",
        }

    def authorization_url(self, user: User) -> str:
        self._require_configured()
        state_token = create_token(user.id, "google_calendar", minutes=10)
        query = urlencode(
            {
                "client_id": self.settings.google_calendar_client_id,
                "redirect_uri": self.settings.google_calendar_redirect_uri,
                "response_type": "code",
                "scope": GOOGLE_CALENDAR_SCOPE,
                "access_type": "offline",
                "include_granted_scopes": "true",
                "prompt": "consent",
                "state": state_token,
            }
        )
        return f"{GOOGLE_AUTHORIZATION_URL}?{query}"

    async def connect(self, code: str, state_token: str) -> User:
        self._require_configured()
        try:
            user_id = decode_token(state_token, expected_type="google_calendar")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OAuth state") from exc

        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        token_payload = await self._post_token(
            {
                "client_id": self.settings.google_calendar_client_id,
                "client_secret": self.settings.google_calendar_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.settings.google_calendar_redirect_uri,
            }
        )
        access_token = str(token_payload.get("access_token") or "")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google did not return an access token")

        connection = self._connection(user.id)
        if not connection:
            connection = CalendarConnection(user_id=user.id, provider="google", encrypted_access_token="")
            self.db.add(connection)

        refresh_token = token_payload.get("refresh_token")
        connection.encrypted_access_token = self._encrypt(access_token)
        if refresh_token:
            connection.encrypted_refresh_token = self._encrypt(str(refresh_token))
        connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=int(token_payload.get("expires_in", 3600)))
        connection.scopes = str(token_payload.get("scope") or GOOGLE_CALENDAR_SCOPE)
        self.db.commit()
        return user

    async def events(self, user: User, max_results: int = 8) -> list[dict[str, object]]:
        connection = self._connection(user.id)
        if not connection:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Google Calendar is not connected")

        access_token = await self._access_token(connection)
        params = {
            "timeMin": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "singleEvents": "true",
            "orderBy": "startTime",
            "maxResults": str(max(1, min(max_results, 25))),
        }
        try:
            response = await _request_with_transport_fallback(
                "GET",
                GOOGLE_EVENTS_URL,
                timeout=15,
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Google Calendar is unavailable",
            ) from exc
        if response.status_code == 401:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reconnect Google Calendar")
        if response.is_error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Unable to load Google Calendar events")

        return [self._serialize_event(item) for item in response.json().get("items", [])]

    async def disconnect(self, user: User) -> None:
        connection = self._connection(user.id)
        if not connection:
            return
        token = self._decrypt(connection.encrypted_refresh_token or connection.encrypted_access_token)
        try:
            await _request_with_transport_fallback(
                "POST",
                GOOGLE_REVOKE_URL,
                timeout=8,
                data={"token": token},
            )
        except httpx.HTTPError:
            pass
        self.db.delete(connection)
        self.db.commit()

    @property
    def is_configured(self) -> bool:
        return all(
            (
                self.settings.google_calendar_client_id,
                self.settings.google_calendar_client_secret,
                self.settings.google_calendar_redirect_uri,
            )
        )

    def _require_configured(self) -> None:
        if not self.is_configured:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google Calendar is not configured")

    def _connection(self, user_id: str) -> CalendarConnection | None:
        return self.db.scalar(
            select(CalendarConnection).where(
                CalendarConnection.user_id == user_id,
                CalendarConnection.provider == "google",
            )
        )

    async def _access_token(self, connection: CalendarConnection) -> str:
        expires_at = connection.token_expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if not expires_at or expires_at > datetime.now(UTC) + timedelta(seconds=60):
            return self._decrypt(connection.encrypted_access_token)

        if not connection.encrypted_refresh_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reconnect Google Calendar")
        token_payload = await self._post_token(
            {
                "client_id": self.settings.google_calendar_client_id,
                "client_secret": self.settings.google_calendar_client_secret,
                "refresh_token": self._decrypt(connection.encrypted_refresh_token),
                "grant_type": "refresh_token",
            }
        )
        access_token = str(token_payload.get("access_token") or "")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Reconnect Google Calendar")
        connection.encrypted_access_token = self._encrypt(access_token)
        connection.token_expires_at = datetime.now(UTC) + timedelta(seconds=int(token_payload.get("expires_in", 3600)))
        self.db.commit()
        return access_token

    async def _post_token(self, data: dict[str, object]) -> dict:
        try:
            response = await _request_with_transport_fallback(
                "POST",
                GOOGLE_TOKEN_URL,
                timeout=15,
                data=data,
            )
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google OAuth is unavailable") from exc
        if response.is_error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google authorization failed")
        return response.json()

    def _encryption_key(self) -> bytes:
        configured = self.settings.oauth_token_encryption_key
        if configured:
            try:
                Fernet(configured.encode("ascii"))
            except (ValueError, InvalidToken) as exc:
                raise RuntimeError("OAUTH_TOKEN_ENCRYPTION_KEY must be a valid Fernet key") from exc
            return configured.encode("ascii")
        digest = hashlib.sha256(self.settings.secret_key.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest)

    def _encrypt(self, value: str) -> str:
        return self.cipher.encrypt(value.encode("utf-8")).decode("ascii")

    def _decrypt(self, value: str) -> str:
        try:
            return self.cipher.decrypt(value.encode("ascii")).decode("utf-8")
        except InvalidToken as exc:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Stored calendar token is invalid") from exc

    @staticmethod
    def _serialize_event(event: dict) -> dict[str, object]:
        start = event.get("start") or {}
        end = event.get("end") or {}
        start_value = start.get("dateTime") or start.get("date") or ""
        end_value = end.get("dateTime") or end.get("date")
        return {
            "id": str(event.get("id") or ""),
            "title": str(event.get("summary") or "Untitled event"),
            "start": str(start_value),
            "end": str(end_value) if end_value else None,
            "all_day": "date" in start and "dateTime" not in start,
            "html_link": event.get("htmlLink"),
            "location": event.get("location"),
        }
