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


async def _setup(client, teacher_token, num_lessons=3):
    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "Prog"}, headers=_auth(teacher_token)
    )
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(teacher_token)
    )
    mid = r.json()["id"]
    lesson_ids = []
    for i in range(num_lessons):
        r = await client.post(
            f"/api/v1/teacher/courses/modules/{mid}/lessons",
            json={"title": f"L{i}"}, headers=_auth(teacher_token),
        )
        lesson_ids.append(r.json()["id"])
    await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(teacher_token))
    return cid, lesson_ids


@pytest.mark.asyncio
async def test_course_progress_reaches_100_and_completes_enrollment(client):
    teacher = await _mk(client, "pr_teacher@example.com", "TEACHER")
    student = await _mk(client, "pr_student@example.com", "STUDENT")
    cid, lesson_ids = await _setup(client, teacher, num_lessons=3)
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))

    for i, lid in enumerate(lesson_ids):
        r = await client.post(
            f"/api/v1/progress/lessons/{lid}/complete",
            json={"last_position_seconds": 100, "duration_seconds": 100},
            headers=_auth(student),
        )
        assert r.status_code == 200, r.text
        expected = round((i + 1) / 3 * 100, 2)
        assert abs(r.json()["progress_percent"] - expected) < 0.01

    # after all lessons, enrollment is COMPLETED
    r = await client.get("/api/v1/student/enrollments", headers=_auth(student))
    enr = [e for e in r.json() if e["course_id"] == cid][0]
    assert enr["status"] == "COMPLETED"
    assert enr["progress_percent"] == 100.0


@pytest.mark.asyncio
async def test_progress_requires_enrollment(client):
    teacher = await _mk(client, "pr2_teacher@example.com", "TEACHER")
    student = await _mk(client, "pr2_student@example.com", "STUDENT")
    _cid, lesson_ids = await _setup(client, teacher, num_lessons=1)

    r = await client.post(
        f"/api/v1/progress/lessons/{lesson_ids[0]}/complete",
        json={}, headers=_auth(student),
    )
    assert r.status_code == 403