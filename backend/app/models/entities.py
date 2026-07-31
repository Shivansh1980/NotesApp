from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base


def new_id() -> str:
    return str(uuid4())


def now_utc() -> datetime:
    return datetime.now(UTC)


JsonType = JSON().with_variant(JSONB, "postgresql")


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))

    memberships: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="user", passive_deletes=True
    )


class CalendarConnection(Base, TimestampMixin):
    __tablename__ = "calendar_connections"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_calendar_connection_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(30), default="google", nullable=False)
    encrypted_access_token: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scopes: Mapped[str] = mapped_column(Text, default="", nullable=False)


class Workspace(Base, TimestampMixin):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    members: Mapped[list["WorkspaceMember"]] = relationship(
        back_populates="workspace", cascade="all, delete-orphan", passive_deletes=True
    )
    pages: Mapped[list["Page"]] = relationship(back_populates="workspace", passive_deletes=True)


class WorkspaceMember(Base, TimestampMixin):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(30), default="viewer", nullable=False)

    workspace: Mapped[Workspace] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Page(Base, TimestampMixin):
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_page_id: Mapped[str | None] = mapped_column(
        ForeignKey("pages.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255), default="Untitled", nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64))
    cover_url: Mapped[str | None] = mapped_column(String(500))
    order_key: Mapped[str] = mapped_column(String(255), default="a0", nullable=False, index=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    page_font: Mapped[str] = mapped_column(String(20), default="default", nullable=False)
    page_width: Mapped[str] = mapped_column(String(20), default="default", nullable=False)
    small_text: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))

    workspace: Mapped[Workspace] = relationship(back_populates="pages")
    blocks: Mapped[list["Block"]] = relationship(
        back_populates="page", cascade="all, delete-orphan", passive_deletes=True
    )


class Block(Base, TimestampMixin):
    __tablename__ = "blocks"
    __table_args__ = (
        Index("idx_blocks_page_id", "page_id"),
        Index("idx_blocks_parent_block_id", "parent_block_id"),
        Index("idx_blocks_order_key", "order_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    page_id: Mapped[str] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    parent_block_id: Mapped[str | None] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[list] = mapped_column(JsonType, default=list, nullable=False)
    props: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    order_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    page: Mapped[Page] = relationship(back_populates="blocks")


class Upload(Base, TimestampMixin):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_size: Mapped[int] = mapped_column(default=0, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    public_url: Mapped[str] = mapped_column(String(500), nullable=False)


class Comment(Base, TimestampMixin):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    page_id: Mapped[str] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    block_id: Mapped[str | None] = mapped_column(ForeignKey("blocks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PagePermission(Base, TimestampMixin):
    __tablename__ = "page_permissions"
    __table_args__ = (UniqueConstraint("page_id", "user_id", name="uq_page_permission"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    page_id: Mapped[str] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(30), default="viewer", nullable=False)
    inherited: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class BlockEvent(Base):
    __tablename__ = "block_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    page_id: Mapped[str] = mapped_column(ForeignKey("pages.id", ondelete="CASCADE"), nullable=False)
    block_id: Mapped[str | None] = mapped_column(ForeignKey("blocks.id", ondelete="SET NULL"))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    before: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    after: Mapped[dict] = mapped_column(JsonType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
