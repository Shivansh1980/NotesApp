from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Comment, User
from app.schemas.comment import CommentCreate, CommentUpdate
from app.services.permission_service import PermissionService


class CommentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def create(self, user: User, payload: CommentCreate) -> Comment:
        self.permissions.require_page(user, str(payload.page_id), "commenter")
        if payload.block_id:
            block = self.permissions.require_block(user, str(payload.block_id))
            if block.page_id != str(payload.page_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Block page mismatch")
        comment = Comment(
            page_id=str(payload.page_id),
            block_id=str(payload.block_id) if payload.block_id else None,
            user_id=user.id,
            text=payload.text.strip(),
        )
        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def list_for_block(self, user: User, block_id: str) -> list[Comment]:
        block = self.permissions.require_block(user, block_id)
        return list(
            self.db.scalars(
                select(Comment)
                .where(Comment.block_id == block.id)
                .order_by(Comment.resolved.asc(), Comment.created_at.asc())
            )
        )

    def list_for_page(self, user: User, page_id: str) -> list[Comment]:
        page = self.permissions.require_page(user, page_id)
        return list(
            self.db.scalars(
                select(Comment)
                .where(Comment.page_id == page.id)
                .order_by(Comment.resolved.asc(), Comment.created_at.desc())
            )
        )

    def update(self, user: User, comment_id: str, payload: CommentUpdate) -> Comment:
        comment = self.db.get(Comment, comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if comment.user_id != user.id:
            self.permissions.require_page(user, comment.page_id, "editor")
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(comment, field, value.strip() if field == "text" and value else value)
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def delete(self, user: User, comment_id: str) -> None:
        comment = self.db.get(Comment, comment_id)
        if not comment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if comment.user_id != user.id:
            self.permissions.require_page(user, comment.page_id, "editor")
        self.db.delete(comment)
        self.db.commit()
