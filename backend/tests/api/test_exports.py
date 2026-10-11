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
async def test_export_note_pdf(client, tmp_path, monkeypatch):
    monkeypatch.setenv("LOCAL_STORAGE_PATH", str(tmp_path))
    from app.services.storage import factory
    factory.get_storage.cache_clear()

    token = await _mk(client, "exp_u@example.com", "STUDENT")

    # Create a note via the DB directly through AI endpoint is overkill; use raw insert via ORM
    # Instead, call the notes endpoint if it exists; if not, insert via test session.
    from tests.conftest import TestSession
    from app.repositories.note_repository import NoteRepository
    async with TestSession() as db:
        from app.repositories.user_repository import UserRepository
        user = await UserRepository(db).get_by_email("exp_u@example.com")
        note = await NoteRepository(db).create(
            user_id=user.id, title="My Note",
            content="Hello **world**.\n\nSecond paragraph.",
            tags={"key_terms": [{"term": "foo", "definition": "bar"}]},
        )
        await db.commit()
        note_id = note.id

    r = await client.post(
        "/api/v1/exports/notes",
        json={"note_id": note_id},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mime_type"] == "application/pdf"
    assert body["size_bytes"] > 100
    assert body["file_id"] > 0

    # download the generated PDF
    r = await client.get(
        f"/api/v1/files/{body['file_id']}/download", headers=_auth(token)
    )
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")