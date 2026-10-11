import pytest


async def _teacher_token(client, email="course_create@example.com"):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Secret123",
            "full_name": "Course Teacher",
            "role": "TEACHER",
        },
    )
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Secret123"},
    )
    assert response.status_code == 200, response.text
    return response.json()["tokens"]["access_token"]


@pytest.mark.asyncio
async def test_teacher_can_create_course(client):
    token = await _teacher_token(client)

    response = await client.post(
        "/api/v1/teacher/courses",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Binary Search",
            "short_description": "Searching sorted data",
            "description": "Learn binary search and its complexity.",
            "category": "Data Structures",
            "difficulty": "beginner",
            "language": "en",
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "Binary Search"
    assert body["status"] == "DRAFT"
    assert body["teacher_id"] > 0
    assert body["modules"] == []
