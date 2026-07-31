from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.upload import UploadMetadataCreate, UploadResponse
from app.services.upload_service import UploadService


router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_file(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await UploadService(db).save_file(current_user, workspace_id, file)


@router.post("/metadata", response_model=UploadResponse, status_code=201)
def create_upload_metadata(
    payload: UploadMetadataCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return UploadService(db).create_metadata(current_user, payload)


@router.get("/{upload_id}", response_model=UploadResponse)
def get_upload(upload_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return UploadService(db).get(current_user, upload_id)


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    UploadService(db).delete(current_user, upload_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
