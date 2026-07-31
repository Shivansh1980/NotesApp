from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Block, Page, User
from app.schemas.search import SearchResult
from app.services.permission_service import PermissionService


class SearchService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionService(db)

    def workspace_search(self, user: User, workspace_id: str, query: str, limit: int = 30) -> list[SearchResult]:
        self.permissions.require_workspace(user, workspace_id)
        normalized = query.strip().lower()
        if not normalized:
            return []

        results: list[SearchResult] = []
        pages = list(
            self.db.scalars(
                select(Page)
                .where(Page.workspace_id == workspace_id, Page.is_archived.is_(False))
                .order_by(Page.updated_at.desc())
            )
        )
        allowed_page_ids = {page.id for page in pages}
        for page in pages:
            if normalized in page.title.lower():
                results.append(
                    SearchResult(
                        id=page.id,
                        type="page",
                        title=page.title,
                        snippet=page.title,
                        page_id=page.id,
                        workspace_id=page.workspace_id,
                        created_by=page.created_by,
                        updated_at=page.updated_at,
                    )
                )

        blocks = list(
            self.db.scalars(
                select(Block)
                .where(Block.page_id.in_(allowed_page_ids), Block.archived_at.is_(None))
                .order_by(Block.updated_at.desc())
            )
        )
        page_titles = {page.id: page.title for page in pages}
        for block in blocks:
            text = self._block_text(block)
            if normalized in text.lower():
                results.append(
                    SearchResult(
                        id=block.id,
                        type="block",
                        title=page_titles.get(block.page_id, "Untitled"),
                        snippet=self._snippet(text, normalized),
                        page_id=block.page_id,
                        workspace_id=workspace_id,
                        created_by=block.created_by,
                        updated_at=block.updated_at,
                    )
                )
            if len(results) >= limit:
                return results[:limit]
        return results[:limit]

    def page_search(self, user: User, page_id: str, query: str, limit: int = 30) -> list[SearchResult]:
        page = self.permissions.require_page(user, page_id)
        normalized = query.strip().lower()
        blocks = list(
            self.db.scalars(
                select(Block)
                .where(Block.page_id == page_id, Block.archived_at.is_(None))
                .order_by(Block.updated_at.desc())
            )
        )
        results: list[SearchResult] = []
        for block in blocks:
            text = self._block_text(block)
            if normalized in text.lower():
                results.append(
                    SearchResult(
                        id=block.id,
                        type="block",
                        title=page.title,
                        snippet=self._snippet(text, normalized),
                        page_id=page.id,
                        workspace_id=page.workspace_id,
                        created_by=block.created_by,
                        updated_at=block.updated_at,
                    )
                )
        return results[:limit]

    @staticmethod
    def _block_text(block: Block) -> str:
        if block.type == "code":
            return str(block.props.get("code", ""))
        if block.type in {"image", "file", "bookmark"}:
            return " ".join(str(block.props.get(key, "")) for key in ("caption", "url", "fileName"))
        return "".join(item.get("text", "") for item in block.content or [])

    @staticmethod
    def _snippet(text: str, query: str) -> str:
        index = text.lower().find(query)
        if index < 0:
            return text[:160]
        start = max(index - 50, 0)
        end = min(index + len(query) + 90, len(text))
        return text[start:end]
