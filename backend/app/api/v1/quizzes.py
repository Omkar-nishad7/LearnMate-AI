from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, require_role
from app.models.user import UserRole
from app.schemas.quiz import (
    AttemptResultOut,
    AttemptStartOut,
    AttemptSubmitIn,
    QuizCreate,
    QuizDetailOut,
    QuizAuthorDetailOut,
    QuizOut,
    StudentQuizOut,
    QuizQuestionAuthorOut,
    QuizQuestionCreate,
    QuizUpdate,
)
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.get("/mine", response_model=list[StudentQuizOut], dependencies=[Depends(require_role(UserRole.STUDENT))])
async def list_student_quizzes(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    items = []
    for quiz, attempt_count, latest in await QuizService(db).list_for_student(user):
        data = QuizOut.model_validate(quiz).model_dump()
        data.update({
            "attempted": latest is not None,
            "attempt_id": latest.id if latest else None,
            "attempt_score": latest.score if latest else None,
            "attempt_percentage": latest.percentage if latest else None,
            "attempt_passed": latest.passed if latest else None,
            "attempt_completed_at": latest.completed_at if latest else None,
            "attempt_count": attempt_count,
            "can_attempt": attempt_count < quiz.max_attempts,
            "can_delete": (
                quiz.creator_id == user.id
                and quiz.is_ai_generated
                and quiz.course_id is None
            ),
        })
        items.append(StudentQuizOut.model_validate(data))
    return items


@router.get("/teacher", response_model=list[QuizOut], dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))])
async def list_teacher_quizzes(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    return [QuizOut.model_validate(q) for q in await QuizService(db).list_for_teacher(user)]


@router.delete(
    "/{quiz_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def delete_student_quiz(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await QuizService(db).delete_student_quiz(user, quiz_id)
    return None


# ---------------- Authoring (teacher) ----------------
@router.post(
    "",
    response_model=QuizOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def create_quiz(
    payload: QuizCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizOut.model_validate(
        await QuizService(db).create_quiz(user, payload.model_dump())
    )


@router.patch(
    "/{quiz_id}",
    response_model=QuizOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def update_quiz(
    quiz_id: int,
    payload: QuizUpdate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizOut.model_validate(
        await QuizService(db).update_quiz(user, quiz_id, payload.model_dump(exclude_unset=True))
    )


@router.post(
    "/{quiz_id}/questions",
    response_model=QuizQuestionAuthorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def add_question(
    quiz_id: int,
    payload: QuizQuestionCreate,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizQuestionAuthorOut.model_validate(
        await QuizService(db).add_question(user, quiz_id, payload.model_dump())
    )


@router.post(
    "/{quiz_id}/publish",
    response_model=QuizOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def publish_quiz(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizOut.model_validate(await QuizService(db).publish(user, quiz_id))


@router.get(
    "/{quiz_id}/author",
    response_model=QuizAuthorDetailOut,
    dependencies=[Depends(require_role(UserRole.TEACHER, UserRole.ADMIN))],
)
async def get_author_detail(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizAuthorDetailOut.model_validate(
        await QuizService(db).get_author_detail(user, quiz_id)
    )


# ---------------- Student ----------------
@router.get("/{quiz_id}", response_model=QuizDetailOut)
async def get_quiz_for_student(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return QuizDetailOut.model_validate(
        await QuizService(db).get_student_detail(user, quiz_id)
    )


@router.get(
    "/{quiz_id}/attempts/latest",
    response_model=AttemptResultOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def get_latest_attempt(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = QuizService(db)
    attempt = await svc.get_latest_student_attempt(user, quiz_id)
    if not attempt:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("No completed attempt found")
    return await _serialize_result(svc, user, attempt.id)


@router.post(
    "/{quiz_id}/attempts",
    response_model=AttemptStartOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def start_attempt(
    quiz_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = QuizService(db)
    attempt = await svc.start_attempt(user, quiz_id)
    quiz = await svc.get_student_detail(user, quiz_id)
    return AttemptStartOut(
        attempt_id=attempt.id,
        quiz=QuizDetailOut.model_validate(quiz),
        started_at=attempt.started_at,
    )


@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=AttemptResultOut,
    dependencies=[Depends(require_role(UserRole.STUDENT))],
)
async def submit_attempt(
    attempt_id: int,
    payload: AttemptSubmitIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = QuizService(db)
    attempt = await svc.submit_attempt(
        user,
        attempt_id,
        answers=[a.model_dump() for a in payload.answers],
        time_taken_seconds=payload.time_taken_seconds,
    )
    return await _serialize_result(svc, user, attempt.id)


@router.get(
    "/attempts/{attempt_id}",
    response_model=AttemptResultOut,
)
async def get_attempt(
    attempt_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    svc = QuizService(db)
    return await _serialize_result(svc, user, attempt_id)


async def _serialize_result(svc: QuizService, user, attempt_id: int) -> AttemptResultOut:
    attempt, quiz = await svc.get_attempt_result(user, attempt_id)
    qmap = {q.id: q for q in quiz.questions}
    answers_out = []
    for a in attempt.answers:
        q = qmap.get(a.question_id)
        answers_out.append({
            "question_id": a.question_id,
            "given_answer": a.given_answer,
            "correct_answer": q.correct_answer if q else "",
            "is_correct": a.is_correct,
            "points_awarded": a.points_awarded,
            "explanation": q.explanation if q else None,
        })
    weak = (attempt.weak_topics or {}).get("items")
    return AttemptResultOut(
        attempt_id=attempt.id,
        quiz_id=attempt.quiz_id,
        score=attempt.score,
        max_score=attempt.max_score,
        percentage=attempt.percentage,
        passed=attempt.passed,
        time_taken_seconds=attempt.time_taken_seconds,
        weak_topics=weak,
        answers=answers_out,
        started_at=attempt.started_at,
        completed_at=attempt.completed_at,
    )