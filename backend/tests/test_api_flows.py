import os

os.environ["DATABASE_URL"] = "sqlite:///./test_notes_app.db"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


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
    assert {duplicate_page_id, nested_page_id}.issubset(trash_ids)
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
