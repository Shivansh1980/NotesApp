from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def _password_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_password_bytes(password), password_hash.encode("utf-8"))


def create_token(subject: str, token_type: str = "access", minutes: int | None = None) -> str:
    settings = get_settings()
    if minutes is None:
        minutes = (
            settings.access_token_minutes
            if token_type == "access"
            else settings.refresh_token_days * 24 * 60
        )
    expires_at = datetime.now(UTC) + timedelta(minutes=minutes)
    payload: dict[str, Any] = {"sub": subject, "type": token_type, "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str = "access") -> str:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        token_type = payload.get("type")
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
    if not subject or token_type != expected_type:
        raise ValueError("Invalid token")
    return str(subject)
