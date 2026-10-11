import pytest
from pydantic import ValidationError as PydanticValidationError
from app.services.ai.schemas import (
    AssignmentOutput,
    CourseOutput,
    NotesOutput,
    QuizOutput,
    SummaryOutput,
)


def test_summary_ok():
    SummaryOutput(summary="x" * 30, key_points=["a", "b"], topics=[], estimated_study_minutes=10)


def test_summary_too_short():
    with pytest.raises(PydanticValidationError):
        SummaryOutput(summary="hi", key_points=["a"])


def test_notes_ok():
    NotesOutput(title="T", content_markdown="a" * 30, key_terms=[])


def test_quiz_mcq_requires_correct_answer_in_options():
    with pytest.raises(PydanticValidationError):
        QuizOutput(
            title="Q",
            questions=[
                {
                    "question_type": "MCQ",
                    "question_text": "What is 2+2?",
                    "options": {"A": "3", "B": "4"},
                    "correct_answer": "C",
                }
            ],
        )


def test_quiz_mcq_valid():
    out = QuizOutput(
        title="Q",
        questions=[
            {
                "question_type": "MCQ",
                "question_text": "What is 2+2?",
                "options": {"A": "3", "B": "4"},
                "correct_answer": "B",
                "points": 1,
            }
        ],
    )
    assert out.questions[0].correct_answer == "B"


def test_assignment_ok():
    AssignmentOutput(title="A", description="x" * 20, instructions="y" * 20, rubric=[])


def test_course_requires_at_least_one_module():
    with pytest.raises(PydanticValidationError):
        CourseOutput(
            title="C", short_description="x" * 20, description="y" * 30,
            difficulty="beginner", duration_hours=4, modules=[],
        )