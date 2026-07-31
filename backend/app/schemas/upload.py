from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import AuditFields


class UploadMetadataCreate(BaseModel):
    workspace_id: UUID
    file_name: str = Field(min_length=1, max_length=255)
    file_type: str = Field(min_length=1, max_length=120)
    file_size: int = Field(ge=0)
    storage_key: str = Field(min_length=1, max_length=500)
    public_url: str = Field(min_length=1, max_length=500)


class UploadResponse(AuditFields):
    workspace_id: UUID
    uploaded_by: UUID
    file_name: str
    file_type: str
    file_size: int
    storage_key: str
    public_url: str
