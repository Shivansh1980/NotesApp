from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.models import User, Workspace, WorkspaceMember
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def register(self, payload: RegisterRequest) -> TokenResponse:
        existing = self.db.scalar(select(User).where(User.email == payload.email.lower()))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(
            email=payload.email.lower(),
            name=payload.name.strip(),
            password_hash=hash_password(payload.password),
        )
        self.db.add(user)
        self.db.flush()

        workspace = Workspace(name=f"{user.name}'s workspace", owner_id=user.id)
        self.db.add(workspace)
        self.db.flush()
        self.db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        self.db.commit()
        self.db.refresh(user)
        return self._tokens(user)

    def login(self, payload: LoginRequest) -> TokenResponse:
        user = self.db.scalar(select(User).where(User.email == payload.email.lower()))
        if not user or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return self._tokens(user)

    def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            user_id = decode_token(refresh_token, expected_type="refresh")
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc
        user = self.db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        return self._tokens(user)

    def _tokens(self, user: User) -> TokenResponse:
        return TokenResponse(
            access_token=create_token(user.id, "access"),
            refresh_token=create_token(user.id, "refresh"),
            user=user,
        )
