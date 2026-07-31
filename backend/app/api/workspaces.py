from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate, WorkspaceWithMembers
from app.services.workspace_service import WorkspaceService


router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WorkspaceService(db).create(current_user, payload)


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return WorkspaceService(db).list_for_user(current_user)


@router.get("/{workspace_id}", response_model=WorkspaceWithMembers)
def get_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WorkspaceService(db).get(current_user, workspace_id)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WorkspaceService(db).update(current_user, workspace_id, payload)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    WorkspaceService(db).delete(current_user, workspace_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
