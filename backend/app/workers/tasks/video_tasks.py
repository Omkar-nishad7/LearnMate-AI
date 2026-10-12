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
  "chapters": [{"title":"...","start_seconds":0,"end_seconds":120,"summary":"..."}],
  "study_notes": ["structured study note 1", "structured study note 2"],
  "quiz": [{"question":"...","options":["A","B","C","D"],"answer_index":0,"explanation":"..."}]
}
Use only facts present in the video. Never invent missing content. Use timestamps when identifiable.
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

                # Transcript extraction runs in its own lightweight task so
                # it can complete independently of Gemini analysis. This keeps
                # caption loading fast even when AI analysis is slow or fails.
                existing_analysis = await svc.videos.get_analysis(video.id)
                transcript_text = existing_analysis.transcript if existing_analysis else None
                transcript_language = existing_analysis.language if existing_analysis else "auto"
                transcript_segments = None

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
                            "chapters": parsed.get("chapters") or [],
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
                            key_points={"items": [], "chapters": transcript_segments or []},
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
                            key_points={"items": [], "chapters": []},
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
                    key_points={"items": parsed.get("key_points") or [], "chapters": parsed.get("chapters") or []},
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
                    key_points={"items": [], "chapters": []},
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


async def _fetch_video_transcript_async(video_id: int) -> dict:
    """Fetch and persist a transcript using the current async application loop."""
    async with AsyncSessionLocal() as db:
        svc = VideoService(db)
        video = await svc.videos.get_by_id(video_id)
        if not video or video.source.value != "YOUTUBE":
            return {"ok": False, "reason": "not_youtube", "video_id": video_id}

        external_id = video.external_id or extract_video_id(video.url)
        try:
            transcript = await asyncio.to_thread(fetch_transcript, external_id)
            await svc.videos.update_analysis_content(
                video_id,
                transcript=transcript.text,
                language=transcript.language or "auto",
                model_used="youtube-transcript",
            )
            await db.commit()
            logger.info(
                "youtube_transcript_ready",
                video_id=video_id,
                language=transcript.language,
                characters=len(transcript.text),
            )
            return {"ok": True, "video_id": video_id, "characters": len(transcript.text)}
        except Exception as exc:  # noqa: BLE001
            logger.warning("youtube_transcript_task_failed", video_id=video_id, error=str(exc))
            raise


async def fetch_video_transcript_inline(video_id: int) -> dict:
    """Process a transcript inside the existing API service (no Celery worker required).

    FastAPI awaits async background functions on the app event loop, keeping the
    async SQLAlchemy engine on its normal loop. Network fetching is moved to a
    thread by _fetch_video_transcript_async so it doesn't block other API requests.
    """
    logger.info("youtube_transcript_inline_start", video_id=video_id)
    try:
        return await _fetch_video_transcript_async(video_id)
    except Exception as exc:  # noqa: BLE001
        logger.error("youtube_transcript_inline_failed", video_id=video_id, error=str(exc))
        return {"ok": False, "video_id": video_id, "error": str(exc)}


@shared_task(
    name="video.transcript",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    retry_jitter=True,
    max_retries=2,
)
def fetch_video_transcript(self, video_id: int) -> dict:
    """Celery entry point retained for deployments that run a separate worker."""
    logger.info("youtube_transcript_task_start", video_id=video_id, attempt=self.request.retries + 1)
    return _run(_fetch_video_transcript_async(video_id))

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
