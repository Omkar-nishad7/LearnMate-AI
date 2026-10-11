import pytest


async def _mk(client, email, role):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.asyncio
async def test_teacher_cannot_modify_other_teachers_course(client):
    t1 = await _mk(client, "own@example.com", "TEACHER")
    t2 = await _mk(client, "intruder@example.com", "TEACHER")

    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "T1 Course"}, headers=_auth(t1)
    )
    cid = r.json()["id"]

    r = await client.patch(
        f"/api/v1/teacher/courses/{cid}", json={"title": "Hijacked"}, headers=_auth(t2)
    )
    assert r.status_code == 403

    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "Bad"}, headers=_auth(t2)
    )
    assert r.status_code == 403

    r = await client.delete(f"/api/v1/teacher/courses/{cid}", headers=_auth(t2))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teacher_cannot_delete_other_teachers_module(client):
    t1 = await _mk(client, "own2@example.com", "TEACHER")
    t2 = await _mk(client, "intruder2@example.com", "TEACHER")

    r = await client.post("/api/v1/teacher/courses", json={"title": "C"}, headers=_auth(t1))
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(t1)
    )
    mid = r.json()["id"]

    r = await client.delete(f"/api/v1/teacher/courses/modules/{mid}", headers=_auth(t2))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_cannot_create_course(client):
    r = await client.post("/api/v1/teacher/courses", json={"title": "Nope"})
    assert r.status_code == 401