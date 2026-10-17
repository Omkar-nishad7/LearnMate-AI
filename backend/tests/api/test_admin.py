import pytest

from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserProfile, UserRole, UserStatus


async def _create_admin_token(email="admin-dashboard@example.com"):
    async with AsyncSessionLocal() as db:
        user = User(
            email=email,
            password_hash="test-only-hash",
            role=UserRole.ADMIN,
            status=UserStatus.ACTIVE,
            is_email_verified=True,
            profile=UserProfile(full_name="Platform Admin", display_name="Platform Admin"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = user.id
    return create_access_token(subject=str(user_id), role=UserRole.ADMIN.value)


@pytest.mark.asyncio
async def test_admin_overview_requires_admin_and_returns_database_metrics(client):
    token = await _create_admin_token()
    response = await client.get(
        "/api/v1/admin/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "metrics" in payload
    assert payload["metrics"]["total_users"] >= 1
    assert isinstance(payload["recent_users"], list)
    assert isinstance(payload["recent_activity"], list)


@pytest.mark.asyncio
async def test_admin_routes_reject_unauthenticated_requests(client):
    response = await client.get("/api/v1/admin/users")
    assert response.status_code == 401
