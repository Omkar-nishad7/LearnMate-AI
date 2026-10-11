import pytest
from app.services.storage.local_storage import LocalStorage
from app.core.exceptions import NotFoundError


@pytest.mark.asyncio
async def test_local_put_get_delete(tmp_path):
    s = LocalStorage(root=str(tmp_path))
    obj = await s.put(key="users/1/document/a.txt", data=b"hello", content_type="text/plain")
    assert obj.size == 5
    assert await s.exists(key="users/1/document/a.txt")
    assert await s.get(key="users/1/document/a.txt") == b"hello"
    await s.delete(key="users/1/document/a.txt")
    assert not await s.exists(key="users/1/document/a.txt")


@pytest.mark.asyncio
async def test_local_get_missing_raises(tmp_path):
    s = LocalStorage(root=str(tmp_path))
    with pytest.raises(NotFoundError):
        await s.get(key="nope.txt")


@pytest.mark.asyncio
async def test_local_path_traversal_blocked(tmp_path):
    s = LocalStorage(root=str(tmp_path))
    with pytest.raises(NotFoundError):
        await s.put(key="../../etc/passwd", data=b"x")