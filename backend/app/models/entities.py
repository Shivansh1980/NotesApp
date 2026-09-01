from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, TypeDecorator

from app.core.database import Base


def new_id() -> str:
    return str(uuid4())


def now_utc() -> datetime:
    return datetime.now(UTC)


JsonType = JSON().with_variant(JSONB, "postgresql")


class UTCDateTime(TypeDecorator[datetime]):
    """Persist instants consistently when SQLite drops timezone metadata."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


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


class PlannerTask(Base, TimestampMixin):
    __tablename__ = "planner_tasks"
    __table_args__ = (
        Index("idx_planner_tasks_workspace_date", "workspace_id", "plan_date"),
        Index("idx_planner_tasks_user_date", "user_id", "plan_date"),
        Index("idx_planner_tasks_series", "series_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    series_id: Mapped[str | None] = mapped_column(String(36))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(UTCDateTime())
    end_time: Mapped[datetime | None] = mapped_column(UTCDateTime())
    status: Mapped[str] = mapped_column(String(20), default="todo", nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="work", nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_minutes_before: Mapped[int | None] = mapped_column(Integer)
    end_warning_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    notify_at_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    recurrence_days: Mapped[list] = mapped_column(JsonType, default=list, nullable=False)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paused_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    total_paused_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


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
