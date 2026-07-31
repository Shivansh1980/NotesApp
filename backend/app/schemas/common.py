from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RichTextMark(BaseModel):
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strike: bool = False
    code: bool = False
    color: str = "default"
    backgroundColor: str = "default"
    link: str | None = None


class RichText(BaseModel):
    text: str = ""
    marks: RichTextMark = Field(default_factory=RichTextMark)


class AuditFields(ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


JsonDict = dict[str, Any]
