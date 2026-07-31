from copy import deepcopy
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Block, BlockEvent, Page, User
from app.schemas.block import (
    BlockBulkUpdate,
    BlockCreate,
    BlockMoveRequest,
    BlockReorderRequest,
    BlockUpdate,
)
from app.services.permission_service import PermissionService


ORDER_KEY_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
ORDER_KEY_RANKS = {character: index for index, character in enumerate(ORDER_KEY_ALPHABET)}


def _order_key_sort_tuple(value: str | None) -> tuple[int, ...]:
    if not value:
        return tuple()

    return tuple(
        ORDER_KEY_RANKS.get(character, len(ORDER_KEY_ALPHABET) + ord(character))
        for character in value
    )


def _created_at_sort_value(block: Block) -> str:
    if not block.created_at:
        return ""
    return block.created_at.isoformat()


class BlockService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def list_for_page(self, user: User, page_id: str) -> list[Block]:
        self.permissions.require_page(user, page_id)
        blocks = list(
            self.db.scalars(
                select(Block).where(Block.page_id == page_id, Block.archived_at.is_(None))
            )
        )
        return sorted(
            blocks,
            key=lambda block: (
                _order_key_sort_tuple(block.order_key),
                _created_at_sort_value(block),
                str(block.id),
            ),
        )

    def create(self, user: User, payload: BlockCreate) -> Block:
        page = self.permissions.require_page(user, str(payload.page_id), "editor")
        if payload.parent_block_id:
            parent = self.permissions.require_block(user, str(payload.parent_block_id), "editor")
            if parent.page_id != page.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent block page mismatch")
        block = Block(
            page_id=page.id,
            parent_block_id=str(payload.parent_block_id) if payload.parent_block_id else None,
            type=payload.type,
            content=[item.model_dump() for item in payload.content],
            props=payload.props,
            order_key=payload.order_key,
            created_by=user.id,
            updated_by=user.id,
        )
        self.db.add(block)
        self.db.flush()
        self._event(block, user, "block_created", {}, self._snapshot(block))
        self.db.commit()
        self.db.refresh(block)
        return block

    def update(self, user: User, block_id: str, payload: BlockUpdate) -> Block:
        block = self.permissions.require_block(user, block_id, "editor")
        before = self._snapshot(block)
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            if field == "content" and value is not None:
                value = [item if isinstance(item, dict) else item.model_dump() for item in value]
            if field == "parent_block_id" and value is not None:
                parent = self.permissions.require_block(user, str(value), "editor")
                if parent.page_id != block.page_id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent block page mismatch")
                value = str(value)
            setattr(block, field, value)
        block.updated_by = user.id
        self._event(block, user, "block_updated", before, self._snapshot(block))
        self.db.commit()
        self.db.refresh(block)
        return block

    def bulk_update(self, user: User, payload: BlockBulkUpdate) -> list[Block]:
        updated: list[Block] = []
        for item in payload.blocks:
            updated.append(self.update(user, str(item.id), item.changes))
        return updated

    def archive(self, user: User, block_id: str) -> None:
        block = self.permissions.require_block(user, block_id, "editor")
        before = self._snapshot(block)
        block.archived_at = datetime.now(UTC)
        block.updated_by = user.id
        self._event(block, user, "block_deleted", before, self._snapshot(block))
        self.db.commit()

    def restore(self, user: User, block_id: str) -> Block:
        block = self.db.get(Block, block_id)
        if not block:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
        page = self.permissions.require_page(user, block.page_id, "editor")
        if block.parent_block_id:
            parent = self.db.get(Block, block.parent_block_id)
            if parent and parent.archived_at is not None:
                parent.archived_at = None
                parent.updated_by = user.id
        before = self._snapshot(block)
        block.page_id = page.id
        block.archived_at = None
        block.updated_by = user.id
        self._event(block, user, "block_restored", before, self._snapshot(block))
        self.db.commit()
        self.db.refresh(block)
        return block

    def reorder(self, user: User, payload: BlockReorderRequest) -> Block:
        return self.update(
            user,
            str(payload.block_id),
            BlockUpdate(parent_block_id=payload.parent_block_id, order_key=payload.order_key),
        )

    def move(self, user: User, payload: BlockMoveRequest) -> Block:
        block = self.permissions.require_block(user, str(payload.block_id), "editor")
        target_page = block.page_id
        if payload.page_id:
            page = self.permissions.require_page(user, str(payload.page_id), "editor")
            target_page = page.id
        if payload.parent_block_id:
            parent = self.permissions.require_block(user, str(payload.parent_block_id), "editor")
            if parent.page_id != target_page:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent block page mismatch")
        before = self._snapshot(block)
        block.page_id = target_page
        block.parent_block_id = str(payload.parent_block_id) if payload.parent_block_id else None
        block.order_key = payload.order_key
        block.updated_by = user.id
        self._event(block, user, "block_moved", before, self._snapshot(block))
        self.db.commit()
        self.db.refresh(block)
        return block

    def duplicate(self, user: User, block_id: str) -> Block:
        source = self.permissions.require_block(user, block_id, "editor")
        copied = self._copy_tree(user, source, source.parent_block_id, f"{source.order_key}z")
        self.db.commit()
        self.db.refresh(copied)
        return copied

    def _copy_tree(self, user: User, source: Block, parent_block_id: str | None, order_key: str) -> Block:
        copied = Block(
            page_id=source.page_id,
            parent_block_id=parent_block_id,
            type=source.type,
            content=deepcopy(source.content),
            props=deepcopy(source.props),
            order_key=order_key,
            created_by=user.id,
            updated_by=user.id,
        )
        self.db.add(copied)
        self.db.flush()
        children = list(
            self.db.scalars(
                select(Block)
                .where(Block.parent_block_id == source.id, Block.archived_at.is_(None))
                .order_by(Block.order_key)
            )
        )
        for child in children:
            self._copy_tree(user, child, copied.id, child.order_key)
        self._event(copied, user, "block_duplicated", {}, self._snapshot(copied))
        return copied

    def _event(self, block: Block, user: User, event_type: str, before: dict, after: dict) -> None:
        self.db.add(
            BlockEvent(
                page_id=block.page_id,
                block_id=block.id,
                user_id=user.id,
                event_type=event_type,
                before=before,
                after=after,
            )
        )

    @staticmethod
    def _snapshot(block: Block) -> dict:
        return {
            "id": block.id,
            "page_id": block.page_id,
            "parent_block_id": block.parent_block_id,
            "type": block.type,
            "content": deepcopy(block.content),
            "props": deepcopy(block.props),
            "order_key": block.order_key,
        }
