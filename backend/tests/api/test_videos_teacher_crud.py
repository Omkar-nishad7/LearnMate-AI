import pytest
from unittest.mock import patch


async def _mk(client, email, role):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Secret123",
            "full_name": "Video Teacher",
            "role": role,
        },
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Secret123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["tokens"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_teacher_can_edit_and_delete_owned_video(client):
    teacher = await _mk(client, "video_crud_teacher@example.com", "TEACHER")

    with patch("app.api.v1.videos.process_video.delay") as delay:
        delay.return_value.id = "video-crud-task"
        response = await client.post(
            "/api/v1/videos",
            json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            headers=_auth(teacher),
        )

    assert response.status_code == 201, response.text
    video_id = response.json()["video"]["id"]

    response = await client.patch(
        f"/api/v1/videos/{video_id}",
        json={"title": "Edited teaching video", "description": "Updated metadata"},
        headers=_auth(teacher),
    )
    assert response.status_code == 200, response.text
    assert response.json()["title"] == "Edited teaching video"

    response = await client.delete(
        f"/api/v1/videos/{video_id}",
        headers=_auth(teacher),
    )
    assert response.status_code == 204, response.text

    response = await client.get(
        f"/api/v1/videos/{video_id}",
        headers=_auth(teacher),
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_teacher_cannot_edit_or_delete_another_teachers_video(client):
    owner = await _mk(client, "video_crud_owner@example.com", "TEACHER")
    other = await _mk(client, "video_crud_other@example.com", "TEACHER")

    with patch("app.api.v1.videos.process_video.delay") as delay:
        delay.return_value.id = "video-auth-task"
        response = await client.post(
            "/api/v1/videos",
            json={"url": "https://www.youtube.com/watch?v=oHg5SJYRHA0"},
            headers=_auth(owner),
        )

    assert response.status_code == 201, response.text
    video_id = response.json()["video"]["id"]

    response = await client.patch(
        f"/api/v1/videos/{video_id}",
        json={"title": "Nope"},
        headers=_auth(other),
    )
    assert response.status_code == 403

    response = await client.delete(
        f"/api/v1/videos/{video_id}",
        headers=_auth(other),
    )
    assert response.status_code == 403
