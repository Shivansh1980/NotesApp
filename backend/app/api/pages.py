from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas.page import (
    PageCreate,
    PageDuplicateResponse,
    PageResponse,
    PageTreeNode,
    PageUpdate,
    TrashDeleteRequest,
    TrashDeleteResponse,
)
from app.services.page_service import PageService


router = APIRouter(tags=["pages"])


@router.post("/pages", response_model=PageResponse, status_code=201)
def create_page(
    payload: PageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PageService(db).create(current_user, payload)


@router.get("/pages/{page_id}", response_model=PageResponse)
def get_page(page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return PageService(db).get(current_user, page_id)


@router.patch("/pages/{page_id}", response_model=PageResponse)
def update_page(
    page_id: str,
    payload: PageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PageService(db).update(current_user, page_id, payload)


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_page(
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    PageService(db).archive(current_user, page_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workspaces/{workspace_id}/pages", response_model=list[PageTreeNode])
def list_workspace_pages(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = PageService(db)
    pages = service.list_workspace_pages(current_user, workspace_id)
    return service.tree_from_pages(pages)


@router.get("/workspaces/{workspace_id}/pages/trash", response_model=list[PageResponse])
def list_trashed_pages(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PageService(db).list_trashed_pages(current_user, workspace_id)


@router.get("/pages/{page_id}/children", response_model=list[PageResponse])
def page_children(page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return PageService(db).children(current_user, page_id)


@router.post("/pages/{page_id}/duplicate", response_model=PageDuplicateResponse)
def duplicate_page(page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    service = PageService(db)
    return {"page": service.duplicate(current_user, page_id), "duplicated_at": service.duplicated_time()}


@router.post("/pages/{page_id}/restore", response_model=PageResponse)
def restore_page(page_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return PageService(db).restore(current_user, page_id)


@router.delete("/pages/{page_id}/permanent", response_model=TrashDeleteResponse)
def permanently_delete_page(
    page_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"deleted_count": PageService(db).permanently_delete(current_user, page_id)}


@router.post("/workspaces/{workspace_id}/pages/trash/permanent-delete", response_model=TrashDeleteResponse)
def permanently_delete_selected_pages(
    workspace_id: str,
    payload: TrashDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {
        "deleted_count": PageService(db).permanently_delete_selected(
            current_user,
            workspace_id,
            [str(page_id) for page_id in payload.page_ids],
        )
    }


@router.delete("/workspaces/{workspace_id}/pages/trash", response_model=TrashDeleteResponse)
def empty_workspace_trash(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"deleted_count": PageService(db).empty_trash(current_user, workspace_id)}
