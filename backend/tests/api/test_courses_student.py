import pytest


async def _mk_user(client, email, role):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


async def _create_published_course(client, teacher_token, title="Public Course"):
    r = await client.post(
        "/api/v1/teacher/courses", json={"title": title, "short_description": "x"},
        headers=_auth(teacher_token),
    )
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(teacher_token)
    )
    mid = r.json()["id"]
    await client.post(
        f"/api/v1/teacher/courses/modules/{mid}/lessons",
        json={"title": "L"}, headers=_auth(teacher_token),
    )
    await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(teacher_token))
    return cid


@pytest.mark.asyncio
async def test_student_catalog_and_enrollment(client):
    teacher = await _mk_user(client, "t_student@example.com", "TEACHER")
    student = await _mk_user(client, "s_student@example.com", "STUDENT")
    cid = await _create_published_course(client, teacher, "Intro to SQL")

    # catalog lists it
    r = await client.get("/api/v1/courses")
    assert r.status_code == 200
    titles = [c["title"] for c in r.json()["items"]]
    assert "Intro to SQL" in titles

    # view details
    r = await client.get(f"/api/v1/courses/{cid}")
    assert r.status_code == 200
    assert r.json()["id"] == cid

    # enroll
    r = await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    assert r.status_code == 201
    assert r.json()["status"] == "ACTIVE"

    # duplicate enroll => 409
    r = await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    assert r.status_code == 409

    # list enrollments
    r = await client.get("/api/v1/student/enrollments", headers=_auth(student))
    assert r.status_code == 200
    assert any(e["course_id"] == cid for e in r.json())

    # unenroll
    r = await client.request("DELETE", f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    assert r.status_code == 200
    assert r.json()["status"] == "DROPPED"


@pytest.mark.asyncio
async def test_draft_course_hidden_from_students(client):
    teacher = await _mk_user(client, "t_draft@example.com", "TEACHER")
    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "Draft Only"}, headers=_auth(teacher)
    )
    cid = r.json()["id"]

    r = await client.get(f"/api/v1/courses/{cid}")
    assert r.status_code == 404  # unpublished & unauthenticated

    student = await _mk_user(client, "s_draft@example.com", "STUDENT")
    r = await client.get(f"/api/v1/courses/{cid}", headers=_auth(student))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_lesson_access_requires_enrollment(client):
    teacher = await _mk_user(client, "t_lesson@example.com", "TEACHER")
    student = await _mk_user(client, "s_lesson@example.com", "STUDENT")
    cid = await _create_published_course(client, teacher, "Lesson Access")

    # get lesson id
    r = await client.get(f"/api/v1/teacher/courses/{cid}/modules", headers=_auth(teacher))
    lesson_id = r.json()[0]["lessons"][0]["id"]

    # not enrolled yet
    r = await client.get(f"/api/v1/student/lessons/{lesson_id}", headers=_auth(student))
    assert r.status_code == 403

    # enroll
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))

    r = await client.get(f"/api/v1/student/lessons/{lesson_id}", headers=_auth(student))
    assert r.status_code == 200