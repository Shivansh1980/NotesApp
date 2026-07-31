from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import AuditFields, ORMModel


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)


class WorkspaceMemberResponse(AuditFields):
    workspace_id: UUID
    user_id: UUID
    role: str


class WorkspaceResponse(AuditFields):
    name: str
    owner_id: UUID


class WorkspaceWithMembers(WorkspaceResponse):
    members: list[WorkspaceMemberResponse] = []


class WorkspaceRole(ORMModel):
    workspace_id: UUID
    role: str
