from app.services.search_service import _chapter_match, _snippet


def test_snippet_returns_matching_context():
    text = "Binary trees store hierarchical relationships between nodes."
    result = _snippet(text, "hierarchical")
    assert result is not None
    assert "hierarchical" in result


def test_chapter_match_finds_heading():
    key_points = {
        "chapters": [
            {
                "title": "Binary Search Trees",
                "start_seconds": 120,
                "end_seconds": 300,
                "summary": "Searching and insertion.",
            }
        ]
    }
    result = _chapter_match(key_points, "search trees")
    assert result == "Binary Search Trees · starts at 120s"
