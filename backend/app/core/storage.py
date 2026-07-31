from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings


class LocalStorage:
    def __init__(self) -> None:
        settings = get_settings()
        self.root = Path(settings.upload_dir)
        self.root.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile) -> tuple[str, str, int]:
        ext = Path(file.filename or "upload").suffix
        storage_key = f"{uuid4()}{ext}"
        destination = self.root / storage_key
        size = 0
        with destination.open("wb") as handle:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                handle.write(chunk)
        return storage_key, str(destination), size

    def delete(self, storage_key: str) -> None:
        path = self.root / storage_key
        if path.exists():
            path.unlink()
