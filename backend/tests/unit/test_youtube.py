import pytest
from app.core.exceptions import ValidationError
from app.core.youtube import extract_video_id


def test_extract_watch_url():
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_extract_watch_url_with_extra_query_params():
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42") == "dQw4w9WgXcQ"


def test_extract_short_url():
    assert extract_video_id("https://youtu.be/dQw4w9WgXcQ?t=10") == "dQw4w9WgXcQ"


def test_extract_embed_url():
    assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_extract_shorts_url():
    assert extract_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ?si=abc") == "dQw4w9WgXcQ"


def test_extract_live_url():
    assert extract_video_id("https://www.youtube.com/live/dQw4w9WgXcQ?feature=share") == "dQw4w9WgXcQ"


def test_invalid_url_raises():
    with pytest.raises(ValidationError):
        extract_video_id("https://vimeo.com/12345")


def test_garbage_raises():
    with pytest.raises(ValidationError):
        extract_video_id("not-a-url")


def test_fake_youtube_domain_raises():
    with pytest.raises(ValidationError):
        extract_video_id("https://notyoutube.com/watch?v=dQw4w9WgXcQ")
