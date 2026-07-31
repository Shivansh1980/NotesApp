from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.block import (
    BlockBulkUpdate,
    BlockCreate,
    BlockDuplicateRequest,
    BlockMoveRequest,
    BlockReorderRequest,
    BlockResponse,
    BlockUpdate,
)
from app.services.block_service import BlockService


router = APIRouter(tags=["blocks"])


@router.get("/pages/{page_id}/blocks", response_model=list[BlockResponse])
def get_page_blocks(page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return BlockService(db).list_for_page(current_user, page_id)


@router.post("/blocks", response_model=BlockResponse, status_code=201)
def create_block(
    payload: BlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).create(current_user, payload)


@router.patch("/blocks/{block_id}", response_model=BlockResponse)
def update_block(
    block_id: str,
    payload: BlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).update(current_user, block_id, payload)


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_block(
    block_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    BlockService(db).archive(current_user, block_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/blocks/{block_id}/restore", response_model=BlockResponse)
def restore_block(
    block_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).restore(current_user, block_id)


@router.post("/blocks/bulk-update", response_model=list[BlockResponse])
def bulk_update(
    payload: BlockBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).bulk_update(current_user, payload)


@router.post("/blocks/reorder", response_model=BlockResponse)
def reorder_block(
    payload: BlockReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).reorder(current_user, payload)


@router.post("/blocks/duplicate", response_model=BlockResponse)
def duplicate_block(
    payload: BlockDuplicateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).duplicate(current_user, str(payload.block_id))


@router.post("/blocks/move", response_model=BlockResponse)
def move_block(
    payload: BlockMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return BlockService(db).move(current_user, payload)
