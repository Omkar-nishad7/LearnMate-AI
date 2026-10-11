from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_exceptions import AIInvalidOutputError
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.schemas import CourseOutput
from app.services.ai.usage import check_and_increment, log_usage


class CourseAIService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_outline(
        self,
        *,
        user_id: int,
        topic: str,
        difficulty: str = "beginner",
        audience: str = "general learners",
        num_modules: int = 4,
    ) -> dict:
        await check_and_increment("teacher", user_id)
        if not topic.strip():
            raise AIInvalidOutputError("topic is required")
        if not (1 <= num_modules <= 20):
            raise AIInvalidOutputError("num_modules must be between 1 and 20")

        prompt = render_prompt(
            "course",
            topic=topic.strip(),
            difficulty=difficulty,
            audience=audience,
            num_modules=str(num_modules),
        )
        try:
            raw, tokens = GeminiClient().generate_json(prompt=prompt, max_output_tokens=8192)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="teacher",
                status="FAILED", error_message=str(e),
                metadata={"kind": "course_outline"},
            )
            await self.db.commit()
            raise

        try:
            data = CourseOutput.model_validate(raw).model_dump()
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="teacher",
                status="INVALID_OUTPUT", error_message=str(e),
                metadata={"kind": "course_outline"},
            )
            await self.db.commit()
            raise AIInvalidOutputError(f"Course schema invalid: {e}")

        await log_usage(
            self.db, user_id=user_id, feature="teacher",
            status="SUCCESS", tokens_used=tokens,
            metadata={"kind": "course_outline"},
        )
        await self.db.commit()
        return data