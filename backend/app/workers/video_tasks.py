import asyncio
import json
import os
import subprocess
import tempfile
from pathlib import Path

from celery import shared_task

from app.config.logging import get_logger
from app.config.settings import settings
from app.core.exceptions import ValidationError
from app.core.youtube import extract_video_id, fetch_metadata, fetch_transcript
from app.db.session import AsyncSessionLocal
from app.repositories.file_repository import FileRepository
from app.repositories.video_repository import VideoRepository
from app.services.ai.gemini_client import GeminiClient
from app.services.file_service import FileService
from app.services.storage import get_storage
from app.services.video_service import VideoService

logger = get_logger("worker.video")


def _run(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
    except RuntimeError:
        pass
    return asyncio.run(coro)


def _extract_upload_metadata(video_bytes: bytes, suffix: str = ".mp4") -> tuple[int | None, bytes | None]:
    """Use ffprobe/ffmpeg for actual uploaded files only; returns duration + poster JPEG."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"source{suffix}"
        poster = Path(tmp) / "poster.jpg"
        src.write_bytes(video_bytes)
        duration = None
        try:
            out = subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(src)],
                text=True,
                timeout=30,
            ).strip()
            if out:
                duration = int(float(out))
        except Exception as exc:  # noqa: BLE001
            logger.warning("ffprobe_failed", error=str(exc))
        poster_bytes = None
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-ss", "0", "-i", str(src), "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "3", str(poster)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=60,
            )
            poster_bytes = poster.read_bytes()
        except Exception as exc:  # noqa: BLE001
            logger.warning("poster_generation_failed", error=str(exc))
        return duration, poster_bytes


def _parse_ai_json(text: str) -> dict:
    raw = text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {"summary": raw}
    except json.JSONDecodeError:
        return {"summary": raw}


def _video_ai_prompt() -> str:
    return """
You are the AI learning engine of LearnMate AI. Analyze the ENTIRE educational video, not only a short excerpt.
Return valid JSON with these fields:
{
  "summary": "A complete but readable summary of the whole lesson.",
  "key_points": ["main concept 1", "main concept 2"],
  "study_notes": ["structured study note 1", "structured study note 2"],
  "quiz": [{"question":"...","options":["A","B","C","D"],"answer_index":0,"explanation":"..."}]
}
Use only facts present in the video. Never invent missing content. Do not generate video chapters. Chapter data comes only from the original YouTube chapter metadata when available.
""".strip()


async def _process_video_async(video_id: int) -> dict:
    async with AsyncSessionLocal() as db:
        svc = VideoService(db)
        video = await svc.mark_processing(video_id)
        if not video:
            return {"ok": False, "reason": "video_not_found"}

        try:
            # ---------- YouTube ----------
            if video.source.value == "YOUTUBE":
                external_id = video.external_id or extract_video_id(video.url)
                meta = await fetch_metadata(external_id)
                await svc.mark_source_ready(
                    video.id,
                    title=meta.title,
                    description=meta.description,
                    duration_seconds=meta.duration_seconds,
                    thumbnail_url=meta.thumbnail_url,
                )

                transcript_text = None
                transcript_language = "auto"
                transcript_segments = None
                try:
                    tr = fetch_transcript(external_id)
                    transcript_text = tr.text
                    transcript_language = tr.language
                    transcript_segments = tr.segments
                    logger.info(
                        "youtube_transcript_ready",
                        video_id=video.id,
                        language=transcript_language,
                        characters=len(transcript_text or ""),
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "youtube_transcript_optional_failed",
                        video_id=video.id,
                        error=str(exc),
                    )

                # Gemini analysis is optional. A Gemini/network/API failure must
                # never turn a valid YouTube source into FAILED.
                try:
                    client = GeminiClient()
                    raw, tokens = await asyncio.to_thread(
                        client.analyze_youtube_url,
                        youtube_url=f"https://www.youtube.com/watch?v={external_id}",
                        prompt=_video_ai_prompt(),
                    )
                    parsed = _parse_ai_json(raw)
                    if transcript_segments:
                        parsed.setdefault("transcript_segments", transcript_segments)
                    await svc.mark_analysis_ready(
                        video.id,
                        transcript=transcript_text,
                        language=transcript_language,
                        summary=str(parsed.get("summary") or raw),
                        key_points={
                            "items": parsed.get("key_points") or [],
                            "chapters": meta.chapters,
                            "chapter_source": "youtube" if meta.chapters else "none",
                        },
                        notes_json={"items": parsed.get("study_notes") or []},
                        quiz_json={"items": parsed.get("quiz") or []},
                        model_used=settings.GEMINI_MODEL,
                        tokens_used=tokens,
                    )
                except Exception as ai_exc:  # noqa: BLE001
                    logger.warning(
                        "youtube_ai_analysis_optional_failed",
                        video_id=video.id,
                        error=str(ai_exc),
                    )
                    # Preserve the transcript if available. If there is no
                    # transcript, create a completed source record with a clear
                    # analysis error so the UI can offer Retry instead of showing
                    # the entire video as FAILED.
                    if transcript_text:
                        await svc.mark_analysis_ready(
                            video.id,
                            transcript=transcript_text,
                            language=transcript_language,
                            summary="Transcript available. AI analysis is not ready yet; retry from the video page.",
                            key_points={
                                "items": [],
                                "chapters": meta.chapters,
                                "chapter_source": "youtube" if meta.chapters else "none",
                            },
                            notes_json={"items": []},
                            quiz_json={"items": []},
                            model_used="youtube-transcript",
                        )
                    else:
                        await svc.mark_analysis_ready(
                            video.id,
                            transcript=None,
                            language="auto",
                            summary=None,
                            key_points={
                                "items": [],
                                "chapters": meta.chapters,
                                "chapter_source": "youtube" if meta.chapters else "none",
                            },
                            notes_json={"items": []},
                            quiz_json={"items": []},
                            model_used=None,
                        )
                        analysis = await svc.videos.get_analysis(video.id)
                        if analysis:
                            await svc.videos.mark_analysis_failed(video.id, str(ai_exc))
                            await svc.db.commit()
                return {"ok": True, "video_id": video.id, "source": "YOUTUBE"}

            # ---------- Uploaded video ----------
            if not video.file_id:
                raise ValidationError("Uploaded video is missing its storage record")
            file_row = await FileRepository(db).get(video.file_id)
            if not file_row:
                raise ValidationError("Uploaded video storage record not found")
            data = await get_storage().get(key=file_row.key, bucket=file_row.bucket)
            duration, poster_bytes = await asyncio.to_thread(_extract_upload_metadata, data, Path(file_row.original_name).suffix or ".mp4")
            thumbnail_url = video.thumbnail_url
            if poster_bytes:
                poster_file = await FileService(db).store_bytes(
                    owner_id=video.owner_id,
                    filename=f"video-{video.id}-poster.jpg",
                    data=poster_bytes,
                    mime_type="image/jpeg",
                    category="thumbnail",
                    is_public=False,
                )
                thumbnail_url = await FileService(db).url_for(poster_file)
            await svc.mark_source_ready(video.id, duration_seconds=duration, thumbnail_url=thumbnail_url)

            try:
                client = GeminiClient()
                raw, tokens = await asyncio.to_thread(
                    client.generate_video_analysis,
                    video_bytes=data,
                    mime_type=file_row.mime_type or "video/mp4",
                    prompt=_video_ai_prompt(),
                )
                parsed = _parse_ai_json(raw)
                await svc.mark_analysis_ready(
                    video.id,
                    transcript=None,
                    language="auto",
                    summary=str(parsed.get("summary") or raw),
                    key_points={"items": parsed.get("key_points") or [], "chapters": [], "chapter_source": "none"},
                    notes_json={"items": parsed.get("study_notes") or []},
                    quiz_json={"items": parsed.get("quiz") or []},
                    model_used=settings.GEMINI_MODEL,
                    tokens_used=tokens,
                )
            except Exception as ai_exc:  # noqa: BLE001
                logger.warning("uploaded_video_ai_analysis_failed", video_id=video.id, error=str(ai_exc))
                await svc.mark_analysis_ready(
                    video.id,
                    transcript=None,
                    language="auto",
                    summary=None,
                    key_points={"items": [], "chapters": [], "chapter_source": "none"},
                    notes_json={"items": []},
                    quiz_json={"items": []},
                    model_used=None,
                )
                await svc.videos.mark_analysis_failed(video.id, str(ai_exc))
                await svc.db.commit()
            return {"ok": True, "video_id": video.id, "source": "UPLOAD"}

        except Exception as exc:  # noqa: BLE001
            logger.error("video_processing_failed", video_id=video_id, error=str(exc), exc_info=True)
            await svc.mark_failed(video_id, str(exc))
            raise


@shared_task(
    name="video.process",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=2,
)
def process_video(self, video_id: int) -> dict:
    logger.info("process_video_start", video_id=video_id, attempt=self.request.retries + 1)
    return _run(_process_video_async(video_id))
