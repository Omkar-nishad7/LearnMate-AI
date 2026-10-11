from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_exceptions import AIInvalidOutputError
from app.repositories.video_repository import VideoRepository
from app.models.video import VideoSource
from app.services.ai.gemini_client import GeminiClient
from app.services.ai.prompt_loader import render_prompt
from app.services.ai.schemas import SummaryOutput
from app.services.ai.usage import check_and_increment, log_usage


class SummaryService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.videos = VideoRepository(db)

    async def generate_for_video(self, *, user_id: int, video_id: int) -> dict:
        await check_and_increment("video_analysis", user_id)

        analysis = await self.videos.get_analysis(video_id)
        video = await self.videos.get_by_id(video_id)
        if not video:
            raise AIInvalidOutputError("Video not found")

        use_direct_youtube = video.source == VideoSource.YOUTUBE and not (analysis and analysis.transcript)
        if use_direct_youtube:
            prompt = (
                "You are an expert educational summarizer. Analyze the entire public YouTube video at this URL. "
                "Return STRICT JSON with keys summary, key_points, topics, estimated_study_minutes. "
                "Use only information present in the video. URL: " + video.url
            )
        else:
            if not analysis or not analysis.transcript:
                raise AIInvalidOutputError("Video has no transcript yet")
            prompt = render_prompt("summary", transcript=analysis.transcript[:60000])

        try:
            if use_direct_youtube:
                raw, tokens = GeminiClient().analyze_youtube_json(youtube_url=video.url, prompt=prompt)
            else:
                raw, tokens = GeminiClient().generate_json(prompt=prompt, max_output_tokens=2048)
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="video_analysis",
                status="FAILED", error_message=str(e),
                metadata={"video_id": video_id, "kind": "summary"},
            )
            await self.db.commit()
            raise

        try:
            data = SummaryOutput.model_validate(raw).model_dump()
        except Exception as e:
            await log_usage(
                self.db, user_id=user_id, feature="video_analysis",
                status="INVALID_OUTPUT", error_message=str(e),
                metadata={"video_id": video_id, "kind": "summary"},
            )
            await self.db.commit()
            raise AIInvalidOutputError(f"Summary schema invalid: {e}")

        analysis.summary = data["summary"]
        analysis.key_points = {
            "points": data["key_points"],
            "topics": data["topics"],
            "estimated_study_minutes": data["estimated_study_minutes"],
        }
        await self.db.flush()
        await log_usage(
            self.db, user_id=user_id, feature="video_analysis",
            status="SUCCESS", tokens_used=tokens,
            metadata={"video_id": video_id, "kind": "summary"},
        )
        await self.db.commit()
        return data