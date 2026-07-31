from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import AuditFields


class PageCreate(BaseModel):
    workspace_id: UUID
    parent_page_id: UUID | None = None
    title: str = Field(default="Untitled", max_length=255)
    icon: str | None = Field(default=None, max_length=64)
    cover_url: str | None = Field(default=None, max_length=500)
    order_key: str = Field(default="a0", max_length=255)
    page_font: Literal["default", "serif", "mono"] = "default"
    page_width: Literal["default", "wide", "full"] = "default"
    small_text: bool = False
    is_locked: bool = False
    is_favorite: bool = False


class PageUpdate(BaseModel):
    parent_page_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=64)
    cover_url: str | None = Field(default=None, max_length=500)
    order_key: str | None = Field(default=None, max_length=255)
    is_archived: bool | None = None
    page_font: Literal["default", "serif", "mono"] | None = None
    page_width: Literal["default", "wide", "full"] | None = None
    small_text: bool | None = None
    is_locked: bool | None = None
    is_favorite: bool | None = None


class PageResponse(AuditFields):
    workspace_id: UUID
    parent_page_id: UUID | None = None
    title: str
    icon: str | None = None
    cover_url: str | None = None
    order_key: str
    is_archived: bool
    page_font: Literal["default", "serif", "mono"]
    page_width: Literal["default", "wide", "full"]
    small_text: bool
    is_locked: bool
    is_favorite: bool
    created_by: UUID | None = None
    updated_by: UUID | None = None


class PageTreeNode(PageResponse):
    children: list["PageTreeNode"] = []


class PageDuplicateResponse(BaseModel):
    page: PageResponse
    duplicated_at: datetime


class TrashDeleteRequest(BaseModel):
    page_ids: list[UUID] = Field(min_length=1, max_length=200)


class TrashDeleteResponse(BaseModel):
    deleted_count: int
