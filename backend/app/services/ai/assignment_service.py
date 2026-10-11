from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_exceptions import AIInvalidOutputError
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.schemas import AssignmentOutput
from app.services.ai.usage import check_and_increment, log_usage


class AssignmentAIService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(
        self,
        *,
        user_id: int,
        topic: str,
        difficulty: str = "intermediate",
        audience: str = "undergraduate students",
        notes: str = "",
    ) -> dict:
        await check_and_increment("teacher", user_id)
        if not topic.strip():
            raise AIInvalidOutputError("topic is required")

        prompt = render_prompt(
            "assignment",
            topic=topic.strip(),
            difficulty=difficulty,
            audience=audience,
            notes=notes or "(none)",
        )
        try:
            raw, tokens = GeminiClient().generate_json(prompt=prompt, max_output_tokens=4096)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="teacher",
                status="FAILED", error_message=str(e),
                metadata={"kind": "assignment"},
            )
            await self.db.commit()
            raise

        try:
            data = AssignmentOutput.model_validate(raw).model_dump()
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="teacher",
                status="INVALID_OUTPUT", error_message=str(e),
                metadata={"kind": "assignment"},
            )
            await self.db.commit()
            raise AIInvalidOutputError(f"Assignment schema invalid: {e}")

        await log_usage(
            self.db, user_id=user_id, feature="teacher",
            status="SUCCESS", tokens_used=tokens,
            metadata={"kind": "assignment"},
        )
        await self.db.commit()
        return data