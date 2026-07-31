from dataclasses import dataclass


ROLE_ORDER = {
    "viewer": 10,
    "commenter": 20,
    "editor": 30,
    "admin": 40,
    "owner": 50,
}


@dataclass(frozen=True)
class Capability:
    read: bool
    comment: bool
    edit: bool
    admin: bool


def role_allows(role: str, minimum: str) -> bool:
    return ROLE_ORDER.get(role, 0) >= ROLE_ORDER[minimum]


def capabilities_for(role: str) -> Capability:
    return Capability(
        read=role_allows(role, "viewer"),
        comment=role_allows(role, "commenter"),
        edit=role_allows(role, "editor"),
        admin=role_allows(role, "admin"),
    )
