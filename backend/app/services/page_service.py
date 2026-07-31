from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Block, Page, User
from app.schemas.page import PageCreate, PageUpdate
from app.services.permission_service import PermissionService


class PageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def create(self, user: User, payload: PageCreate) -> Page:
        self.permissions.require_workspace(user, str(payload.workspace_id), "editor")
        if payload.parent_page_id:
            parent = self.permissions.require_page(user, str(payload.parent_page_id), "editor")
            if parent.workspace_id != str(payload.workspace_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent page workspace mismatch")
        page = Page(
            workspace_id=str(payload.workspace_id),
            parent_page_id=str(payload.parent_page_id) if payload.parent_page_id else None,
            title=payload.title.strip() or "Untitled",
            icon=payload.icon,
            cover_url=payload.cover_url,
            order_key=payload.order_key,
            page_font=payload.page_font,
            page_width=payload.page_width,
            small_text=payload.small_text,
            is_locked=payload.is_locked,
            is_favorite=payload.is_favorite,
            created_by=user.id,
            updated_by=user.id,
        )
        self.db.add(page)
        self.db.flush()
        self.db.add(
            Block(
                page_id=page.id,
                type="paragraph",
                content=[],
                props={},
                order_key="a0",
                created_by=user.id,
                updated_by=user.id,
            )
        )
        self.db.commit()
        self.db.refresh(page)
        return page

    def get(self, user: User, page_id: str) -> Page:
        return self.permissions.require_page(user, page_id)

    def list_workspace_pages(self, user: User, workspace_id: str) -> list[Page]:
        self.permissions.require_workspace(user, workspace_id)
        return list(
            self.db.scalars(
                select(Page)
                .where(Page.workspace_id == workspace_id, Page.is_archived.is_(False))
                .order_by(Page.parent_page_id.nullsfirst(), Page.order_key, Page.created_at)
            )
        )

    def list_trashed_pages(self, user: User, workspace_id: str) -> list[Page]:
        self.permissions.require_workspace(user, workspace_id)
        pages = list(
            self.db.scalars(
                select(Page)
                .where(Page.workspace_id == workspace_id, Page.is_archived.is_(True))
                .order_by(Page.updated_at.desc(), Page.created_at.desc())
            )
        )
        archived_ids = {page.id for page in pages}
        return [page for page in pages if not page.parent_page_id or page.parent_page_id not in archived_ids]

    def children(self, user: User, page_id: str) -> list[Page]:
        page = self.permissions.require_page(user, page_id)
        return list(
            self.db.scalars(
                select(Page)
                .where(Page.parent_page_id == page.id, Page.is_archived.is_(False))
                .order_by(Page.order_key, Page.created_at)
            )
        )

    def update(self, user: User, page_id: str, payload: PageUpdate) -> Page:
        page = self.permissions.require_page(user, page_id, "editor")
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            if field == "parent_page_id" and value is not None:
                parent = self.permissions.require_page(user, str(value), "editor")
                if parent.workspace_id != page.workspace_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Parent page workspace mismatch",
                    )
                if parent.id == page.id or self._has_ancestor(parent, page.id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Cannot move a page into itself or its descendants",
                    )
            setattr(page, field, str(value) if field == "parent_page_id" and value else value)
        page.updated_by = user.id
        self.db.commit()
        self.db.refresh(page)
        return page

    def archive(self, user: User, page_id: str) -> None:
        page = self.permissions.require_page(user, page_id, "editor")
        self._set_archive_state(page, True, user.id)
        self.db.commit()

    def restore(self, user: User, page_id: str) -> Page:
        page = self.db.get(Page, page_id)
        if not page:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page not found")
        self.permissions.require_workspace(user, page.workspace_id, "editor")
        self._set_archive_state(page, False, user.id)
        self.db.commit()
        self.db.refresh(page)
        return page

    def permanently_delete(self, user: User, page_id: str) -> int:
        page = self.db.get(Page, page_id)
        if not page or not page.is_archived:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trashed page not found")
        self.permissions.require_workspace(user, page.workspace_id, "editor")
        deleted_count = self._descendant_count(page)
        self.db.delete(page)
        self.db.commit()
        return deleted_count

    def permanently_delete_selected(self, user: User, workspace_id: str, page_ids: list[str]) -> int:
        self.permissions.require_workspace(user, workspace_id, "editor")
        unique_ids = list(dict.fromkeys(page_ids))
        pages = list(
            self.db.scalars(
                select(Page).where(
                    Page.workspace_id == workspace_id,
                    Page.id.in_(unique_ids),
                    Page.is_archived.is_(True),
                )
            )
        )
        if len(pages) != len(unique_ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more trashed pages were not found")

        selected_ids = {page.id for page in pages}
        roots = [page for page in pages if not self._has_selected_ancestor(page, selected_ids)]
        deleted_count = sum(self._descendant_count(page) for page in roots)
        for page in roots:
            self.db.delete(page)
        self.db.commit()
        return deleted_count

    def empty_trash(self, user: User, workspace_id: str) -> int:
        self.permissions.require_workspace(user, workspace_id, "editor")
        pages = list(
            self.db.scalars(
                select(Page).where(Page.workspace_id == workspace_id, Page.is_archived.is_(True))
            )
        )
        archived_ids = {page.id for page in pages}
        roots = [page for page in pages if not page.parent_page_id or page.parent_page_id not in archived_ids]
        for page in roots:
            self.db.delete(page)
        self.db.commit()
        return len(pages)

    def duplicate(self, user: User, page_id: str) -> Page:
        source = self.permissions.require_page(user, page_id, "editor")
        duplicate = Page(
            workspace_id=source.workspace_id,
            parent_page_id=source.parent_page_id,
            title=f"{source.title} copy",
            icon=source.icon,
            cover_url=source.cover_url,
            order_key=f"{source.order_key}z",
            page_font=source.page_font,
            page_width=source.page_width,
            small_text=source.small_text,
            is_locked=False,
            is_favorite=False,
            created_by=user.id,
            updated_by=user.id,
        )
        self.db.add(duplicate)
        self.db.flush()
        blocks = list(
            self.db.scalars(
                select(Block)
                .where(Block.page_id == source.id, Block.archived_at.is_(None))
                .order_by(Block.order_key)
            )
        )
        id_map: dict[str, str] = {}
        for block in blocks:
            copied = Block(
                page_id=duplicate.id,
                parent_block_id=id_map.get(block.parent_block_id),
                type=block.type,
                content=block.content,
                props=block.props,
                order_key=block.order_key,
                created_by=user.id,
                updated_by=user.id,
            )
            self.db.add(copied)
            self.db.flush()
            id_map[block.id] = copied.id
        self.db.commit()
        self.db.refresh(duplicate)
        return duplicate

    @staticmethod
    def tree_from_pages(pages: list[Page]) -> list[dict]:
        nodes = {page.id: {"page": page, "children": []} for page in pages}
        roots: list[dict] = []
        for page in pages:
            node = nodes[page.id]
            if page.parent_page_id and page.parent_page_id in nodes:
                nodes[page.parent_page_id]["children"].append(node)
            else:
                roots.append(node)
        return [PageService._serialize_tree(node) for node in roots]

    def _set_archive_state(self, page: Page, archived: bool, user_id: str) -> None:
        page.is_archived = archived
        page.updated_by = user_id
        children = list(
            self.db.scalars(
                select(Page).where(
                    Page.workspace_id == page.workspace_id,
                    Page.parent_page_id == page.id,
                )
            )
        )
        for child in children:
            self._set_archive_state(child, archived, user_id)

    def _has_ancestor(self, page: Page, ancestor_id: str) -> bool:
        parent_id = page.parent_page_id
        while parent_id:
            if parent_id == ancestor_id:
                return True
            parent = self.db.get(Page, parent_id)
            parent_id = parent.parent_page_id if parent else None
        return False

    def _has_selected_ancestor(self, page: Page, selected_ids: set[str]) -> bool:
        parent_id = page.parent_page_id
        while parent_id:
            if parent_id in selected_ids:
                return True
            parent = self.db.get(Page, parent_id)
            parent_id = parent.parent_page_id if parent else None
        return False

    def _descendant_count(self, page: Page) -> int:
        children = list(self.db.scalars(select(Page).where(Page.parent_page_id == page.id)))
        return 1 + sum(self._descendant_count(child) for child in children)

    @staticmethod
    def _serialize_tree(node: dict) -> dict:
        page: Page = node["page"]
        return {
            "id": page.id,
            "workspace_id": page.workspace_id,
            "parent_page_id": page.parent_page_id,
            "title": page.title,
            "icon": page.icon,
            "cover_url": page.cover_url,
            "order_key": page.order_key,
            "is_archived": page.is_archived,
            "page_font": page.page_font,
            "page_width": page.page_width,
            "small_text": page.small_text,
            "is_locked": page.is_locked,
            "is_favorite": page.is_favorite,
            "created_by": page.created_by,
            "updated_by": page.updated_by,
            "created_at": page.created_at,
            "updated_at": page.updated_at,
            "children": [PageService._serialize_tree(child) for child in node["children"]],
        }

    @staticmethod
    def duplicated_time() -> datetime:
        return datetime.now(UTC)
