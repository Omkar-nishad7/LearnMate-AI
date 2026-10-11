
from typing import Annotated, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser
from app.models.user import UserRole
from app.repositories.ai_repository import AIRepository
from app.services.ai.notes_service import NotesAIService
from app.services.ai.quiz_service import QuizAIService
from app.services.ai.summary_service import SummaryService
from app.services.ai.tutor_service import TutorService
from app.services.ai.usage import remaining
from app.services.video_service import VideoService
from app.schemas.ai import (
    AIMessageOut,
    AIConversationOut,
    ConversationDetailOut,
    NotesFromVideoRequest,
    NotesOut,
    QuizFromVideoRequest,
    QuizOut,
    SummaryOut,
    SummaryRequest,
    TutorAskRequest,
    TutorAskResponse,
    UsageOut,
)

router = APIRouter(prefix="/ai", tags=["ai"])


# ---------------- Tutor ----------------
@router.post("/tutor", response_model=TutorAskResponse)
async def ai_tutor_ask(
    payload: TutorAskRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if payload.video_id is not None:
        await VideoService(db).get_for_viewer(user, payload.video_id)

    conv, msg = await TutorService(db).ask(
        user_id=user.id,
        message=payload.message,
        conversation_id=payload.conversation_id,
        course_id=payload.course_id,
        video_id=payload.video_id,
        playback_position_seconds=payload.playback_position_seconds,
    )

    return TutorAskResponse(
        conversation=AIConversationOut.model_validate(conv),
        message=AIMessageOut.model_validate(msg),
    )


@router.get(
    "/tutor/conversations",
    response_model=List[AIConversationOut],
)
async def list_conversations(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    rows, _ = await AIRepository(db).list_conversations(
        user.id,
        feature="tutor",
        page=page,
        page_size=page_size,
    )

    return [AIConversationOut.model_validate(c) for c in rows]


@router.get(
    "/tutor/conversations/{conv_id}",
    response_model=ConversationDetailOut,
)
async def get_conversation(
    conv_id: int,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ai = AIRepository(db)
    conv = await ai.get_conversation(conv_id)

    # Do not reveal whether another user's conversation exists.
    from app.core.exceptions import NotFoundError

    if not conv or conv.user_id != user.id:
        raise NotFoundError("Conversation not found")

    # Explicitly fetch messages using the async repository.
    msgs = await ai.get_messages(conv_id, limit=200)

    # Validate only conversation fields here. Do not validate the
    # complete ORM object as ConversationDetailOut because that can
    # trigger an implicit async load of conv.messages.
    conversation_data = AIConversationOut.model_validate(
        conv
    ).model_dump()

    return ConversationDetailOut(
        **conversation_data,
        messages=[
            AIMessageOut.model_validate(message)
            for message in msgs
        ],
    )


# ---------------- Video AI ----------------
@router.post("/summarize", response_model=SummaryOut)
async def summarize(
    payload: SummaryRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await VideoService(db).get_for_viewer(
        user,
        payload.video_id,
    )

    result = await SummaryService(db).generate_for_video(
        user_id=user.id,
        video_id=payload.video_id,
    )

    return SummaryOut(**result)


@router.post("/generate-notes", response_model=NotesOut)
async def generate_notes(
    payload: NotesFromVideoRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await VideoService(db).get_for_viewer(
        user,
        payload.video_id,
    )

    note = await NotesAIService(db).generate_for_video(
        user_id=user.id,
        video_id=payload.video_id,
        course_id=payload.course_id,
    )

    return NotesOut.model_validate(note)


@router.post("/generate-quiz", response_model=QuizOut)
async def generate_quiz(
    payload: QuizFromVideoRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await VideoService(db).get_for_viewer(
        user,
        payload.video_id,
    )

    quiz = await QuizAIService(db).generate_for_video(
        user_id=user.id,
        video_id=payload.video_id,
        num_questions=payload.num_questions,
        course_id=payload.course_id,
        publish_for_student=user.role == UserRole.STUDENT,
    )

    return QuizOut.model_validate(quiz)


# ---------------- Usage ----------------
@router.get("/usage", response_model=List[UsageOut])
async def get_usage(
    user: CurrentUser,
    feature: str = Query(default="tutor"),
):
    return [
        UsageOut(
            feature=feature,
            remaining_today=await remaining(feature, user.id),
        )
    ]
