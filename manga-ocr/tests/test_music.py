import pytest
from unittest.mock import patch, MagicMock
from api.music import extract_spotify_track_id

def test_extract_spotify_track_id():
    # 1. Lien standard Spotify
    url1 = "https://open.spotify.com/track/7vRri9DEyKtA1EIGjuz1L4"
    assert extract_spotify_track_id(url1) == "7vRri9DEyKtA1EIGjuz1L4"

    # 2. Lien avec paramètres query
    url2 = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123xyz"
    assert extract_spotify_track_id(url2) == "4cOdK2wGLETKBW3PvgPWqT"

    # 3. Lien internationalisé
    url3 = "https://open.spotify.com/intl-ja/track/0H6t60y6G9wS0h4nQz8F4F"
    assert extract_spotify_track_id(url3) == "0H6t60y6G9wS0h4nQz8F4F"

    # 4. URI Spotify
    uri = "spotify:track:23DbOD900rYmF0l6r0b2xO"
    assert extract_spotify_track_id(uri) == "23DbOD900rYmF0l6r0b2xO"

    # 5. Lien invalide
    assert extract_spotify_track_id("https://youtube.com/watch?v=123") is None
    assert extract_spotify_track_id("") is None
    assert extract_spotify_track_id(None) is None

def test_get_music_presets(client):
    response = client.get("/music/presets")
    assert response.status_code == 200
    presets = response.json()
    assert isinstance(presets, list)
    assert len(presets) >= 3
    assert any("YOASOBI" in p["artist"] for p in presets)
    assert "embed_url" in presets[0]

def test_resolve_spotify_track_with_oembed(client):
    mock_oembed_data = {
        "title": "Idol",
        "author_name": "YOASOBI",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "html": "<iframe></iframe>"
    }

    class MockResponse:
        status_code = 200
        def json(self):
            return mock_oembed_data

    with patch("httpx.AsyncClient.get", return_value=MockResponse()):
        response = client.post(
            "/music/resolve",
            json={"spotify_url": "https://open.spotify.com/track/7vRri9DEyKtA1EIGjuz1L4"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["track_id"] == "7vRri9DEyKtA1EIGjuz1L4"
        assert data["title"] == "Idol"
        assert data["artist"] == "YOASOBI"
        assert "embed/track/7vRri9DEyKtA1EIGjuz1L4" in data["embed_url"]

def test_resolve_manual_title_and_artist(client):
    response = client.post(
        "/music/resolve",
        json={"title": "KIRA", "artist": "Ado"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "KIRA"
    assert data["artist"] == "Ado"
    assert "embed_url" in data and data["embed_url"] is not None
    assert "7FTTLL9jM3wcpgeCAJU9L6" in data["embed_url"]

def test_resolve_manual_preset_match(client):
    response = client.post(
        "/music/resolve",
        json={"title": "Idol", "artist": "YOASOBI"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Idol (アイドル)"
    assert data["artist"] == "YOASOBI"
    assert "embed_url" in data and data["embed_url"] is not None

def test_resolve_query_text(client):
    response = client.post(
        "/music/resolve",
        json={"query": "LiSA - Gurenge"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Gurenge"
    assert data["artist"] == "LiSA"

def test_resolve_empty_fails(client):
    response = client.post(
        "/music/resolve",
        json={"spotify_url": "", "query": "", "title": "", "artist": ""}
    )
    assert response.status_code == 400

def test_get_lyrics_and_analysis(client):
    mock_llm_result = {
        "title": "Gurenge",
        "artist": "LiSA",
        "anime_context": "Opening 1 de Demon Slayer",
        "jlpt_level": "N3",
        "lines": [
            {
                "id": 1,
                "japanese": "強くなれる理由を知った",
                "romaji": "Tsuyoku nareru riyuu wo shitta",
                "translation": "J'ai compris la raison pour laquelle je peux devenir plus fort",
                "vocabulary": [
                    {
                        "word": "強く",
                        "romanji": "tsuyoku",
                        "meaning": "fort",
                        "type": "adverbe"
                    },
                    {
                        "word": "理由",
                        "romanji": "riyuu",
                        "meaning": "raison",
                        "type": "nom"
                    }
                ]
            }
        ]
    }

    with patch("services.llm_service.llm_service.analyze_music_lyrics", return_value=mock_llm_result):
        response = client.post(
            "/music/lyrics",
            json={"title": "Gurenge", "artist": "LiSA"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Gurenge"
        assert data["artist"] == "LiSA"
        assert data["jlpt_level"] == "N3"
        assert "anime_context" not in data or data.get("anime_context") is None
        assert len(data["lines"]) == 1
        line = data["lines"][0]
        assert line["japanese"] == "強くなれる理由を知った"
        assert line["romaji"] == "Tsuyoku nareru riyuu wo shitta"
        assert line["time"] == 0.0
        assert line["duration"] == 4.0
        assert len(line["vocabulary"]) == 2

def test_get_lyrics_empty_title_fails(client):
    response = client.post(
        "/music/lyrics",
        json={"title": "   ", "artist": "LiSA"}
    )
    assert response.status_code == 400
