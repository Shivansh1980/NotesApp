from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import ROLE_ORDER, role_allows
from app.models import Block, Page, PagePermission, User, Workspace, WorkspaceMember


class PermissionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def workspace_role(self, user_id: str, workspace_id: str) -> str | None:
        membership = self.db.scalar(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == user_id,
                WorkspaceMember.workspace_id == workspace_id,
            )
        )
        return membership.role if membership else None

    def page_role(self, user_id: str, page: Page) -> str | None:
        workspace_role = self.workspace_role(user_id, page.workspace_id)
        explicit = self.db.scalar(
            select(PagePermission).where(
                PagePermission.user_id == user_id,
                PagePermission.page_id == page.id,
            )
        )
        if not explicit:
            return workspace_role
        candidates = [role for role in [workspace_role, explicit.role] if role]
        return max(candidates, key=lambda role: ROLE_ORDER.get(role, 0), default=None)

    def require_workspace(self, user: User, workspace_id: str, minimum_role: str = "viewer") -> str:
        workspace = self.db.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        role = self.workspace_role(user.id, workspace_id)
        if not role or not role_allows(role, minimum_role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient workspace role")
        return role

    def require_page(self, user: User, page_id: str, minimum_role: str = "viewer") -> Page:
        page = self.db.get(Page, page_id)
        if not page or page.is_archived:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
        role = self.page_role(user.id, page)
        if not role or not role_allows(role, minimum_role):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient page role")
        return page

    def require_block(self, user: User, block_id: str, minimum_role: str = "viewer") -> Block:
        block = self.db.get(Block, block_id)
        if not block or block.archived_at is not None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
        self.require_page(user, block.page_id, minimum_role)
        return block
