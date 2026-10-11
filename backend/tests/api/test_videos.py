import pytest
from unittest.mock import AsyncMock, patch


async def _mk(client, email, role):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


class _FakeMeta:
    def __init__(self):
        self.video_id = "dQw4w9WgXcQ"
        self.title = "Fake Video"
        self.author = "Author"
        self.thumbnail_url = "https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg"
        self.duration_seconds = None


@pytest.mark.asyncio
async def test_create_video_enqueues_task(client):
    teacher = await _mk(client, "vid_teacher@example.com", "TEACHER")

    with patch("app.services.video_service.fetch_metadata", new=AsyncMock(return_value=_FakeMeta())), \
         patch("app.api.v1.videos.process_video.delay") as mock_delay:
        mock_delay.return_value.id = "task-abc-123"

        r = await client.post(
            "/api/v1/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers=_auth(teacher),
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["video"]["status"] == "PENDING"
    assert body["video"]["external_id"] == "dQw4w9WgXcQ"
    assert body["task_id"] == "task-abc-123"
    mock_delay.assert_called_once()


@pytest.mark.asyncio
async def test_invalid_youtube_url_rejected(client):
    teacher = await _mk(client, "vid_teacher2@example.com", "TEACHER")
    r = await client.post(
        "/api/v1/videos",
        json={"url": "https://vimeo.com/12345"},
        headers=_auth(teacher),
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_student_can_create_video(client):
    student = await _mk(client, "vid_student@example.com", "STUDENT")
    with patch("app.services.video_service.fetch_metadata", new=AsyncMock(return_value=_FakeMeta())), \
         patch("app.api.v1.videos.process_video.delay") as mock_delay:
        mock_delay.return_value.id = "student-task-123"
        r = await client.post(
            "/api/v1/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20"},
            headers=_auth(student),
        )
    assert r.status_code == 201, r.text
    assert r.json()["video"]["external_id"] == "dQw4w9WgXcQ"
    mock_delay.assert_called_once()


@pytest.mark.asyncio
async def test_get_video_status(client):
    teacher = await _mk(client, "vid_teacher3@example.com", "TEACHER")
    with patch("app.services.video_service.fetch_metadata", new=AsyncMock(return_value=_FakeMeta())), \
         patch("app.api.v1.videos.process_video.delay") as mock_delay:
        mock_delay.return_value.id = "t1"
        r = await client.post(
            "/api/v1/videos",
            json={"url": "https://youtu.be/dQw4w9WgXcQ"},
            headers=_auth(teacher),
        )
    vid = r.json()["video"]["id"]

    r = await client.get(f"/api/v1/videos/{vid}/status", headers=_auth(teacher))
    assert r.status_code == 200
    body = r.json()
    assert body["video_id"] == vid
    assert body["status"] == "PENDING"
    assert body["has_transcript"] is False


@pytest.mark.asyncio
async def test_duplicate_youtube_video_conflicts(client):
    teacher = await _mk(client, "vid_teacher4@example.com", "TEACHER")
    with patch("app.services.video_service.fetch_metadata", new=AsyncMock(return_value=_FakeMeta())), \
         patch("app.api.v1.videos.process_video.delay") as mock_delay:
        mock_delay.return_value.id = "t1"
        await client.post(
            "/api/v1/videos",
            json={"url": "https://youtu.be/dQw4w9WgXcQ"},
            headers=_auth(teacher),
        )
        r = await client.post(
            "/api/v1/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers=_auth(teacher),
        )
    assert r.status_code == 409