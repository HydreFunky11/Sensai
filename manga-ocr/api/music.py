import re
import logging
import httpx
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from services.llm_service import llm_service
from core.rate_limiter import limiter_reader

logger = logging.getLogger("sensai.music")

router = APIRouter(prefix="/music", tags=["music"])

# Schémas Pydantic
class MusicResolveRequest(BaseModel):
    spotify_url: Optional[str] = None
    query: Optional[str] = None
    title: Optional[str] = None
    artist: Optional[str] = None

class MusicResolveResponse(BaseModel):
    track_id: Optional[str] = None
    title: str
    artist: Optional[str] = ""
    thumbnail: Optional[str] = None
    embed_url: Optional[str] = None

class MusicSuggestionItem(BaseModel):
    track_id: Optional[str] = None
    title: str
    artist: str
    thumbnail: Optional[str] = None
    embed_url: Optional[str] = None

class WordVocabulary(BaseModel):
    word: str
    romanji: Optional[str] = ""
    meaning: str
    type: Optional[str] = ""

class LyricLine(BaseModel):
    id: int
    time: float = 0.0
    duration: float = 4.0
    japanese: str
    romaji: str
    translation: str
    vocabulary: Optional[List[WordVocabulary]] = []

class MusicLyricsRequest(BaseModel):
    title: str
    artist: Optional[str] = ""
    track_id: Optional[str] = None
    custom_lyrics: Optional[str] = None

class MusicLyricsResponse(BaseModel):
    title: str
    artist: str
    jlpt_level: Optional[str] = "N4"
    lines: List[LyricLine] = []
    vocabulary: List[WordVocabulary] = []

# Liste de morceaux cultes préconfigurés pour tester instantanément
PRESET_TRACKS = [
    {
        "id": "preset-1",
        "title": "Idol (アイドル)",
        "artist": "YOASOBI",
        "anime": "Oshi no Ko (Opening 1)",
        "spotify_url": "https://open.spotify.com/track/7vRri9DEyKtA1EIGjuz1L4",
        "thumbnail": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028b185b3400a4fb92b4510b6d",
        "track_id": "7vRri9DEyKtA1EIGjuz1L4",
        "embed_url": "https://open.spotify.com/embed/track/7vRri9DEyKtA1EIGjuz1L4"
    },
    {
        "id": "preset-2",
        "title": "Gurenge (紅蓮華)",
        "artist": "LiSA",
        "anime": "Demon Slayer: Kimetsu no Yaiba (OP 1)",
        "spotify_url": "https://open.spotify.com/track/23DbOD900rYmF0l6r0b2xO",
        "thumbnail": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ca7be34bfd21adab7ecae70",
        "track_id": "23DbOD900rYmF0l6r0b2xO",
        "embed_url": "https://open.spotify.com/embed/track/23DbOD900rYmF0l6r0b2xO"
    },
    {
        "id": "preset-3",
        "title": "KICK BACK",
        "artist": "Kenshi Yonezu",
        "anime": "Chainsaw Man (Opening)",
        "spotify_url": "https://open.spotify.com/track/3khEEPRyBeOUabbmOPJzAG",
        "thumbnail": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ad67d26fb0ccaa8da6bb83b0",
        "track_id": "3khEEPRyBeOUabbmOPJzAG",
        "embed_url": "https://open.spotify.com/embed/track/3khEEPRyBeOUabbmOPJzAG"
    },
    {
        "id": "preset-4",
        "title": "Kaikai Kitan (廻廻奇譚)",
        "artist": "Eve",
        "anime": "Jujutsu Kaisen (Opening 1)",
        "spotify_url": "https://open.spotify.com/track/3j8MwJSlq1j11i40c0kC4r",
        "thumbnail": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02ef2b96316ef5adbe53f090b4",
        "track_id": "3j8MwJSlq1j11i40c0kC4r",
        "embed_url": "https://open.spotify.com/embed/track/3j8MwJSlq1j11i40c0kC4r"
    },
    {
        "id": "preset-5",
        "title": "Shinunoga E-Wa (死ぬのがいいわ)",
        "artist": "Fujii Kaze",
        "anime": "Viral J-Pop Hit",
        "spotify_url": "https://open.spotify.com/track/0H6t60y6G9wS0h4nQz8F4F",
        "thumbnail": "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02377bcf7b2b8c9d066ec0db24",
        "track_id": "0H6t60y6G9wS0h4nQz8F4F",
        "embed_url": "https://open.spotify.com/embed/track/0H6t60y6G9wS0h4nQz8F4F"
    }
]

def extract_spotify_track_id(url_or_uri: str) -> Optional[str]:
    """
    Extrait l'ID Spotify (22 caractères alphanumériques) depuis :
    - https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
    - https://open.spotify.com/intl-fr/track/4cOdK2wGLETKBW3PvgPWqT
    - spotify:track:4cOdK2wGLETKBW3PvgPWqT
    """
    if not url_or_uri:
        return None
    match = re.search(r"(?:spotify:track:|open\.spotify\.com/(?:intl-[a-z]+/)?track/)([a-zA-Z0-9]{22})", url_or_uri.strip())
    if match:
        return match.group(1)
    return None

@router.get("/presets")
async def get_presets():
    """Renvoie les morceaux japonais cultes prêts à être explorés."""
    return PRESET_TRACKS

@router.get("/suggestions", response_model=List[MusicSuggestionItem], dependencies=[Depends(limiter_reader)])
async def get_music_suggestions(q: str = "", limit: int = 5):
    """
    Retourne des suggestions dynamiques de morceaux Spotify correspondant à la requête q (titre ou artiste).
    Recherche d'abord dans les presets, puis interroge Spotify via spotifyscraper.
    """
    query = (q or "").strip()
    if not query or len(query) < 2:
        return []

    results: List[MusicSuggestionItem] = []
    seen_ids = set()

    # 1. Vérifier les presets correspondants
    q_lower = query.lower()
    for p in PRESET_TRACKS:
        if q_lower in p["title"].lower() or q_lower in p["artist"].lower():
            if p["track_id"] not in seen_ids:
                seen_ids.add(p["track_id"])
                results.append(MusicSuggestionItem(
                    track_id=p["track_id"],
                    title=p["title"],
                    artist=p["artist"],
                    thumbnail=p["thumbnail"],
                    embed_url=p["embed_url"]
                ))
            if len(results) >= limit:
                return results

    # 2. Rechercher sur Spotify via spotifyscraper
    try:
        from spotify_scraper import SpotifyClient
        with SpotifyClient() as client:
            res = client.search(query, types=("track",), limit=limit)
            if res.tracks:
                for t in res.tracks:
                    if t.id in seen_ids:
                        continue
                    seen_ids.add(t.id)
                    artist_name = t.artists[0].name if t.artists else ""
                    thumb = t.album.images[0].url if t.album and hasattr(t.album, "images") and t.album.images else None
                    results.append(MusicSuggestionItem(
                        track_id=t.id,
                        title=t.name,
                        artist=artist_name,
                        thumbnail=thumb,
                        embed_url=f"https://open.spotify.com/embed/track/{t.id}"
                    ))
                    if len(results) >= limit:
                        break
    except Exception as e:
        logger.warning(f"Recherche de suggestions Spotify échouée pour '{query}' : {e}")

    return results

@router.post("/resolve", response_model=MusicResolveResponse, dependencies=[Depends(limiter_reader)])
async def resolve_track(req: MusicResolveRequest):
    """
    Résout un morceau soit par Titre & Artiste (option principale),
    soit via un lien / identifiant Spotify (option secondaire).
    """
    # 1. Option principale : recherche manuelle par Titre et Artiste
    if req.title and req.title.strip():
        req_title = req.title.strip()
        req_artist = (req.artist or "").strip()

        # Vérifier d'abord si cela correspond à un preset connu
        for p in PRESET_TRACKS:
            if (req_title.lower() in p["title"].lower() or p["title"].lower() in req_title.lower()):
                if not req_artist or req_artist.lower() in p["artist"].lower() or p["artist"].lower() in req_artist.lower():
                    return MusicResolveResponse(
                        track_id=p["track_id"],
                        title=p["title"],
                        artist=p["artist"],
                        thumbnail=p["thumbnail"],
                        embed_url=p["embed_url"]
                    )

        # Recherche automatique du track Spotify officiel via spotifyscraper
        try:
            from spotify_scraper import SpotifyClient
            search_query = f"{req_artist} {req_title}".strip()
            with SpotifyClient() as client:
                res = client.search(search_query, types=("track",), limit=1)
                if res.tracks and len(res.tracks) > 0:
                    t = res.tracks[0]
                    resolved_artist = t.artists[0].name if t.artists else req_artist
                    resolved_thumb = t.album.images[0].url if t.album and hasattr(t.album, "images") and t.album.images else None
                    logger.info(f"🎧 Morceau Spotify résolu avec succès : {t.name} par {resolved_artist} (ID: {t.id})")
                    return MusicResolveResponse(
                        track_id=t.id,
                        title=t.name,
                        artist=resolved_artist,
                        thumbnail=resolved_thumb,
                        embed_url=f"https://open.spotify.com/embed/track/{t.id}"
                    )
        except Exception as e:
            logger.warning(f"Recherche automatique spotifyscraper échouée pour '{req_title}' ({req_artist}) : {e}")

        return MusicResolveResponse(
            track_id=None,
            title=req_title,
            artist=req_artist,
            thumbnail=None,
            embed_url=None
        )

    # 2. Option secondaire : résolution par lien ou ID Spotify
    track_id = None
    target_url = req.spotify_url or req.query

    if target_url:
        track_id = extract_spotify_track_id(target_url)

    if track_id:
        title = None
        artist = ""
        thumbnail = None
        embed_url = f"https://open.spotify.com/embed/track/{track_id}"

        # Étape A : Spotify oEmbed
        oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{track_id}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(oembed_url)
                if resp.status_code == 200:
                    data = resp.json()
                    title = data.get("title")
                    artist = data.get("author_name") or ""
                    thumbnail = data.get("thumbnail_url")
        except Exception as e:
            logger.warning(f"Impossible de contacter Spotify oEmbed: {e}")

        # Étape B : Si l'artiste est vide (fréquent sur l'oEmbed Spotify pour les morceaux), scraper la page Spotify
        if not artist or not title or title == "Morceau Spotify":
            try:
                page_url = f"https://open.spotify.com/track/{track_id}"
                headers = {
                    "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
                }
                async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                    page_resp = await client.get(page_url, headers=headers)
                    if page_resp.status_code == 200:
                        html = page_resp.text
                        # Pattern 1: <title>KIRA - song and lyrics by Ado | Spotify</title>
                        title_match = re.search(r"<title>(.*?)\s*-\s*song\s+(?:and\s+lyrics\s+)?by\s+(.*?)\s*\|\s*Spotify</title>", html, re.IGNORECASE)
                        if title_match:
                            if not title or title == "Morceau Spotify":
                                title = title_match.group(1).strip()
                            if not artist:
                                artist = title_match.group(2).strip()

                        # Pattern 2: og:description content="Ado · KIRA · Song · 2026"
                        if not artist:
                            desc_match = re.search(r'<meta\s+(?:property|name)=["\']og:description["\']\s+content=["\']([^·"\']+)\s*·\s*([^·"\']+)\s*·', html, re.IGNORECASE)
                            if desc_match:
                                artist = desc_match.group(1).strip()
                                if not title or title == "Morceau Spotify":
                                    title = desc_match.group(2).strip()
            except Exception as e:
                logger.warning(f"Scraping de secours métadonnées Spotify échoué: {e}")

        return MusicResolveResponse(
            track_id=track_id,
            title=title or f"Spotify Track ({track_id[:8]}...)",
            artist=artist or "",
            thumbnail=thumbnail,
            embed_url=embed_url
        )

    # 3. Recherche textuelle libre (ex: "YOASOBI - Idol")
    if req.query and req.query.strip():
        q = req.query.strip()
        parts = [p.strip() for p in q.split("-", 1)]
        if len(parts) == 2:
            return MusicResolveResponse(
                track_id=None,
                title=parts[1],
                artist=parts[0],
                thumbnail=None,
                embed_url=None
            )
        return MusicResolveResponse(
            track_id=None,
            title=q,
            artist="",
            thumbnail=None,
            embed_url=None
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Veuillez fournir un titre et un artiste, ou un lien Spotify."
    )

@router.post("/lyrics", response_model=MusicLyricsResponse, dependencies=[Depends(limiter_reader)])
async def get_lyrics_and_analysis(req: MusicLyricsRequest):
    """
    Génère et analyse les paroles japonaises complètes, avec transcription Romaji,
    traduction française et vocabulaire interactif.
    """
    if not req.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le titre de la chanson est obligatoire."
        )

    try:
        data = llm_service.analyze_music_lyrics(
            title=req.title,
            artist=req.artist or "",
            custom_lyrics=req.custom_lyrics or ""
        )

        # Assurer la cohérence des données pour le schéma de réponse
        lines = []
        for idx, line in enumerate(data.get("lines", []), start=1):
            if isinstance(line, dict):
                vocab_list = []
                for v in line.get("vocabulary", []):
                    if isinstance(v, dict):
                        vocab_list.append(WordVocabulary(
                            word=v.get("word", ""),
                            romanji=v.get("romanji") or v.get("romaji", ""),
                            meaning=v.get("meaning", ""),
                            type=v.get("type", "")
                        ))

                lines.append(LyricLine(
                    id=line.get("id", idx),
                    time=float(line.get("time", (idx - 1) * 4.0)),
                    duration=float(line.get("duration", 4.0)),
                    japanese=line.get("japanese", ""),
                    romaji=line.get("romaji", ""),
                    translation=line.get("translation", ""),
                    vocabulary=vocab_list
                ))

        # Récupération du vocabulaire global de la chanson
        song_vocab = []
        for v in data.get("vocabulary", []):
            if isinstance(v, dict):
                song_vocab.append(WordVocabulary(
                    word=v.get("word", ""),
                    romanji=v.get("romanji") or v.get("romaji", ""),
                    meaning=v.get("meaning", ""),
                    type=v.get("type", "")
                ))

        return MusicLyricsResponse(
            title=data.get("title", req.title),
            artist=data.get("artist", req.artist or ""),
            jlpt_level=data.get("jlpt_level", "N4"),
            lines=lines,
            vocabulary=song_vocab
        )
    except Exception as e:
        logger.error(f"Erreur analyse paroles musique: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'analyse des paroles : {str(e)}"
        )
