from datetime import datetime, timedelta, timezone
import pytest


async def _mk(client, email, role="TEACHER"):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


async def _setup_course(client, teacher, due_in_hours=24, allow_late=False):
    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "Assign Course"}, headers=_auth(teacher)
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
    return cid


@pytest.mark.asyncio
async def test_assignment_flow_and_grade(client):
    teacher = await _mk(client, "as_teacher@example.com", "TEACHER")
    student = await _mk(client, "as_student@example.com", "STUDENT")
    cid = await _setup_course(client, teacher)

    due = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    r = await client.post(
        "/api/v1/assignments",
        json={"course_id": cid, "title": "Essay 1", "description": "Write 500 words", "due_at": due},
        headers=_auth(teacher),
    )
    assert r.status_code == 201
    aid = r.json()["id"]

    # publish
    r = await client.post(f"/api/v1/assignments/{aid}/publish", headers=_auth(teacher))
    assert r.status_code == 200

    # student must be enrolled
    r = await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    assert r.status_code == 201

    # submit
    r = await client.post(
        f"/api/v1/assignments/{aid}/submit",
        json={"content": "My essay text."},
        headers=_auth(student),
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]

    # teacher lists submissions
    r = await client.get(f"/api/v1/assignments/{aid}/submissions", headers=_auth(teacher))
    assert r.status_code == 200
    assert r.json()["total"] == 1

    # grade
    r = await client.post(
        f"/api/v1/assignments/submissions/{sub_id}/grade",
        json={"score": 87, "feedback": "Good job", "return_to_student": True},
        headers=_auth(teacher),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "RETURNED"
    assert r.json()["score"] == 87


@pytest.mark.asyncio
async def test_late_submission_rejected_when_not_allowed(client):
    teacher = await _mk(client, "as2_teacher@example.com", "TEACHER")
    student = await _mk(client, "as2_student@example.com", "STUDENT")
    cid = await _setup_course(client, teacher)

    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    r = await client.post(
        "/api/v1/assignments",
        json={"course_id": cid, "title": "Late", "description": "desc",
              "due_at": past, "allow_late": False},
        headers=_auth(teacher),
    )
    aid = r.json()["id"]
    await client.post(f"/api/v1/assignments/{aid}/publish", headers=_auth(teacher))
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))

    r = await client.post(
        f"/api/v1/assignments/{aid}/submit",
        json={"content": "Too late"}, headers=_auth(student),
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_teacher_cannot_grade_other_teachers_submission(client):
    t1 = await _mk(client, "t1as@example.com", "TEACHER")
    t2 = await _mk(client, "t2as@example.com", "TEACHER")
    student = await _mk(client, "sas@example.com", "STUDENT")
    cid = await _setup_course(client, t1)
    r = await client.post(
        "/api/v1/assignments",
        json={"course_id": cid, "title": "A", "description": "desc"},
        headers=_auth(t1),
    )
    aid = r.json()["id"]
    await client.post(f"/api/v1/assignments/{aid}/publish", headers=_auth(t1))
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student))
    r = await client.post(
        f"/api/v1/assignments/{aid}/submit",
        json={"content": "x"}, headers=_auth(student),
    )
    sub_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/assignments/submissions/{sub_id}/grade",
        json={"score": 10}, headers=_auth(t2),
    )
    assert r.status_code == 403