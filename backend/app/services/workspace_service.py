from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import User, Workspace, WorkspaceMember
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate
from app.services.permission_service import PermissionService


class WorkspaceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def create(self, user: User, payload: WorkspaceCreate) -> Workspace:
        workspace = Workspace(name=payload.name.strip(), owner_id=user.id)
        self.db.add(workspace)
        self.db.flush()
        self.db.add(WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner"))
        self.db.commit()
        self.db.refresh(workspace)
        return workspace

    def list_for_user(self, user: User) -> list[Workspace]:
        return list(
            self.db.scalars(
                select(Workspace)
                .join(WorkspaceMember)
                .where(WorkspaceMember.user_id == user.id)
                .order_by(Workspace.updated_at.desc())
            )
        )

    def get(self, user: User, workspace_id: str) -> Workspace:
        self.permissions.require_workspace(user, workspace_id)
        workspace = self.db.scalar(
            select(Workspace)
            .options(selectinload(Workspace.members))
            .where(Workspace.id == workspace_id)
        )
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        return workspace

    def update(self, user: User, workspace_id: str, payload: WorkspaceUpdate) -> Workspace:
        self.permissions.require_workspace(user, workspace_id, "admin")
        workspace = self.db.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        if payload.name is not None:
            workspace.name = payload.name.strip()
        self.db.commit()
        self.db.refresh(workspace)
        return workspace

    def delete(self, user: User, workspace_id: str) -> None:
        workspace = self.db.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        if workspace.owner_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can delete workspace")
        self.db.delete(workspace)
        self.db.commit()
