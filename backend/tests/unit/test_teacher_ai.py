import pytest
from unittest.mock import patch

from app.services.ai.gemini_client import GeminiClient


async def _mk(client, email, role="TEACHER"):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


_COURSE_JSON = {
    "title": "Python Functions Deep Dive",
    "short_description": "Master functions in Python",
    "description": "A short description long enough to pass validation.",
    "difficulty": "intermediate",
    "duration_hours": 8,
    "modules": [
        {
            "title": "Basics",
            "description": "Getting started",
            "lessons": [
                {"title": "def keyword", "summary": "Basic def", "duration_minutes": 20}
            ],
        }
    ],
}


@pytest.mark.asyncio
async def test_teacher_course_outline(client):
    token = await _mk(client, "tai1@example.com")

    with patch.object(GeminiClient, "generate_json", return_value=(_COURSE_JSON, 100)):
        r = await client.post(
            "/api/v1/teacher/ai/course-outline",
            json={"topic": "Python Functions", "num_modules": 1},
            headers=_auth(token),
        )
    assert r.status_code == 200, r.text
    assert r.json()["title"].startswith("Python Functions")


@pytest.mark.asyncio
async def test_teacher_assignment(client):
    token = await _mk(client, "tai2@example.com")
    body = {
        "title": "Homework 1",
        "description": "Do stuff with functions please.",
        "instructions": "1. Read\n2. Practice",
        "max_score": 100,
        "estimated_hours": 3,
        "rubric": [{"criterion": "Correctness", "points": 50}],
    }
    with patch.object(GeminiClient, "generate_json", return_value=(body, 50)):
        r = await client.post(
            "/api/v1/teacher/ai/assignment",
            json={"topic": "Python Functions"},
            headers=_auth(token),
        )
    assert r.status_code == 200
    assert r.json()["title"] == "Homework 1"


@pytest.mark.asyncio
async def test_student_cannot_use_teacher_ai(client):
    token = await _mk(client, "saix@example.com", role="STUDENT")
    r = await client.post(
        "/api/v1/teacher/ai/course-outline",
        json={"topic": "Anything"},
        headers=_auth(token),
    )
    assert r.status_code == 403