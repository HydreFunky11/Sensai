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

class MusicResolveResponse(BaseModel):
    track_id: Optional[str] = None
    title: str
    artist: Optional[str] = ""
    thumbnail: Optional[str] = None
    embed_url: Optional[str] = None

class WordVocabulary(BaseModel):
    word: str
    romanji: Optional[str] = ""
    meaning: str
    type: Optional[str] = ""

class LyricLine(BaseModel):
    id: int
    japanese: str
    romaji: str
    translation: str
    vocabulary: List[WordVocabulary] = []

class MusicLyricsRequest(BaseModel):
    title: str
    artist: Optional[str] = ""
    track_id: Optional[str] = None
    custom_lyrics: Optional[str] = None

class MusicLyricsResponse(BaseModel):
    title: str
    artist: str
    anime_context: Optional[str] = ""
    jlpt_level: Optional[str] = "N4"
    lines: List[LyricLine] = []

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

@router.post("/resolve", response_model=MusicResolveResponse, dependencies=[Depends(limiter_reader)])
async def resolve_track(req: MusicResolveRequest):
    """
    Résout un lien ou identifiant Spotify via l'API oEmbed publique de Spotify.
    Renvoie le titre, artiste, miniature et l'URL iframe d'écoute intégrée.
    """
    track_id = None
    if req.spotify_url:
        track_id = extract_spotify_track_id(req.spotify_url)

    if track_id:
        # Appel à Spotify oEmbed officiel
        oembed_url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{track_id}"
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(oembed_url)
                if resp.status_code == 200:
                    data = resp.json()
                    title = data.get("title", "Morceau Spotify")
                    artist = data.get("author_name", "")
                    thumbnail = data.get("thumbnail_url")
                    embed_url = f"https://open.spotify.com/embed/track/{track_id}"
                    return MusicResolveResponse(
                        track_id=track_id,
                        title=title,
                        artist=artist,
                        thumbnail=thumbnail,
                        embed_url=embed_url
                    )
        except Exception as e:
            logger.warning(f"Impossible de contacter Spotify oEmbed: {e}")

        # Fallback avec l'ID valide
        return MusicResolveResponse(
            track_id=track_id,
            title=f"Spotify Track ({track_id[:8]}...)",
            artist="",
            thumbnail=None,
            embed_url=f"https://open.spotify.com/embed/track/{track_id}"
        )

    # Si pas d'URL Spotify mais une recherche textuelle (ex: "YOASOBI Idol")
    if req.query and req.query.strip():
        q = req.query.strip()
        # Séparer artist et titre si séparés par un tiret
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
        detail="Veuillez fournir un lien Spotify valide ou un titre de chanson."
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
                    japanese=line.get("japanese", ""),
                    romaji=line.get("romaji", ""),
                    translation=line.get("translation", ""),
                    vocabulary=vocab_list
                ))

        return MusicLyricsResponse(
            title=data.get("title", req.title),
            artist=data.get("artist", req.artist or ""),
            anime_context=data.get("anime_context", ""),
            jlpt_level=data.get("jlpt_level", "N4"),
            lines=lines
        )
    except Exception as e:
        logger.error(f"Erreur analyse paroles musique: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'analyse des paroles : {str(e)}"
        )
