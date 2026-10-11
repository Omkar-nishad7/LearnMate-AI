import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import html
import json
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional
from urllib.parse import parse_qs, urlparse

import httpx
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

from app.config.logging import get_logger
from app.core.exceptions import ValidationError

logger = get_logger("youtube")

_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com"}
_YOUTU_BE_HOSTS = {"youtu.be", "www.youtu.be"}
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_OEMBED = "https://www.youtube.com/oembed"


@dataclass(frozen=True)
class TranscriptResult:
    text: str
    language: str
    segments: list[dict]


@dataclass(frozen=True)
class YouTubeMeta:
    video_id: str
    title: str
    author: str
    description: str
    thumbnail_url: Optional[str]
    duration_seconds: Optional[int]
    chapters: list[dict]


def extract_video_id(url: str) -> str:
    if not url or len(url) > 1000:
        raise ValidationError("Invalid YouTube URL")
    raw = url.strip()
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    host = (parsed.hostname or "").lower().rstrip(".")
    video_id: Optional[str] = None
    if host in _YOUTUBE_HOSTS:
        if parsed.path in ("/watch", "/watch/"):
            video_id = parse_qs(parsed.query).get("v", [None])[0]
        elif parsed.path.startswith("/embed/"):
            video_id = parsed.path.split("/embed/", 1)[1].split("/", 1)[0]
        elif parsed.path.startswith("/shorts/"):
            video_id = parsed.path.split("/shorts/", 1)[1].split("/", 1)[0]
        elif parsed.path.startswith("/live/"):
            video_id = parsed.path.split("/live/", 1)[1].split("/", 1)[0]
    elif host in _YOUTU_BE_HOSTS:
        video_id = parsed.path.strip("/").split("/", 1)[0]
    if not video_id or not _VIDEO_ID_RE.fullmatch(video_id):
        raise ValidationError("Please enter a valid public YouTube video URL")
    return video_id


async def _fetch_metadata_oembed(video_id: str) -> YouTubeMeta:
    params = {"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(_OEMBED, params=params)
        response.raise_for_status()
        data = response.json()
    return YouTubeMeta(
        video_id=video_id,
        title=data.get("title") or f"YouTube video {video_id}",
        author=data.get("author_name") or "",
        description="",
        thumbnail_url=data.get("thumbnail_url") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        duration_seconds=None,
        chapters=[],
    )


def _timestamp_seconds(value: str) -> float:
    raw = str(value or "0").replace(",", ".").strip()
    parts = raw.split(":")
    try:
        if len(parts) == 3:
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        if len(parts) == 2:
            return float(parts[0]) * 60 + float(parts[1])
        return float(raw)
    except (TypeError, ValueError):
        return 0.0


def _normalise_chapters(raw_chapters, duration_seconds: Optional[int] = None) -> list[dict]:
    chapters: list[dict] = []
    for chapter in raw_chapters or []:
        try:
            start = float(chapter.get("start_time", chapter.get("start_seconds", 0)) or 0)
            end_raw = chapter.get("end_time", chapter.get("end_seconds"))
            end = float(end_raw) if end_raw is not None else None
            title = re.sub(r"\s+", " ", str(chapter.get("title") or "")).strip()
            if not title or start < 0:
                continue
            if duration_seconds is not None and start >= duration_seconds:
                continue
            chapters.append({
                "title": title,
                "start_seconds": start,
                "end_seconds": end,
            })
        except (TypeError, ValueError):
            continue

    chapters.sort(key=lambda item: item["start_seconds"])
    deduped: list[dict] = []
    seen: set[float] = set()
    for chapter in chapters:
        if chapter["start_seconds"] in seen:
            continue
        seen.add(chapter["start_seconds"])
        deduped.append(chapter)

    for index in range(len(deduped) - 1):
        if not deduped[index].get("end_seconds") or deduped[index]["end_seconds"] <= deduped[index]["start_seconds"]:
            deduped[index]["end_seconds"] = deduped[index + 1]["start_seconds"]
    if deduped and duration_seconds is not None:
        last = deduped[-1]
        if not last.get("end_seconds") or last["end_seconds"] <= last["start_seconds"]:
            last["end_seconds"] = float(duration_seconds)
    return deduped


def _extract_description_chapters(description: str, duration_seconds: Optional[int] = None) -> list[dict]:
    """Extract explicit creator timestamps from a YouTube description.

    We intentionally require a 0:00 first entry and at least three entries so
    ordinary timestamps/links in a description are not mistaken for chapters.
    """
    if not description:
        return []

    # Accept normal lines as well as descriptions where timestamps are followed
    # by a title on the same line. This mirrors YouTube's chapter convention.
    pattern = re.compile(
        r"(?m)(?<!\d)(\d{1,2}:(?:\d{2})(?::\d{2})?)\s*(?:[-–—|:]\s*)?([^\n\r]+)"
    )
    raw: list[dict] = []
    for match in pattern.finditer(description):
        start = _timestamp_seconds(match.group(1))
        title = re.sub(r"\s+", " ", match.group(2)).strip(" -–—|:")
        if not title or start < 0:
            continue
        if duration_seconds is not None and start >= duration_seconds:
            continue
        raw.append({"title": title, "start_seconds": start, "end_seconds": None})

    # Creator chapters must begin at 0:00 and contain at least three chapters.
    raw.sort(key=lambda item: item["start_seconds"])
    if len(raw) < 3 or raw[0]["start_seconds"] != 0:
        return []

    return _normalise_chapters(raw, duration_seconds)


def _yt_dlp_options() -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        # Explicitly request subtitle metadata, including automatic captions.
        # This is important because merely calling extract_info() is not
        # guaranteed to populate caption tracks in every yt-dlp configuration.
        "writesubtitles": True,
        "writeautomaticsub": True,
        "allsubtitles": True,
        "subtitleslangs": ["all"],
    }


def _fetch_metadata_ytdlp(video_id: str) -> YouTubeMeta:
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(_yt_dlp_options()) as ydl:
        info = ydl.extract_info(url, download=False)

    duration = info.get("duration")
    duration_seconds = int(duration) if duration is not None else None
    chapters = _normalise_chapters(info.get("chapters") or [], duration_seconds)
    description = info.get("description") or ""
    if not chapters:
        chapters = _extract_description_chapters(description, duration_seconds)

    return YouTubeMeta(
        video_id=video_id,
        title=info.get("title") or f"YouTube video {video_id}",
        author=info.get("uploader") or info.get("channel") or "",
        description=description,
        thumbnail_url=info.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        duration_seconds=duration_seconds,
        chapters=chapters,
    )


async def fetch_metadata(video_id: str) -> YouTubeMeta:
    try:
        meta = await _fetch_metadata_oembed(video_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("youtube_oembed_failed", video_id=video_id, error=str(exc))
        try:
            return await asyncio.to_thread(_fetch_metadata_ytdlp, video_id)
        except Exception as ytdlp_exc:  # noqa: BLE001
            logger.warning("youtube_metadata_fallback_failed", video_id=video_id, error=str(ytdlp_exc))
            return YouTubeMeta(
                video_id=video_id,
                title=f"YouTube video {video_id}",
                author="",
                description="",
                thumbnail_url=f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                duration_seconds=None,
                chapters=[],
            )

    # oEmbed has no duration/description/chapters, so enrich with yt-dlp.
    try:
        richer = await asyncio.to_thread(_fetch_metadata_ytdlp, video_id)
        return YouTubeMeta(
            video_id=video_id,
            title=meta.title if meta.title and not meta.title.startswith("YouTube video ") else richer.title,
            author=meta.author or richer.author,
            description=richer.description,
            thumbnail_url=meta.thumbnail_url or richer.thumbnail_url,
            duration_seconds=richer.duration_seconds,
            chapters=richer.chapters,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("youtube_metadata_enrichment_failed", video_id=video_id, error=str(exc))
        return meta


def _clean_caption_text(value: str) -> str:
    value = html.unescape(re.sub(r"<[^>]+>", " ", str(value or "")))
    return re.sub(r"\s+", " ", value).strip()


def _parse_vtt(text: str) -> list[dict]:
    lines = text.replace("\r", "").split("\n")
    segments: list[dict] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if "-->" not in line:
            i += 1
            continue
        left, right = [part.strip() for part in line.split("-->", 1)]
        end_token = right.split(" ", 1)[0]
        start = _timestamp_seconds(left)
        end = _timestamp_seconds(end_token)
        i += 1
        parts: list[str] = []
        while i < len(lines) and lines[i].strip():
            candidate = lines[i].strip()
            if not candidate.startswith(("NOTE", "STYLE", "REGION")):
                parts.append(candidate)
            i += 1
        clean = _clean_caption_text(" ".join(parts))
        if clean:
            segments.append({"start": start, "duration": max(0.0, end - start), "text": clean})
        i += 1
    return segments


def _parse_srv3(text: str) -> list[dict]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    segments: list[dict] = []
    for node in root.iter("text"):
        clean = _clean_caption_text("".join(node.itertext()))
        if not clean:
            continue
        start = float(node.attrib.get("start", "0") or 0)
        duration = float(node.attrib.get("dur", "0") or 0)
        segments.append({"start": start, "duration": duration, "text": clean})
    return segments


def _parse_ttml(text: str) -> list[dict]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    segments: list[dict] = []
    for node in root.iter():
        if not node.tag.endswith("p"):
            continue
        clean = _clean_caption_text("".join(node.itertext()))
        if not clean:
            continue
        start = _timestamp_seconds(node.attrib.get("begin", "0"))
        end = _timestamp_seconds(node.attrib.get("end", "0"))
        duration = max(0.0, end - start)
        segments.append({"start": start, "duration": duration, "text": clean})
    return segments


def _parse_json3(text: str) -> list[dict]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    segments: list[dict] = []
    for event in data.get("events", []):
        start = float(event.get("tStartMs", 0) or 0) / 1000.0
        duration = float(event.get("dDurationMs", 0) or 0) / 1000.0
        parts = [seg.get("utf8") for seg in event.get("segs", []) or [] if seg.get("utf8")]
        clean = _clean_caption_text("".join(parts))
        if clean:
            segments.append({"start": start, "duration": duration, "text": clean})
    return segments


def _parse_caption(raw: str, ext: str) -> list[dict]:
    lower = (ext or "").lower()
    if lower == "json3" or raw.lstrip().startswith('{"events"'):
        return _parse_json3(raw)
    if lower == "srv3" or raw.lstrip().startswith("<transcript"):
        return _parse_srv3(raw)
    if lower in {"ttml", "xml"} or "<tt:p" in raw[:1000]:
        return _parse_ttml(raw)
    return _parse_vtt(raw)


def _fetch_transcript_ytdlp(video_id: str, languages: list[str]) -> TranscriptResult:
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(_yt_dlp_options()) as ydl:
        info = ydl.extract_info(url, download=False)

        tracks = info.get("subtitles") or {}
        automatic = info.get("automatic_captions") or {}
        requested = info.get("requested_subtitles") or {}

        ordered_languages: list[str] = []
        for lang in languages:
            if lang not in ordered_languages:
                ordered_languages.append(lang)
        for lang in tracks:
            if lang not in ordered_languages:
                ordered_languages.append(lang)
        for lang in automatic:
            if lang not in ordered_languages:
                ordered_languages.append(lang)
        for lang in requested:
            if lang not in ordered_languages:
                ordered_languages.append(lang)

        # Prefer manual captions, then generated captions. Within each language
        # prefer machine-readable formats first.
        groups = [(lang, tracks.get(lang) or []) for lang in ordered_languages]
        groups += [(lang, automatic.get(lang) or []) for lang in ordered_languages if lang not in tracks]
        if requested:
            groups += [(lang, value if isinstance(value, list) else [value]) for lang, value in requested.items()]

        seen_urls: set[str] = set()
        for lang, candidates in groups:
            ranked = sorted(
                candidates,
                key=lambda item: {"json3": 0, "vtt": 1, "srv3": 2, "ttml": 3}.get(item.get("ext"), 9),
            )
            for fmt in ranked:
                caption_url = fmt.get("url")
                if not caption_url or caption_url in seen_urls:
                    continue
                seen_urls.add(caption_url)
                try:
                    headers = fmt.get("http_headers") or {}
                    raw = ydl.urlopen(caption_url, headers=headers).read().decode("utf-8", errors="replace")
                    segments = _parse_caption(raw, fmt.get("ext") or "")
                    if segments:
                        full = " ".join(item["text"] for item in segments).strip()
                        if full:
                            return TranscriptResult(text=full, language=lang, segments=segments)
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "youtube_caption_track_failed",
                        video_id=video_id,
                        language=lang,
                        error=str(exc),
                    )
    raise ValidationError("The video has no accessible transcript")


def _fetch_transcript_api(video_id: str, languages: list[str]) -> TranscriptResult:
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    selected = None
    try:
        selected = transcript_list.find_transcript(languages)
    except Exception:
        available = list(transcript_list)
        if available:
            selected = available[0]

    if selected is None:
        raise ValidationError("The video has no accessible transcript")

    fetched = selected.fetch(preserve_formatting=False)
    snippets = getattr(fetched, "snippets", None)
    if snippets is None:
        snippets = fetched.to_raw_data()

    segments: list[dict] = []
    parts: list[str] = []
    for item in snippets:
        start = getattr(item, "start", None)
        duration = getattr(item, "duration", None)
        text = getattr(item, "text", None)
        if isinstance(item, dict):
            start = item.get("start")
            duration = item.get("duration")
            text = item.get("text")
        clean = _clean_caption_text(text or "")
        if not clean:
            continue
        parts.append(clean)
        segments.append({
            "start": float(start or 0),
            "duration": float(duration or 0),
            "text": clean,
        })

    full = " ".join(parts).strip()
    if not full:
        raise ValidationError("The video has no readable transcript")
    return TranscriptResult(
        text=full,
        language=getattr(selected, "language_code", None) or "auto",
        segments=segments,
    )


def fetch_transcript(video_id: str, languages: Optional[list[str]] = None) -> TranscriptResult:
    """Fetch a real YouTube caption track as quickly as possible.

    The two independent caption providers are attempted in parallel so a slow
    or blocked provider does not unnecessarily delay a working provider. No
    transcript is fabricated; manual and publicly exposed generated captions
    are accepted.
    """
    langs = languages or ["en", "en-US", "en-GB", "hi"]
    errors: list[str] = []

    def api_fetch():
        return _fetch_transcript_api(video_id, langs)

    def ytdlp_fetch():
        return _fetch_transcript_ytdlp(video_id, langs)

    executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="yt-transcript")
    futures = [executor.submit(api_fetch), executor.submit(ytdlp_fetch)]
    try:
        for future in as_completed(futures):
            try:
                result = future.result()
                # Do not wait for the slower fallback once a valid transcript
                # has been returned. Its worker thread may finish in the
                # background, but it no longer blocks the import task.
                executor.shutdown(wait=False, cancel_futures=True)
                return result
            except Exception as exc:  # noqa: BLE001
                errors.append(str(exc))

        raise ValidationError(
            "Unable to fetch YouTube captions. This usually means YouTube did not expose a public caption track "
            "to the server. The video remains playable; transcript-based AI tools need an accessible caption track."
        )
    finally:
        if any(not future.done() for future in futures):
            executor.shutdown(wait=False, cancel_futures=True)
