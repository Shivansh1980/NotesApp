from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import AuditFields


class CommentCreate(BaseModel):
    page_id: UUID
    block_id: UUID | None = None
    text: str = Field(min_length=1, max_length=4000)


class CommentUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=4000)
    resolved: bool | None = None


class CommentResponse(AuditFields):
    page_id: UUID
    block_id: UUID | None = None
    user_id: UUID
    text: str
    resolved: bool
