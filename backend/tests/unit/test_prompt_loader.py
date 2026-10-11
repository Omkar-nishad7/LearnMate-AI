import pytest
from app.core.exceptions import ValidationError
from app.services.ai.prompt_loader import load_prompt, render_prompt


def test_load_all_prompts():
    for name in ["tutor", "summary", "notes", "quiz", "assignment", "course"]:
        assert load_prompt(name).strip()


def test_missing_prompt_raises():
    with pytest.raises(ValidationError):
        load_prompt("does_not_exist")


def test_render_substitutes_and_leaves_no_placeholder():
    out = render_prompt("summary", transcript="Hello world")
    assert "Hello world" in out
    assert "{{transcript}}" not in out


def test_render_requires_all_vars():
    with pytest.raises(ValidationError):
        render_prompt("summary")  # transcript missing


def test_render_does_not_execute_format_syntax():
    # If someone supplies "{__import__}", template must not execute it.
    out = render_prompt("summary", transcript="{__import__('os').system('echo hi')}")
    assert "__import__" in out  # treated as literal text