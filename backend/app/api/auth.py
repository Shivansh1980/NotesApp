from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).register(payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).login(payload)


@router.post("/logout")
def logout() -> dict[str, bool]:
    return {"ok": True}


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).refresh(payload.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
