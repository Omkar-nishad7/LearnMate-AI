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
async def test_student_analytics_smoke(client):
    teacher = await _mk(client, "an_t@example.com", "TEACHER")
    student = await _mk(client, "an_s@example.com", "STUDENT")

    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "Analytics Course"}, headers=_auth(teacher)
    )
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(teacher)
    )
    mid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/modules/{mid}/lessons", json={"title": "L"}, headers=_auth(teacher)
    )
    lid = r.json()["id"]
    await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(teacher))
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    await client.post(
        f"/api/v1/progress/lessons/{lid}/complete", json={}, headers=_auth(student)
    )

    r = await client.get("/api/v1/analytics/student", headers=_auth(student))
    assert r.status_code == 200
    body = r.json()
    assert "streak" in body
    assert any(c["course_id"] == cid for c in body["courses"])
    assert body["overall_progress_percent"] >= 0.0
    assert body["quiz_performance"]["total_attempts"] == 0


@pytest.mark.asyncio
async def test_teacher_analytics_smoke(client):
    teacher = await _mk(client, "an_t2@example.com", "TEACHER")
    student = await _mk(client, "an_s2@example.com", "STUDENT")

    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "TC"}, headers=_auth(teacher)
    )
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(teacher)
    )
    mid = r.json()["id"]
    await client.post(
        f"/api/v1/teacher/courses/modules/{mid}/lessons", json={"title": "L"}, headers=_auth(teacher)
    )
    await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(teacher))
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))

    r = await client.get("/api/v1/analytics/teacher", headers=_auth(teacher))
    assert r.status_code == 200
    body = r.json()
    assert body["total_courses"] == 1
    assert body["courses"][0]["enrolled_count"] == 1


@pytest.mark.asyncio
async def test_student_cannot_access_teacher_analytics(client):
    student = await _mk(client, "an_s3@example.com", "STUDENT")
    r = await client.get("/api/v1/analytics/teacher", headers=_auth(student))
    assert r.status_code == 403