from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.storage import LocalStorage
from app.models import Upload, User
from app.schemas.upload import UploadMetadataCreate
from app.services.permission_service import PermissionService


class UploadService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)
        self.storage = LocalStorage()
        self.settings = get_settings()

    async def save_file(self, user: User, workspace_id: str, file: UploadFile) -> Upload:
        self.permissions.require_workspace(user, workspace_id, "editor")
        if file.content_type not in self.settings.allowed_upload_types:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed")
        storage_key, path, size = await self.storage.save(file)
        if size > self.settings.max_upload_bytes:
            self.storage.delete(storage_key)
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")
        upload = Upload(
            workspace_id=workspace_id,
            uploaded_by=user.id,
            file_name=file.filename or Path(path).name,
            file_type=file.content_type or "application/octet-stream",
            file_size=size,
            storage_key=storage_key,
            public_url=f"/uploads/{storage_key}",
        )
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)
        return upload

    def create_metadata(self, user: User, payload: UploadMetadataCreate) -> Upload:
        self.permissions.require_workspace(user, str(payload.workspace_id), "editor")
        upload = Upload(
            workspace_id=str(payload.workspace_id),
            uploaded_by=user.id,
            file_name=payload.file_name,
            file_type=payload.file_type,
            file_size=payload.file_size,
            storage_key=payload.storage_key,
            public_url=payload.public_url,
        )
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)
        return upload

    def get(self, user: User, upload_id: str) -> Upload:
        upload = self.db.get(Upload, upload_id)
        if not upload:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
        self.permissions.require_workspace(user, upload.workspace_id)
        return upload

    def delete(self, user: User, upload_id: str) -> None:
        upload = self.get(user, upload_id)
        self.permissions.require_workspace(user, upload.workspace_id, "editor")
        self.storage.delete(upload.storage_key)
        self.db.delete(upload)
        self.db.commit()
