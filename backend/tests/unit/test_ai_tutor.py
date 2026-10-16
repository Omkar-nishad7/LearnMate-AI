import pytest
from unittest.mock import AsyncMock, patch

from app.config.settings import settings

from app.services.ai.gemini_client import GeminiClient


async def _mk(client, email, role="STUDENT"):
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "U", "role": role},
    )
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123"})
    return r.json()["tokens"]["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.asyncio
async def test_tutor_ask_persists_and_replies(client):
    token = await _mk(client, "tutor_user@example.com", "STUDENT")

    with patch.object(GeminiClient, "generate_text", return_value=("Sure, 2+2=4.", 12)):
        r = await client.post(
            "/api/v1/ai/tutor",
            json={"message": "What is 2+2?"},
            headers=_auth(token),
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["message"]["role"] == "assistant"
    assert "2+2" in body["message"]["content"]
    conv_id = body["conversation"]["id"]

    # follow-up keeps history
    with patch.object(GeminiClient, "generate_text", return_value=("Yes.", 5)):
        r = await client.post(
            "/api/v1/ai/tutor",
            json={"message": "Thanks", "conversation_id": conv_id},
            headers=_auth(token),
        )
    assert r.status_code == 200

    r = await client.get(f"/api/v1/ai/tutor/conversations/{conv_id}", headers=_auth(token))
    assert r.status_code == 200
    msgs = r.json()["messages"]
    roles = [m["role"] for m in msgs]
    assert roles.count("user") == 2
    assert roles.count("assistant") == 2


@pytest.mark.asyncio
async def test_tutor_requires_auth(client):
    r = await client.post("/api/v1/ai/tutor", json={"message": "hi"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_other_users_cannot_read_conversation(client):
    t1 = await _mk(client, "tutor1@example.com")
    t2 = await _mk(client, "tutor2@example.com")
    with patch.object(GeminiClient, "generate_text", return_value=("ok", 3)):
        r = await client.post("/api/v1/ai/tutor", json={"message": "hello"}, headers=_auth(t1))
    conv_id = r.json()["conversation"]["id"]

    r = await client.get(f"/api/v1/ai/tutor/conversations/{conv_id}", headers=_auth(t2))
    assert r.status_code == 404  # existence not leaked


@pytest.mark.asyncio
async def test_invalid_gemini_output_for_json_endpoint(client):
    """Simulates invalid JSON from Gemini on a JSON-required endpoint."""
    token = await _mk(client, "tutor_json@example.com", "TEACHER")
    # Add a fake video + transcript via direct DB to keep test isolated
    # (Simpler: call teacher endpoint which requires teacher role)
    with patch.object(
        GeminiClient, "generate_json", return_value=({"bogus": True}, 10)
    ):
        r = await client.post(
            "/api/v1/teacher/ai/course-outline",
            json={"topic": "Python Functions"},
            headers=_auth(token),
        )
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "AI_INVALID_OUTPUT"


@pytest.mark.asyncio
async def test_tutor_uses_dedicated_model(client):
    token = await _mk(client, "tutor_model@example.com", "STUDENT")

    with patch("app.services.ai.tutor_service.GeminiClient") as gemini_factory:
        gemini_factory.return_value.generate_text_async = AsyncMock(
            return_value=("Tutor response", 5)
        )
        response = await client.post(
            "/api/v1/ai/tutor",
            json={"message": "Explain recursion."},
            headers=_auth(token),
        )

    assert response.status_code == 200, response.text
    gemini_factory.assert_called_once_with(model=settings.GEMINI_TUTOR_MODEL)
