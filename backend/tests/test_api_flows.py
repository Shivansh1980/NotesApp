import asyncio
import os
import tempfile
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import httpx

test_database_path = Path(tempfile.gettempdir()) / f"notes-app-test-{uuid4()}.db"
os.environ["DATABASE_URL"] = f"sqlite:///{test_database_path.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import decode_token  # noqa: E402
from app.main import app  # noqa: E402
from app.models import CalendarConnection, User  # noqa: E402
from app.services import calendar_service  # noqa: E402
from app.services.calendar_service import (  # noqa: E402
    CalendarService,
    _request_with_transport_fallback,
)


client = TestClient(app)


def setup_function() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers(email: str = "user@example.com") -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "name": "Test User"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def register_user(email: str = "full@example.com") -> tuple[dict, dict[str, str]]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password123", "name": "Full User"},
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    return payload, {"Authorization": f"Bearer {payload['access_token']}"}


def test_auth_workspace_page_block_search_and_comments_flow() -> None:
    headers = auth_headers()

    workspaces = client.get("/api/workspaces", headers=headers)
    assert workspaces.status_code == 200
    workspace_id = workspaces.json()[0]["id"]

    page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Engineering Notes", "order_key": "a1"},
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]

    blocks = client.get(f"/api/pages/{page_id}/blocks", headers=headers)
    assert blocks.status_code == 200
    first_block_id = blocks.json()[0]["id"]

    updated = client.patch(
        f"/api/blocks/{first_block_id}",
        headers=headers,
        json={
            "type": "heading_1",
            "content": [{"text": "Launch plan", "marks": {"bold": True}}],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["type"] == "heading_1"

    created = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "code",
            "content": [],
            "props": {"language": "python", "code": "print('ok')", "wrap": False},
            "order_key": "a2",
        },
    )
    assert created.status_code == 201, created.text

    duplicate = client.post("/api/blocks/duplicate", headers=headers, json={"block_id": created.json()["id"]})
    assert duplicate.status_code == 200
    assert duplicate.json()["props"]["code"] == "print('ok')"

    search = client.get(f"/api/search?workspace_id={workspace_id}&q=Launch", headers=headers)
    assert search.status_code == 200
    assert search.json()["results"][0]["type"] in {"page", "block"}

    comment = client.post(
        "/api/comments",
        headers=headers,
        json={"page_id": page_id, "block_id": first_block_id, "text": "Needs detail"},
    )
    assert comment.status_code == 201
    comments = client.get(f"/api/blocks/{first_block_id}/comments", headers=headers)
    assert comments.status_code == 200
    assert comments.json()[0]["text"] == "Needs detail"


def test_viewer_cannot_edit_workspace_pages() -> None:
    owner_headers = auth_headers("owner@example.com")
    viewer_headers = auth_headers("viewer@example.com")

    workspace_id = client.get("/api/workspaces", headers=owner_headers).json()[0]["id"]
    forbidden = client.post(
        "/api/pages",
        headers=viewer_headers,
        json={"workspace_id": workspace_id, "title": "Blocked", "order_key": "a1"},
    )
    assert forbidden.status_code in {403, 404}


def test_page_blocks_are_returned_in_visual_order_key_sequence() -> None:
    headers = auth_headers("order@example.com")
    workspace_id = client.get("/api/workspaces", headers=headers).json()[0]["id"]
    page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Ordering", "order_key": "a1"},
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]

    parent = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "Parent", "marks": {}}],
            "props": {},
            "order_key": "a1",
        },
    )
    assert parent.status_code == 201, parent.text
    child = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "parent_block_id": parent.json()["id"],
            "type": "math",
            "content": [{"text": "x = y", "marks": {}}],
            "props": {"latex": "x = y"},
            "order_key": "a1U",
        },
    )
    assert child.status_code == 201, child.text
    after = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "After", "marks": {}}],
            "props": {},
            "order_key": "a2",
        },
    )
    assert after.status_code == 201, after.text
    custom_alphabet_before_unknown = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "Custom alphabet", "marks": {}}],
            "props": {},
            "order_key": "aA",
        },
    )
    assert custom_alphabet_before_unknown.status_code == 201, custom_alphabet_before_unknown.text
    unknown_order_character = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "Unknown order character", "marks": {}}],
            "props": {},
            "order_key": "a:",
        },
    )
    assert unknown_order_character.status_code == 201, unknown_order_character.text

    blocks = client.get(f"/api/pages/{page_id}/blocks", headers=headers)
    assert blocks.status_code == 200, blocks.text
    visible_text = [
        item["props"].get("latex") or (item["content"][0]["text"] if item["content"] else "")
        for item in blocks.json()
    ]
    assert visible_text == ["", "Parent", "x = y", "After", "Custom alphabet", "Unknown order character"]


def test_populated_workspace_delete_cascades_all_owned_content() -> None:
    headers = auth_headers("cascade@example.com")
    workspace_id = client.get("/api/workspaces", headers=headers).json()[0]["id"]
    page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Cascade test", "order_key": "a1"},
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]
    block_id = client.get(f"/api/pages/{page_id}/blocks", headers=headers).json()[0]["id"]

    comment = client.post(
        "/api/comments",
        headers=headers,
        json={"page_id": page_id, "block_id": block_id, "text": "Delete with workspace"},
    )
    assert comment.status_code == 201, comment.text
    upload = client.post(
        "/api/uploads/metadata",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "file_name": "cascade.txt",
            "file_type": "text/plain",
            "file_size": 7,
            "storage_key": "manual/cascade.txt",
            "public_url": "/uploads/manual/cascade.txt",
        },
    )
    assert upload.status_code == 201, upload.text

    deleted = client.delete(f"/api/workspaces/{workspace_id}", headers=headers)
    assert deleted.status_code == 204, deleted.text

    with engine.connect() as connection:
        for table, column in (
            ("workspace_members", "workspace_id"),
            ("pages", "workspace_id"),
            ("uploads", "workspace_id"),
        ):
            count = connection.execute(
                text(f"SELECT COUNT(*) FROM {table} WHERE {column} = :workspace_id"),
                {"workspace_id": workspace_id},
            ).scalar_one()
            assert count == 0
        assert connection.execute(
            text("SELECT COUNT(*) FROM blocks WHERE page_id = :page_id"),
            {"page_id": page_id},
        ).scalar_one() == 0
        assert connection.execute(
            text("SELECT COUNT(*) FROM comments WHERE page_id = :page_id"),
            {"page_id": page_id},
        ).scalar_one() == 0


def test_full_declared_api_surface() -> None:
    token, headers = register_user()

    login = client.post("/api/auth/login", json={"email": "full@example.com", "password": "password123"})
    assert login.status_code == 200
    refresh = client.post("/api/auth/refresh", json={"refresh_token": token["refresh_token"]})
    assert refresh.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert client.post("/api/auth/logout", headers=headers).status_code == 200

    workspace = client.get("/api/workspaces", headers=headers).json()[0]
    workspace_id = workspace["id"]
    updated_workspace = client.patch(
        f"/api/workspaces/{workspace_id}",
        headers=headers,
        json={"name": "Renamed workspace"},
    )
    assert updated_workspace.status_code == 200
    assert client.get(f"/api/workspaces/{workspace_id}", headers=headers).status_code == 200

    throwaway_workspace = client.post("/api/workspaces", headers=headers, json={"name": "Throwaway"})
    assert throwaway_workspace.status_code == 201
    assert client.delete(f"/api/workspaces/{throwaway_workspace.json()['id']}", headers=headers).status_code == 204

    page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "API Surface", "order_key": "a1"},
    )
    assert page.status_code == 201
    page_id = page.json()["id"]
    assert client.get(f"/api/pages/{page_id}", headers=headers).status_code == 200
    assert client.get(f"/api/workspaces/{workspace_id}/pages", headers=headers).status_code == 200
    assert client.get(f"/api/pages/{page_id}/children", headers=headers).status_code == 200

    renamed = client.patch(
        f"/api/pages/{page_id}",
        headers=headers,
        json={
            "title": "API Surface Updated",
            "page_font": "serif",
            "page_width": "full",
            "small_text": True,
            "is_locked": True,
            "is_favorite": True,
        },
    )
    assert renamed.status_code == 200
    assert {
        "page_font": renamed.json()["page_font"],
        "page_width": renamed.json()["page_width"],
        "small_text": renamed.json()["small_text"],
        "is_locked": renamed.json()["is_locked"],
        "is_favorite": renamed.json()["is_favorite"],
    } == {
        "page_font": "serif",
        "page_width": "full",
        "small_text": True,
        "is_locked": True,
        "is_favorite": True,
    }
    duplicated_page = client.post(f"/api/pages/{page_id}/duplicate", headers=headers)
    assert duplicated_page.status_code == 200
    duplicate_page_id = duplicated_page.json()["page"]["id"]
    nested_page = client.post(
        "/api/pages",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "parent_page_id": duplicate_page_id,
            "title": "Nested duplicate child",
            "order_key": "a1",
        },
    )
    assert nested_page.status_code == 201
    nested_page_id = nested_page.json()["id"]
    assert client.delete(f"/api/pages/{duplicate_page_id}", headers=headers).status_code == 204
    trash = client.get(f"/api/workspaces/{workspace_id}/pages/trash", headers=headers)
    assert trash.status_code == 200
    trash_ids = {item["id"] for item in trash.json()}
    assert trash_ids == {duplicate_page_id}
    assert client.get(f"/api/pages/{nested_page_id}", headers=headers).status_code == 404
    assert client.post(f"/api/pages/{duplicate_page_id}/restore", headers=headers).status_code == 200
    assert client.get(f"/api/pages/{nested_page_id}", headers=headers).status_code == 200
    cycle_move = client.patch(
        f"/api/pages/{duplicate_page_id}",
        headers=headers,
        json={"parent_page_id": nested_page_id},
    )
    assert cycle_move.status_code == 400

    blocks = client.get(f"/api/pages/{page_id}/blocks", headers=headers).json()
    first_block_id = blocks[0]["id"]
    assert client.delete(f"/api/blocks/{first_block_id}", headers=headers).status_code == 204
    restored_block = client.post(f"/api/blocks/{first_block_id}/restore", headers=headers)
    assert restored_block.status_code == 200
    assert restored_block.json()["id"] == first_block_id
    created_block = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "Block API", "marks": {}}],
            "props": {},
            "order_key": "a2",
        },
    )
    assert created_block.status_code == 201
    created_block_id = created_block.json()["id"]
    bulk = client.post(
        "/api/blocks/bulk-update",
        headers=headers,
        json={
            "blocks": [
                {"id": first_block_id, "changes": {"type": "heading_2"}},
                {"id": created_block_id, "changes": {"props": {"indent": 1}}},
            ]
        },
    )
    assert bulk.status_code == 200
    assert client.post(
        "/api/blocks/reorder",
        headers=headers,
        json={"block_id": created_block_id, "parent_block_id": None, "order_key": "a3"},
    ).status_code == 200
    assert client.post(
        "/api/blocks/move",
        headers=headers,
        json={"block_id": created_block_id, "page_id": duplicate_page_id, "parent_block_id": None, "order_key": "a4"},
    ).status_code == 200
    assert client.delete(f"/api/blocks/{first_block_id}", headers=headers).status_code == 204

    upload = client.post(
        "/api/uploads/metadata",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "file_name": "note.txt",
            "file_type": "text/plain",
            "file_size": 12,
            "storage_key": "manual/note.txt",
            "public_url": "/uploads/manual/note.txt",
        },
    )
    assert upload.status_code == 201
    upload_id = upload.json()["id"]
    assert client.get(f"/api/uploads/{upload_id}", headers=headers).status_code == 200
    assert client.delete(f"/api/uploads/{upload_id}", headers=headers).status_code == 204

    comment = client.post(
        "/api/comments",
        headers=headers,
        json={"page_id": duplicate_page_id, "block_id": created_block_id, "text": "Follow up"},
    )
    assert comment.status_code == 201
    comment_id = comment.json()["id"]
    assert client.get(f"/api/blocks/{created_block_id}/comments", headers=headers).status_code == 200
    page_comments = client.get(f"/api/pages/{duplicate_page_id}/comments", headers=headers)
    assert page_comments.status_code == 200
    assert [item["id"] for item in page_comments.json()] == [comment_id]
    assert client.patch(f"/api/comments/{comment_id}", headers=headers, json={"resolved": True}).status_code == 200
    assert client.delete(f"/api/comments/{comment_id}", headers=headers).status_code == 204

    workspace_search = client.get(f"/api/search?workspace_id={workspace_id}&q=API", headers=headers)
    assert workspace_search.status_code == 200
    assert all("created_by" in result for result in workspace_search.json()["results"])
    assert client.get(f"/api/pages/{duplicate_page_id}/search?q=Block", headers=headers).status_code == 200


def test_workspace_search_returns_one_exact_destination_per_page_and_never_crosses_workspaces() -> None:
    owner_payload, owner_headers = register_user("search-owner@example.com")
    _, outsider_headers = register_user("search-outsider@example.com")
    workspace_id = client.get("/api/workspaces", headers=owner_headers).json()[0]["id"]

    page = client.post(
        "/api/pages",
        headers=owner_headers,
        json={"workspace_id": workspace_id, "title": "Vector notes", "order_key": "a1"},
    )
    assert page.status_code == 201, page.text
    page_id = page.json()["id"]
    default_block = client.get(f"/api/pages/{page_id}/blocks", headers=owner_headers).json()[0]
    first_match = client.patch(
        f"/api/blocks/{default_block['id']}",
        headers=owner_headers,
        json={"content": [{"text": "Exact target phrase is here", "marks": {}}]},
    )
    assert first_match.status_code == 200, first_match.text
    second_match = client.post(
        "/api/blocks",
        headers=owner_headers,
        json={
            "page_id": page_id,
            "type": "paragraph",
            "content": [{"text": "Another exact target phrase", "marks": {}}],
            "props": {},
            "order_key": "a2",
        },
    )
    assert second_match.status_code == 201, second_match.text

    search = client.get(
        f"/api/search?workspace_id={workspace_id}&q=exact%20target",
        headers=owner_headers,
    )
    assert search.status_code == 200, search.text
    results = search.json()["results"]
    assert len(results) == 1
    assert results[0]["type"] == "block"
    assert results[0]["page_id"] == page_id
    assert results[0]["id"] in {first_match.json()["id"], second_match.json()["id"]}
    assert "exact target" in results[0]["snippet"].casefold()
    assert results[0]["created_by"] == owner_payload["user"]["id"]

    title_search = client.get(
        f"/api/search?workspace_id={workspace_id}&q=vector",
        headers=owner_headers,
    )
    assert title_search.status_code == 200, title_search.text
    assert [(item["type"], item["id"]) for item in title_search.json()["results"]] == [("page", page_id)]

    forbidden = client.get(
        f"/api/search?workspace_id={workspace_id}&q=exact",
        headers=outsider_headers,
    )
    assert forbidden.status_code == 403

    archived = client.delete(f"/api/pages/{page_id}", headers=owner_headers)
    assert archived.status_code == 204
    hidden = client.get(
        f"/api/search?workspace_id={workspace_id}&q=exact",
        headers=owner_headers,
    )
    assert hidden.status_code == 200
    assert hidden.json()["results"] == []


def test_search_indexes_math_and_tables_without_duplicate_page_results() -> None:
    headers = auth_headers("structured-search@example.com")
    workspace_id = client.get("/api/workspaces", headers=headers).json()[0]["id"]

    math_page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Equations", "order_key": "a1"},
    ).json()
    math_block = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": math_page["id"],
            "type": "math",
            "content": [],
            "props": {"latex": "softmax(z_i) = e^{z_i} / sum_j e^{z_j}"},
            "order_key": "a2",
        },
    )
    assert math_block.status_code == 201, math_block.text

    table_page = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Metrics", "order_key": "a2"},
    ).json()
    table_block = client.post(
        "/api/blocks",
        headers=headers,
        json={
            "page_id": table_page["id"],
            "type": "table",
            "content": [],
            "props": {"rows": [["model", "precision"], ["alpha", "0.98"]]},
            "order_key": "a2",
        },
    )
    assert table_block.status_code == 201, table_block.text

    math_search = client.get(
        f"/api/search?workspace_id={workspace_id}&q=softmax",
        headers=headers,
    )
    assert math_search.status_code == 200
    assert [(item["page_id"], item["id"]) for item in math_search.json()["results"]] == [
        (math_page["id"], math_block.json()["id"])
    ]

    table_search = client.get(
        f"/api/search?workspace_id={workspace_id}&q=precision",
        headers=headers,
    )
    assert table_search.status_code == 200
    assert [(item["page_id"], item["id"]) for item in table_search.json()["results"]] == [
        (table_page["id"], table_block.json()["id"])
    ]


def test_trash_lists_roots_and_supports_selected_and_full_permanent_deletion() -> None:
    headers = auth_headers("trash@example.com")
    workspace_id = client.get("/api/workspaces", headers=headers).json()[0]["id"]

    parent = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Parent", "order_key": "a1"},
    ).json()
    child = client.post(
        "/api/pages",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "parent_page_id": parent["id"],
            "title": "Child",
            "order_key": "a1",
        },
    ).json()
    standalone = client.post(
        "/api/pages",
        headers=headers,
        json={"workspace_id": workspace_id, "title": "Standalone", "order_key": "a2"},
    ).json()
    assert client.delete(f"/api/pages/{parent['id']}", headers=headers).status_code == 204
    assert client.delete(f"/api/pages/{standalone['id']}", headers=headers).status_code == 204

    trash = client.get(f"/api/workspaces/{workspace_id}/pages/trash", headers=headers)
    assert trash.status_code == 200
    assert {item["id"] for item in trash.json()} == {parent["id"], standalone["id"]}

    selected = client.post(
        f"/api/workspaces/{workspace_id}/pages/trash/permanent-delete",
        headers=headers,
        json={"page_ids": [parent["id"], child["id"]]},
    )
    assert selected.status_code == 200, selected.text
    assert selected.json()["deleted_count"] == 2
    assert client.get(f"/api/pages/{parent['id']}", headers=headers).status_code == 404

    emptied = client.delete(f"/api/workspaces/{workspace_id}/pages/trash", headers=headers)
    assert emptied.status_code == 200, emptied.text
    assert emptied.json()["deleted_count"] == 1
    assert client.get(f"/api/workspaces/{workspace_id}/pages/trash", headers=headers).json() == []


def test_google_calendar_is_private_and_reports_missing_configuration() -> None:
    headers = auth_headers("calendar@example.com")
    status_response = client.get("/api/integrations/google-calendar/status", headers=headers)
    assert status_response.status_code == 200
    assert status_response.json() == {"configured": False, "connected": False, "provider": "google"}
    assert client.post("/api/integrations/google-calendar/authorize", headers=headers).status_code == 503
    assert client.get("/api/integrations/google-calendar/events", headers=headers).status_code == 409
    assert client.delete("/api/integrations/google-calendar", headers=headers).status_code == 204
    assert client.get("/api/integrations/google-calendar/status").status_code == 401


def test_google_calendar_uses_signed_state_and_encrypts_stored_tokens(monkeypatch) -> None:
    registration, _ = register_user("calendar-oauth@example.com")
    user_id = registration["user"]["id"]
    settings = get_settings()
    monkeypatch.setattr(settings, "google_calendar_client_id", "client-id.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "google_calendar_client_secret", "client-secret")
    monkeypatch.setattr(
        settings,
        "google_calendar_redirect_uri",
        "https://api.example.com/api/integrations/google-calendar/callback",
    )

    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        service = CalendarService(db)
        authorization_url = service.authorization_url(user)
        query = parse_qs(urlparse(authorization_url).query)
        assert query["client_id"] == ["client-id.apps.googleusercontent.com"]
        assert query["access_type"] == ["offline"]
        assert query["scope"] == ["https://www.googleapis.com/auth/calendar.readonly"]
        assert decode_token(query["state"][0], expected_type="google_calendar") == user_id

        async def fake_post_token(_: dict[str, object]) -> dict[str, object]:
            return {
                "access_token": "plain-access-token",
                "refresh_token": "plain-refresh-token",
                "expires_in": 3600,
                "scope": "https://www.googleapis.com/auth/calendar.readonly",
            }

        monkeypatch.setattr(service, "_post_token", fake_post_token)
        asyncio.run(service.connect("authorization-code", query["state"][0]))

        connection = db.query(CalendarConnection).filter_by(user_id=user_id, provider="google").one()
        assert connection.encrypted_access_token != "plain-access-token"
        assert connection.encrypted_refresh_token != "plain-refresh-token"
        assert service._decrypt(connection.encrypted_access_token) == "plain-access-token"
        assert service._decrypt(connection.encrypted_refresh_token or "") == "plain-refresh-token"
        assert service.status(user)["connected"] is True


def test_google_calendar_retries_with_sync_transport_after_async_connect_error(monkeypatch) -> None:
    request = httpx.Request("GET", "https://www.googleapis.com/calendar/v3/calendars/primary/events")
    expected_response = httpx.Response(200, json={"items": []}, request=request)
    sync_calls: list[tuple[str, str, float]] = []

    class FailingAsyncClient:
        def __init__(self, **_: object) -> None:
            pass

        async def __aenter__(self) -> "FailingAsyncClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            return None

        async def request(self, method: str, url: str, **_: object) -> httpx.Response:
            raise httpx.ConnectError("async transport unavailable", request=httpx.Request(method, url))

    def fake_sync_request(method: str, url: str, timeout: float, _: dict[str, object]) -> httpx.Response:
        sync_calls.append((method, url, timeout))
        return expected_response

    monkeypatch.setattr(calendar_service.httpx, "AsyncClient", FailingAsyncClient)
    monkeypatch.setattr(calendar_service, "_sync_request", fake_sync_request)

    response = asyncio.run(
        _request_with_transport_fallback(
            "GET",
            str(request.url),
            timeout=15,
            headers={"Authorization": "Bearer redacted"},
        )
    )

    assert response is expected_response
    assert sync_calls == [("GET", str(request.url), 15)]
