from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_exceptions import AIInvalidOutputError
from app.models.quiz import (
    QuestionType,
    Quiz,
    QuizQuestion,
    QuizStatus,
)
from app.repositories.video_repository import VideoRepository
from app.models.video import VideoSource
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.schemas import QuizOutput
from app.services.ai.usage import check_and_increment, log_usage


class QuizAIService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.videos = VideoRepository(db)

    async def generate_for_video(
        self,
        *,
        user_id: int,
        video_id: int,
        num_questions: int = 5,
        course_id: int | None = None,
        publish_for_student: bool = False,
    ) -> Quiz:
        await check_and_increment("quiz", user_id)

        if not (1 <= num_questions <= 25):
            raise AIInvalidOutputError("num_questions must be between 1 and 25")

        analysis = await self.videos.get_analysis(video_id)
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise AIInvalidOutputError("Video not found")

        use_direct_youtube = video.source == VideoSource.YOUTUBE and not (analysis and analysis.transcript)
        if use_direct_youtube:
            prompt = (
                "You are an expert assessment designer. Analyze the entire public YouTube video at this URL and "
                f"generate exactly {num_questions} useful student questions. Return STRICT JSON with title and questions. "
                "Every MCQ must have four options A-D and a valid correct_answer. Use only information present in the video. "
                "URL: " + video.url
            )
        else:
            if not analysis or not analysis.transcript:
                raise AIInvalidOutputError("Video has no transcript yet")
            prompt = render_prompt(
                "quiz",
                transcript=analysis.transcript[:60000],
                num_questions=str(num_questions),
            )

        try:
            if use_direct_youtube:
                raw, tokens = GeminiClient().analyze_youtube_json(youtube_url=video.url, prompt=prompt)
            else:
                raw, tokens = GeminiClient().generate_json(prompt=prompt, max_output_tokens=4096)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="quiz",
                status="FAILED", error_message=str(e),
                metadata={"video_id": video_id},
            )
            await self.db.commit()
            raise

        try:
            data = QuizOutput.model_validate(raw)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="quiz",
                status="INVALID_OUTPUT", error_message=str(e),
                metadata={"video_id": video_id},
            )
            await self.db.commit()
            raise AIInvalidOutputError(f"Quiz schema invalid: {e}")

        quiz = Quiz(
            creator_id=user_id,
            course_id=course_id,
            title=data.title,
            status=QuizStatus.PUBLISHED if publish_for_student else QuizStatus.DRAFT,
            is_ai_generated=True,
            total_points=sum(q.points for q in data.questions),
        )
        self.db.add(quiz)
        await self.db.flush()

        for idx, q in enumerate(data.questions):
            self.db.add(
                QuizQuestion(
                    quiz_id=quiz.id,
                    question_type=QuestionType(q.question_type),
                    question_text=q.question_text,
                    options=q.options,
                    correct_answer=q.correct_answer,
                    explanation=q.explanation,
                    difficulty=q.difficulty,
                    topic=q.topic,
                    points=q.points,
                    order_index=idx,
                )
            )
        await self.db.flush()

        await log_usage(
            self.db, user_id=user_id, feature="quiz",
            status="SUCCESS", tokens_used=tokens,
            metadata={"video_id": video_id, "quiz_id": quiz.id},
        )
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz