from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.ai.gemini_client import GeminiClient


@pytest.mark.parametrize(
    ("model_name", "expected_temperature"),
    [
        ("gemini-3.8-flash", None),
        ("models/gemini-3.6-flash", None),
        ("gemini-4-argon", None),
        ("gemini-2.5-flash", 0.5),
    ],
)
def test_generate_uses_sampling_params_only_for_legacy_models(
    model_name, expected_temperature
):
    client = object.__new__(GeminiClient)
    client.model_name = model_name
    client.client = MagicMock()
    client.client.models.generate_content.return_value = SimpleNamespace(
        text="Tutor response",
        usage_metadata=SimpleNamespace(total_token_count=7),
    )

    text, tokens = client._generate(
        prompt="Explain binary search.",
        temperature=0.5,
        max_output_tokens=256,
    )

    assert text == "Tutor response"
    assert tokens == 7
    config = client.client.models.generate_content.call_args.kwargs["config"]
    assert config.temperature == expected_temperature


def test_invalid_argument_provider_error_is_not_retryable():
    from app.core.ai_exceptions import AIInvalidRequestError

    provider_error = RuntimeError(
        "400 INVALID_ARGUMENT: temperature is not supported for this model"
    )
    provider_error.code = 400
    provider_error.status = "INVALID_ARGUMENT"

    with pytest.raises(AIInvalidRequestError) as exc_info:
        GeminiClient._raise_provider_error(provider_error, "gemini_call_failed")

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "AI_INVALID_REQUEST"


def test_provider_503_is_not_retried():
    from app.core.ai_exceptions import AIUnavailableError

    provider_error = RuntimeError(
        "503 UNAVAILABLE: This model is currently experiencing high demand"
    )
    provider_error.code = 503
    provider_error.status = "UNAVAILABLE"

    client = object.__new__(GeminiClient)
    client.model_name = "gemini-3.8-flash"
    client.client = MagicMock()
    client.client.models.generate_content.side_effect = provider_error

    with pytest.raises(AIUnavailableError, match="temporarily overloaded"):
        client._generate(prompt="Explain binary search.")

    assert client.client.models.generate_content.call_count == 1
