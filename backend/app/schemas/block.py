from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import AuditFields, RichText


MVP_BLOCK_TYPES = {
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list",
    "numbered_list",
    "todo",
    "toggle",
    "quote",
    "callout",
    "divider",
    "math",
    "code",
    "image",
    "file",
    "bookmark",
    "table",
    "subpage",
}


class BlockBase(BaseModel):
    type: str
    content: list[RichText] = Field(default_factory=list)
    props: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        if value not in MVP_BLOCK_TYPES:
            raise ValueError(f"Unsupported block type: {value}")
        return value


class BlockCreate(BlockBase):
    page_id: UUID
    parent_block_id: UUID | None = None
    order_key: str = Field(max_length=255)


class BlockUpdate(BaseModel):
    type: str | None = None
    content: list[RichText] | None = None
    props: dict[str, Any] | None = None
    parent_block_id: UUID | None = None
    order_key: str | None = Field(default=None, max_length=255)

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str | None) -> str | None:
        if value is not None and value not in MVP_BLOCK_TYPES:
            raise ValueError(f"Unsupported block type: {value}")
        return value


class BlockResponse(AuditFields):
    page_id: UUID
    parent_block_id: UUID | None = None
    type: str
    content: list[RichText]
    props: dict[str, Any]
    order_key: str
    created_by: UUID | None = None
    updated_by: UUID | None = None
    archived_at: datetime | None = None


class BlockBulkItem(BaseModel):
    id: UUID
    changes: BlockUpdate


class BlockBulkUpdate(BaseModel):
    blocks: list[BlockBulkItem] = Field(min_length=1)


class BlockReorderRequest(BaseModel):
    block_id: UUID
    parent_block_id: UUID | None = None
    order_key: str


class BlockDuplicateRequest(BaseModel):
    block_id: UUID


class BlockMoveRequest(BaseModel):
    block_id: UUID
    page_id: UUID | None = None
    parent_block_id: UUID | None = None
    order_key: str
