import asyncio
import json
import re
from typing import Any, Optional

from google import genai
from google.genai import types
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.config.logging import get_logger
from app.config.settings import settings
from app.core.ai_exceptions import (
    AIInvalidOutputError,
    AIInvalidRequestError,
    AINotConfiguredError,
    AIRateLimitedError,
    AITimeoutError,
    AIUnavailableError,
)

logger = get_logger("gemini")
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


class GeminiClient:
    """Production Gemini gateway using Google's current GenAI SDK.

    All application AI calls should go through this class so credentials,
    retries, model selection, structured output and error handling stay
    centralized.
    """

    _client: Optional[genai.Client] = None

    @staticmethod
    def _uses_gemini_36_or_newer(model_name: str) -> bool:
        """Return whether the model no longer accepts sampling parameters.

        Gemini 3.6+ and Gemini 4+ models deprecate/ignore ``temperature``
        and newer API versions may reject it with INVALID_ARGUMENT. Strip a
        possible ``models/`` prefix before inspecting the model ID.
        """
        model_id = model_name.rsplit("/", 1)[-1].lower()
        match = re.match(r"^gemini-(\d+)(?:\.(\d+))?(?:-|$)", model_id)
        if not match:
            return False

        major = int(match.group(1))
        minor = int(match.group(2) or 0)
        return major >= 4 or (major == 3 and minor >= 6)

    @staticmethod
    def _raise_provider_error(
        exc: Exception, event: str, model: Optional[str] = None
    ) -> None:
        """Log provider details server-side and return a useful safe error."""
        raw_status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        try:
            status = int(raw_status) if raw_status is not None else None
        except (TypeError, ValueError):
            status = None
        message = str(exc).lower()

        # Keep raw provider errors in backend logs only. They may contain
        # project/request metadata and should not be exposed to students.
        logger.warning(
            event,
            provider_status=status,
            model=model or settings.GEMINI_MODEL,
            error=str(exc),
        )

        if status == 429 or any(term in message for term in (
            "resource_exhausted", "quota exceeded", "rate limit", "too many requests"
        )):
            raise AIRateLimitedError(
                "Gemini usage limit reached. Check your API quota and try again later."
            ) from exc

        if status in (401, 403) or any(term in message for term in (
            "api key not valid", "invalid api key", "unauthenticated",
            "permission_denied", "permission denied", "api key is invalid"
        )):
            raise AINotConfiguredError(
                "Gemini rejected the configured API key or its permissions. Check GEMINI_API_KEY and API access."
            ) from exc

        if (
            status == 503
            or "service unavailable" in message
            or "high demand" in message
        ):
            raise AIUnavailableError(
                "Gemini is temporarily overloaded. Please try again shortly."
            ) from exc

        if status == 404 or any(term in message for term in (
            "model not found", "not_found", "is not found for api version",
            "model is unavailable", "unknown model"
        )):
            raise AIUnavailableError(
                "The configured Gemini model is unavailable to this API key. Check GEMINI_MODEL and model access."
            ) from exc

        if status in (408, 504) or any(term in message for term in (
            "deadline", "timeout", "timed out", "connection reset"
        )):
            raise AITimeoutError(
                "Gemini did not respond in time. Please retry."
            ) from exc

        status_name = str(getattr(exc, "status", "")).lower()
        if status in (400, 422) or "invalid_argument" in status_name or "invalid_argument" in message:
            # A malformed/unsupported request will not improve through retry;
            # report a clear client/configuration error instead of spending
            # multiple seconds retrying it as a generic 502.
            raise AIInvalidRequestError(
                "Gemini rejected the request configuration. Check backend logs for details."
            ) from exc

        raise AIUnavailableError(
            "Gemini could not complete the request. Check the backend logs for the provider error."
        ) from exc

    def __init__(self, model: Optional[str] = None):
        if not settings.GEMINI_API_KEY:
            raise AINotConfiguredError("GEMINI_API_KEY is not configured")

        if GeminiClient._client is None:
            GeminiClient._client = genai.Client(api_key=settings.GEMINI_API_KEY)

        self.client = GeminiClient._client
        self.model_name = model or settings.GEMINI_MODEL

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        # Retry timeouts only. A model overload/availability error (HTTP 503)
        # should fail promptly instead of repeating the same generation call.
        retry=retry_if_exception_type(AITimeoutError),
    )
    def _generate(
        self,
        *,
        prompt: Any,
        json_mode: bool = False,
        temperature: float = 0.4,
        max_output_tokens: int = 2048,
        system_instruction: Optional[str] = None,
    ) -> tuple[str, int]:
        try:
            config_kwargs = {
                "max_output_tokens": max_output_tokens,
                "system_instruction": system_instruction,
                "response_mime_type": "application/json" if json_mode else "text/plain",
            }
            # Gemini 3.6+ and 4+ no longer support custom sampling controls.
            # Passing the tutor's legacy temperature=0.5 to Gemini 3.8 can
            # cause INVALID_ARGUMENT, which was previously surfaced as a 502.
            if not self._uses_gemini_36_or_newer(self.model_name):
                config_kwargs["temperature"] = temperature
            config = types.GenerateContentConfig(**config_kwargs)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config,
            )
            text = (response.text or "").strip()
            if not text:
                raise AIInvalidOutputError("Gemini returned an empty response")

            usage = getattr(response, "usage_metadata", None)
            tokens = int(getattr(usage, "total_token_count", 0) or 0)
            return text, tokens

        except AIInvalidOutputError:
            raise
        except TimeoutError as exc:
            raise AITimeoutError("Gemini did not respond in time. Please retry.") from exc
        except Exception as exc:  # noqa: BLE001
            self._raise_provider_error(exc, "gemini_call_failed", model=self.model_name)

    def generate_text(
        self,
        *,
        prompt: Any,
        temperature: float = 0.4,
        max_output_tokens: int = 2048,
        system_instruction: Optional[str] = None,
    ) -> tuple[str, int]:
        return self._generate(
            prompt=prompt,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            system_instruction=system_instruction,
        )

    async def generate_text_async(self, **kwargs) -> tuple[str, int]:
        return await asyncio.to_thread(self.generate_text, **kwargs)

    def generate_json(
        self,
        *,
        prompt: Any,
        temperature: float = 0.3,
        max_output_tokens: int = 4096,
        response_schema: Any = None,
    ) -> tuple[dict, int]:
        # Pydantic schema support is passed directly to the current SDK when
        # supplied; otherwise application-level validation remains the fallback.
        if response_schema is not None:
            config = types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json",
                response_schema=response_schema,
            )
            try:
                response = self.client.models.generate_content(
                    model=self.model_name, contents=prompt, config=config
                )
                text = (response.text or "").strip()
                usage = getattr(response, "usage_metadata", None)
                tokens = int(getattr(usage, "total_token_count", 0) or 0)
                return self._safe_json(text), tokens
            except AIInvalidOutputError:
                raise
            except Exception as exc:  # noqa: BLE001
                self._raise_provider_error(exc, "gemini_json_call_failed", model=self.model_name)

        text, tokens = self._generate(
            prompt=prompt,
            json_mode=True,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        return self._safe_json(text), tokens

    async def generate_json_async(self, **kwargs) -> tuple[dict, int]:
        return await asyncio.to_thread(self.generate_json, **kwargs)


    def analyze_youtube_url(self, *, youtube_url: str, prompt: str) -> tuple[str, int]:
        """Analyze a public YouTube video directly through the Gemini video input path."""
        try:
            interaction = self.client.interactions.create(
                model=self.model_name,
                input=[
                    {"type": "text", "text": prompt},
                    {"type": "video", "uri": youtube_url},
                ],
            )
            text = (getattr(interaction, "output_text", None) or "").strip()
            if not text:
                raise AIInvalidOutputError("Gemini returned no YouTube video analysis")
            tokens = 0
            usage = getattr(interaction, "usage", None) or getattr(interaction, "usage_metadata", None)
            if usage is not None:
                tokens = int(getattr(usage, "total_token_count", 0) or 0)
            return text, tokens
        except AIInvalidOutputError:
            raise
        except TimeoutError as exc:
            raise AITimeoutError("Gemini did not respond in time. Please retry.") from exc
        except Exception as exc:  # noqa: BLE001
            self._raise_provider_error(exc, "gemini_youtube_analysis_failed", model=self.model_name)

    def generate_video_analysis(self, *, video_bytes: bytes, mime_type: str, prompt: str) -> tuple[str, int]:
        """Send an uploaded video to Gemini Files API and analyze its content."""
        import tempfile
        from pathlib import Path

        suffix = ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(video_bytes)
            temp_path = Path(tmp.name)

        uploaded = None
        try:
            uploaded = self.client.files.upload(file=str(temp_path))
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[uploaded, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=8192,
                ),
            )
            text = (response.text or "").strip()
            if not text:
                raise AIInvalidOutputError("Gemini returned no video analysis")
            usage = getattr(response, "usage_metadata", None)
            tokens = int(getattr(usage, "total_token_count", 0) or 0)
            return text, tokens
        except AIInvalidOutputError:
            raise
        except Exception as exc:  # noqa: BLE001
            self._raise_provider_error(exc, "gemini_video_analysis_failed", model=self.model_name)
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except Exception:
                pass
            if uploaded is not None:
                try:
                    self.client.files.delete(name=uploaded.name)
                except Exception:
                    pass

    @staticmethod
    def _safe_json(text: str) -> dict:
        if not text:
            raise AIInvalidOutputError("Empty response")
        stripped = text.strip()
        if stripped.startswith("```"):
            match = _JSON_FENCE_RE.search(stripped)
            if match:
                stripped = match.group(1).strip()
        try:
            value = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise AIInvalidOutputError(f"AI response was not valid JSON: {exc}") from exc
        if not isinstance(value, dict):
            raise AIInvalidOutputError("AI JSON response must be an object")
        return value
