from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.services.comment_service import CommentService


router = APIRouter(tags=["comments"])


@router.post("/comments", response_model=CommentResponse, status_code=201)
def create_comment(
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).create(current_user, payload)


@router.get("/blocks/{block_id}/comments", response_model=list[CommentResponse])
def list_comments(
    block_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).list_for_block(current_user, block_id)


@router.get("/pages/{page_id}/comments", response_model=list[CommentResponse])
def list_page_comments(
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).list_for_page(current_user, page_id)


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: str,
    payload: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CommentService(db).update(current_user, comment_id, payload)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    CommentService(db).delete(current_user, comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
