import pytest


async def _mk(client, email, role):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": email.split("@")[0], "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


async def _me(client, token):
    r = await client.get("/api/v1/auth/me", headers=_auth(token))
    return r.json()["id"]


async def _setup_course_and_enroll(client, teacher_token, student_token):
    r = await client.post(
        "/api/v1/teacher/courses", json={"title": "Chat Course"}, headers=_auth(teacher_token)
    )
    cid = r.json()["id"]
    r = await client.post(
        f"/api/v1/teacher/courses/{cid}/modules", json={"title": "M"}, headers=_auth(teacher_token)
    )
    mid = r.json()["id"]
    await client.post(
        f"/api/v1/teacher/courses/modules/{mid}/lessons", json={"title": "L"}, headers=_auth(teacher_token)
    )
    await client.post(f"/api/v1/teacher/courses/{cid}/publish", headers=_auth(teacher_token))
    await client.post(f"/api/v1/student/courses/{cid}/enroll", headers=_auth(student_token))
    return cid


@pytest.mark.asyncio
async def test_student_can_open_chat_with_enrolled_teacher(client):
    tt = await _mk(client, "chat_t@example.com", "TEACHER")
    st = await _mk(client, "chat_s@example.com", "STUDENT")
    teacher_id = await _me(client, tt)

    cid = await _setup_course_and_enroll(client, tt, st)

    # open conversation
    r = await client.post(
        "/api/v1/chat/conversations",
        json={"other_user_id": teacher_id, "course_id": cid},
        headers=_auth(st),
    )
    assert r.status_code == 201, r.text
    conv_id = r.json()["id"]

    # sending twice returns the same conversation
    r2 = await client.post(
        "/api/v1/chat/conversations",
        json={"other_user_id": teacher_id, "course_id": cid},
        headers=_auth(st),
    )
    assert r2.status_code == 201
    assert r2.json()["id"] == conv_id


@pytest.mark.asyncio
async def test_chat_messages_flow_and_notifications(client):
    tt = await _mk(client, "chat_t2@example.com", "TEACHER")
    st = await _mk(client, "chat_s2@example.com", "STUDENT")
    teacher_id = await _me(client, tt)

    cid = await _setup_course_and_enroll(client, tt, st)
    r = await client.post(
        "/api/v1/chat/conversations",
        json={"other_user_id": teacher_id, "course_id": cid},
        headers=_auth(st),
    )
    conv_id = r.json()["id"]

    # student sends
    r = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"body": "Hi teacher!"},
        headers=_auth(st),
    )
    assert r.status_code == 201
    m1 = r.json()

    # teacher sees unread=1
    r = await client.get("/api/v1/chat/conversations", headers=_auth(tt))
    assert r.status_code == 200
    item = next(i for i in r.json()["items"] if i["id"] == conv_id)
    assert item["unread_count"] == 1
    assert item["last_message_body"] == "Hi teacher!"

    # teacher sends back
    r = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/messages",
        json={"body": "Hello!"},
        headers=_auth(tt),
    )
    assert r.status_code == 201

    # student lists messages
    r = await client.get(
        f"/api/v1/chat/conversations/{conv_id}/messages", headers=_auth(st)
    )
    assert r.status_code == 200
    bodies = [m["body"] for m in r.json()["items"]]
    assert bodies == ["Hi teacher!", "Hello!"]

    # student has unread=1 (teacher's reply), mark read
    r = await client.get("/api/v1/chat/conversations", headers=_auth(st))
    item = next(i for i in r.json()["items"] if i["id"] == conv_id)
    assert item["unread_count"] == 1

    r = await client.post(
        f"/api/v1/chat/conversations/{conv_id}/read", headers=_auth(st)
    )
    assert r.status_code == 200
    assert r.json()["total"] == 0

    # teacher received an in-app notification for the student's message
    r = await client.get("/api/v1/notifications", headers=_auth(tt))
    assert r.status_code == 200
    types = [n["type"] for n in r.json()["items"]]
    assert "student_message" in types


@pytest.mark.asyncio
async def test_cannot_chat_with_unrelated_teacher(client):
    tt = await _mk(client, "chat_t3@example.com", "TEACHER")
    st = await _mk(client, "chat_s3@example.com", "STUDENT")
    teacher_id = await _me(client, tt)

    # student not enrolled anywhere
    r = await client.post(
        "/api/v1/chat/conversations",
        json={"other_user_id": teacher_id},
        headers=_auth(st),
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_non_participant_cannot_read_conversation(client):
    tt = await _mk(client, "chat_t4@example.com", "TEACHER")
    st = await _mk(client, "chat_s4@example.com", "STUDENT")
    intruder = await _mk(client, "chat_x4@example.com", "STUDENT")
    teacher_id = await _me(client, tt)

    cid = await _setup_course_and_enroll(client, tt, st)
    r = await client.post(
        "/api/v1/chat/conversations",
        json={"other_user_id": teacher_id, "course_id": cid},
        headers=_auth(st),
    )
    conv_id = r.json()["id"]

    r = await client.get(
        f"/api/v1/chat/conversations/{conv_id}", headers=_auth(intruder)
    )
    assert r.status_code == 404