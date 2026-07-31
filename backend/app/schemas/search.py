from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class SearchResult(BaseModel):
    id: UUID
    type: Literal["page", "block"]
    title: str
    snippet: str
    page_id: UUID | None = None
    workspace_id: UUID
    created_by: UUID | None = None
    updated_at: datetime


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
