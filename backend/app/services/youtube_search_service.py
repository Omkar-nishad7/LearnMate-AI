from __future__ import annotations

import re
from typing import Any, Optional

import httpx

from app.config.settings import settings
from app.core.exceptions import ValidationError, AppError

YOUTUBE_API = "https://www.googleapis.com/youtube/v3"
_CHANNEL_ID_RE = re.compile(r"^UC[A-Za-z0-9_-]{10,}$")


class YouTubeSearchService:
    """Server-side gateway for public YouTube Data API lookups."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (api_key or settings.YOUTUBE_API_KEY or "").strip()
        if not self.api_key:
            raise AppError(
                "YouTube search is not configured. Add YOUTUBE_API_KEY to the backend environment.",
                status_code=503,
            )

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        request_params = {**params, "key": self.api_key}
        timeout = httpx.Timeout(20.0, connect=6.0)

        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(f"{YOUTUBE_API}/{path}", params=request_params)
        except httpx.HTTPError as exc:
            raise AppError(
                "YouTube is temporarily unavailable. Please try again in a moment.",
                status_code=503,
            ) from exc

        if response.status_code >= 400:
            detail = None
            reason = None
            try:
                payload = response.json()
                error = payload.get("error") or {}
                detail = error.get("message")
                errors = error.get("errors") or []
                if errors and isinstance(errors[0], dict):
                    reason = errors[0].get("reason")
            except (ValueError, TypeError):
                pass

            reason_text = str(reason or "").lower()
            if response.status_code in (401, 403) and any(
                token in reason_text
                for token in ("quota", "dailylimit", "keyinvalid", "accessnotconfigured")
            ):
                raise AppError(
                    "YouTube API access is unavailable. Check the server-side YOUTUBE_API_KEY and YouTube Data API quota.",
                    status_code=503,
                )

            if response.status_code >= 500:
                raise AppError(
                    "YouTube is temporarily unavailable. Please try again in a moment.",
                    status_code=503,
                )

            raise AppError(detail or "YouTube API request failed", status_code=response.status_code)

        try:
            return response.json()
        except ValueError as exc:
            raise AppError("YouTube returned an invalid response.", status_code=502) from exc

    async def search_videos(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        data = await self._get(
            "search",
            {
                "part": "snippet",
                "q": query,
                "type": "video",
                "maxResults": max(1, min(max_results, 25)),
                "safeSearch": "moderate",
            },
        )
        return [
            {
                "video_id": item.get("id", {}).get("videoId"),
                "title": item.get("snippet", {}).get("title", ""),
                "description": item.get("snippet", {}).get("description"),
                "thumbnail_url": (item.get("snippet", {}).get("thumbnails", {}).get("high") or {}).get("url"),
                "channel_id": item.get("snippet", {}).get("channelId"),
                "channel_title": item.get("snippet", {}).get("channelTitle"),
                "published_at": item.get("snippet", {}).get("publishedAt"),
            }
            for item in data.get("items", [])
            if item.get("id", {}).get("videoId")
        ]

    async def search_channels(self, query: str, max_results: int = 10) -> list[dict[str, Any]]:
        data = await self._get(
            "search",
            {
                "part": "snippet",
                "q": query,
                "type": "channel",
                "maxResults": max(1, min(max_results, 25)),
            },
        )
        return [
            {
                "channel_id": item.get("id", {}).get("channelId"),
                "title": item.get("snippet", {}).get("title", ""),
                "description": item.get("snippet", {}).get("description"),
                "thumbnail_url": (item.get("snippet", {}).get("thumbnails", {}).get("high") or {}).get("url"),
            }
            for item in data.get("items", [])
            if item.get("id", {}).get("channelId")
        ]

    async def get_channel(self, channel_id: str) -> Optional[dict[str, Any]]:
        if not _CHANNEL_ID_RE.fullmatch(channel_id.strip()):
            raise ValidationError("Invalid YouTube channel ID")

        data = await self._get(
            "channels",
            {
                "part": "snippet,contentDetails,statistics",
                "id": channel_id.strip(),
            },
        )
        item = (data.get("items") or [None])[0]
        if not item:
            return None

        snippet = item.get("snippet") or {}
        stats = item.get("statistics") or {}
        details = item.get("contentDetails") or {}
        related_playlists = details.get("relatedPlaylists") or {}

        return {
            "channel_id": item.get("id"),
            "channel_url": f"https://www.youtube.com/channel/{item.get('id')}",
            "title": snippet.get("title", ""),
            "description": snippet.get("description"),
            "thumbnail_url": (snippet.get("thumbnails", {}).get("high") or {}).get("url"),
            "uploads_playlist_id": related_playlists.get("uploads"),
            "subscriber_count": self._int_or_none(stats.get("subscriberCount")),
            "video_count": self._int_or_none(stats.get("videoCount")),
            "view_count": self._int_or_none(stats.get("viewCount")),
        }

    async def get_channel_videos(
        self,
        channel_id: str,
        max_results: int = 20,
        *,
        channel: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        channel_data = channel or await self.get_channel(channel_id)
        if not channel_data or not channel_data.get("uploads_playlist_id"):
            return []

        data = await self._get(
            "playlistItems",
            {
                "part": "snippet,contentDetails",
                "playlistId": channel_data["uploads_playlist_id"],
                "maxResults": max(1, min(max_results, 50)),
            },
        )

        result = []
        for item in data.get("items", []):
            video_id = item.get("contentDetails", {}).get("videoId")
            snippet = item.get("snippet") or {}
            if not video_id:
                continue
            result.append(
                {
                    "video_id": video_id,
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description"),
                    "thumbnail_url": (snippet.get("thumbnails", {}).get("high") or {}).get("url"),
                    "published_at": snippet.get("publishedAt"),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                }
            )
        return result

    async def resolve_channel(self, value: str) -> dict[str, Any]:
        value = value.strip()
        match = re.search(r"/channel/(UC[\w-]{10,})", value)
        if match:
            return await self._require_channel(match.group(1))

        if _CHANNEL_ID_RE.fullmatch(value):
            return await self._require_channel(value)

        handle = re.search(r"youtube\.com/@([^/?#]+)", value)
        if handle:
            query = f"@{handle.group(1)}"
        else:
            user_match = re.search(r"youtube\.com/user/([^/?#]+)", value)
            custom_match = re.search(r"youtube\.com/c/([^/?#]+)", value)
            query = user_match.group(1) if user_match else custom_match.group(1) if custom_match else value

        channels = await self.search_channels(query, max_results=10)
        if not channels:
            raise ValidationError("No matching YouTube channel was found")

        preferred = next(
            (
                channel
                for channel in channels
                if channel["title"].strip().casefold() == query.strip().casefold()
            ),
            channels[0],
        )
        channel = await self.get_channel(preferred["channel_id"])
        if not channel:
            raise ValidationError("YouTube channel was not found")
        return channel

    async def _require_channel(self, channel_id: str) -> dict[str, Any]:
        channel = await self.get_channel(channel_id)
        if not channel:
            raise ValidationError("YouTube channel was not found")
        return channel

    @staticmethod
    def _int_or_none(value: Any) -> Optional[int]:
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
