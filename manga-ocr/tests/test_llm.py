import json
from unittest.mock import MagicMock, patch
import pytest
from services.llm_service import LLMService


def test_normalize_json_payload():
    service = LLMService()
    raw_markdown = """```json
    {
        \"original\": \"こんにちは\",
        \"romaji\": \"konnichiwa\",
        \"translation\": \"Bonjour\",
        \"breakdown\": [
            {
                \"word\": \"こんにちは\",
                \"romaji\": \"konnichiwa\",
                \"type\": \"Salutation\",
                \"meaning\": \"Bonjour\"
            }
        ],
        \"context_note\": \"Salutation standard en journée.\"
    }
    ```"""
    result = service._normalize_json_payload(raw_markdown, "こんにちは")
    assert result["original"] == "こんにちは"
    assert result["translation"] == "Bonjour"
    assert "romanji" in result["breakdown"][0]
    assert result["breakdown"][0]["romanji"] == "konnichiwa"


def test_openrouter_success():
    service = LLMService()
    mock_response_data = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "original": "ありがとう",
                        "romaji": "arigatou",
                        "translation": "Merci",
                        "breakdown": [
                            {"word": "ありがとう", "romaji": "arigatou", "type": "Interjection", "meaning": "Merci"}
                        ],
                        "context_note": "Remerciement courant"
                    })
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = mock_response_data
    mock_resp.raise_for_status.return_value = None

    with patch("httpx.Client") as mock_client_class:
        mock_client = MagicMock()
        mock_client.__enter__.return_value = mock_client
        mock_client.post.return_value = mock_resp
        mock_client_class.return_value = mock_client

        res = service._call_openrouter("prompt", "ありがとう")
        assert res["translation"] == "Merci"
        assert res["original"] == "ありがとう"


def test_fallback_to_groq_when_openrouter_fails():
    service = LLMService()
    service.groq_client = MagicMock()
    mock_groq_choice = MagicMock()
    mock_groq_choice.message.content = json.dumps({
        "original": "さようなら",
        "romaji": "sayounara",
        "translation": "Au revoir",
        "breakdown": [],
        "context_note": "Adieu formel"
    })
    mock_groq_completion = MagicMock()
    mock_groq_completion.choices = [mock_groq_choice]
    service.groq_client.chat.completions.create.return_value = mock_groq_completion

    with patch.object(service, "_call_openrouter", side_effect=RuntimeError("OpenRouter 500 error")):
        res = service.analyze_text("さようなら")
        assert res["translation"] == "Au revoir"
        assert res["original"] == "さようなら"


def test_safe_error_dict_when_both_fail():
    service = LLMService()
    with patch.object(service, "_call_openrouter", side_effect=RuntimeError("OpenRouter down")), \
         patch.object(service, "_call_groq", side_effect=RuntimeError("Groq down")):
        res = service.analyze_text("テスト")
        assert res["original"] == "テスト"
        assert res["translation"] == "Erreur de traduction"
        assert "error" in res
