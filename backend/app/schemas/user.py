from uuid import UUID

from app.schemas.common import AuditFields


class UserResponse(AuditFields):
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None
