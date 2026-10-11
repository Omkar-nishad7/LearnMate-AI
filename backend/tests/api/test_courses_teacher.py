import pytest


async def _register_and_login(client, email, role="TEACHER"):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "User", "role": role},
    )
    r = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Secret123"}
    )
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.asyncio
async def test_teacher_course_lifecycle(client):
    t = await _register_and_login(client, "t1@example.com", "TEACHER")

    # create
    r = await client.post(
        "/api/v1/teacher/courses",
        json={"title": "Intro to Python", "short_description": "Basics"},
        headers=_auth(t),
    )
    assert r.status_code == 201, r.text
    course = r.json()
    cid = course["id"]
    assert course["slug"].startswith("intro-to-python")
    assert course["status"] == "DRAFT"
    assert course.get("modules") == []

    # update
    r = await client.patch(
        f"/api/v1/teacher/courses/{cid}",
        json={"difficulty": "beginner"},
        headers=_auth(t),
    )
    assert r.status_code == 200
    assert r.json()["difficulty"] == "beginner"

    # cannot publish without lessons
    r = await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(t))
    assert r.status_code == 400

    # add module
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules",
        json={"title": "Getting Started"},
        headers=_auth(t),
    )
    assert r.status_code == 201
    mid = r.json()["id"]

    # add lesson
    r = await client.post(
        f"/api/v1/teacher/courses/modules/{mid}/lessons",
        json={"title": "Installing Python", "duration_minutes": 10},
        headers=_auth(t),
    )
    assert r.status_code == 201

    # publish now succeeds
    r = await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(t))
    assert r.status_code == 200
    assert r.json()["status"] == "PUBLISHED"

    # archive
    r = await client.post(f"/api/v1/teacher/courses/{cid}/archive", headers=_auth(t))
    assert r.status_code == 200
    assert r.json()["status"] == "ARCHIVED"

    # cannot edit archived
    r = await client.patch(
        f"/api/v1/teacher/courses/{cid}", json={"title": "Nope"}, headers=_auth(t)
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_module_order_index_conflicts(client):
    t = await _register_and_login(client, "t2@example.com", "TEACHER")
    r = await client.post(
        "/api/v1/teacher/courses",
        json={"title": "Course X"},
        headers=_auth(t),
    )
    cid = r.json()["id"]

    await client.post(
        f"/api/v1/teacher/courses/{cid}/modules",
        json={"title": "M1", "order_index": 0},
        headers=_auth(t),
    )
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules",
        json={"title": "M2", "order_index": 0},
        headers=_auth(t),
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_student_cannot_create_course(client):
    t = await _register_and_login(client, "s_block@example.com", "STUDENT")
    r = await client.post(
        "/api/v1/teacher/courses",
        json={"title": "Should Not Exist"},
        headers=_auth(t),
    )
    assert r.status_code == 403