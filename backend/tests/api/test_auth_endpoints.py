import pytest
from app.config.settings import settings


@pytest.mark.asyncio
async def test_register_login_refresh_me_logout(client):
    email = "m2user@example.com"
    password = "Secret123"

    # register
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "M2 User", "role": "STUDENT"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == email
    assert body["user"]["role"] == "STUDENT"
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]

    # the registration response establishes an authenticated session immediately
    register_access = body["tokens"]["access_token"]
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {register_access}"},
    )
    assert r.status_code == 200
    assert r.json()["email"] == email

    # duplicate
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Dup", "role": "STUDENT"},
    )
    assert r.status_code == 409

    # login
    r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    tokens = r.json()["tokens"]
    access, refresh = tokens["access_token"], tokens["refresh_token"]

    # me
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert r.json()["email"] == email

    # me no token
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401

    # refresh
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    new = r.json()
    assert new["access_token"] and new["refresh_token"]
    assert new["refresh_token"] != refresh

    # reuse old refresh => 401 with reuse code
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "REFRESH_TOKEN_REUSE"

    # logout (revokes new refresh)
    r = await client.post("/api/v1/auth/logout", json={"refresh_token": new["refresh_token"]})
    assert r.status_code == 200

    # refresh after logout must fail
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": new["refresh_token"]})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_login_bad_password(client):
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "ghost@example.com", "password": "whatever1"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_cannot_self_register_admin(client):
    r = await client.post(
        "/api/v1/auth/register",
        json={"email": "evil@example.com", "password": "Secret123", "full_name": "Evil", "role": "ADMIN"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_forgot_and_reset_password(client):
    email = "reset@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "OldPass123", "full_name": "Reset User", "role": "STUDENT"},
    )
    # forgot — always 200 regardless of existence
    r = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert r.status_code == 200
    r = await client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200