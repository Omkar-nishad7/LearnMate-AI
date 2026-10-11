import io
import pytest


async def _mk(client, email, role="STUDENT"):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.asyncio
async def test_upload_list_download_delete(client, tmp_path, monkeypatch):
    # Force LocalStorage into a temp dir for isolation
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    # Clear factory cache so it picks up new path
    from app.services.storage import factory
    factory.get_storage.cache_clear()

    token = await _mk(client, "file_u@example.com", "STUDENT")
    content = b"%PDF-1.4\n%fake-pdf\n"

    r = await client.post(
        "/api/v1/files",
        files={"file": ("essay.pdf", io.BytesIO(content), "application/pdf")},
        data={"category": "pdf"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["original_name"].endswith(".pdf")
    assert body["mime_type"] == "application/pdf"
    fid = body["id"]

    # list
    r = await client.get("/api/v1/files", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["total"] == 1

    # meta
    r = await client.get(f"/api/v1/files/{fid}", headers=_auth(token))
    assert r.status_code == 200

    # download
    r = await client.get(f"/api/v1/files/{fid}/download", headers=_auth(token))
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")

    # delete
    r = await client.delete(f"/api/v1/files/{fid}", headers=_auth(token))
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_upload_rejects_wrong_category(client):
    token = await _mk(client, "file_u2@example.com", "STUDENT")
    r = await client.post(
        "/api/v1/files",
        files={"file": ("notimage.pdf", io.BytesIO(b"%PDF-1.4 x"), "application/pdf")},
        data={"category": "image"},
        headers=_auth(token),
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_other_user_cannot_download_private(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    from app.services.storage import factory
    factory.get_storage.cache_clear()

    t1 = await _mk(client, "file_a@example.com", "STUDENT")
    t2 = await _mk(client, "file_b@example.com", "STUDENT")

    r = await client.post(
        "/api/v1/files",
        files={"file": ("secret.pdf", io.BytesIO(b"%PDF-1.4 s"), "application/pdf")},
        data={"category": "pdf"},
        headers=_auth(t1),
    )
    fid = r.json()["id"]

    r = await client.get(f"/api/v1/files/{fid}/download", headers=_auth(t2))
    assert r.status_code == 403