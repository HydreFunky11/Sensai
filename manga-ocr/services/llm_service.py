import json
import logging
import re
import httpx
import pykakasi
from groq import Groq
from core.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_MAX_TOKENS,
    OPENROUTER_TIMEOUT,
    GROQ_API_KEY,
    MODEL_NAME,
    MAX_TOKENS,
)

logger = logging.getLogger("sensai.llm")

# Initialisation du convertisseur Romaji pykakasi
_kakasi = pykakasi.kakasi()

def to_romaji(text: str) -> str:
    """Convertit du texte japonais en Romaji Hepburn propre."""
    if not text:
        return ""
    try:
        conv = _kakasi.convert(text)
        return " ".join(" ".join([item["hepburn"] for item in conv if item.get("hepburn")]).split())
    except Exception:
        return text


class LLMService:
    def __init__(self):
        self.groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
        self.client = self.groq_client  # Rétrocompatibilité
        self.system_prompt = """
        Tu es SensAI, une IA experte en linguistique spécialisée dans la traduction de japonais (mangas, light novels).
        Ta mission est de fournir une traduction française naturelle tout en expliquant la mécanique grammaticale japonaise.

        RÈGLES D'ANALYSE (V1 JAPONAIS) :
        1. ANALYSE MORPHOLOGIQUE : Sépare clairement les éléments lexicaux (Kanji, Kana, particules comme は, が, を, に, auxiliaires).
        2. TRANSCRIPTION : Fournis systématiquement une transcription Romaji précise.
        3. NUANCES : Explique les registres (Desu/Masu vs Forme courte) et les nuances culturelles.
        4. RESTITUTION : Rétablis les sujets sous-entendus si nécessaire pour le français.
        Réponds STRICTEMENT avec l'objet JSON demandé, sans texte introductif ni markdown superflu.
        """

    def _normalize_json_payload(self, raw_text: str, text_source: str) -> dict:
        if not raw_text:
            raise ValueError("Texte de réponse vide reçu du modèle.")

        content = raw_text.strip()
        # 1. Nettoyage des balises de pensée / reasoning de certains modèles (ex: Minimax, DeepSeek)
        content = re.sub(r"<thinking>[\s\S]*?</thinking>", "", content, flags=re.IGNORECASE)
        content = re.sub(r"<thought>[\s\S]*?</thought>", "", content, flags=re.IGNORECASE)
        content = re.sub(r"\]<\]minimax\[>\[[\s\S]*?\]<\]minimax\[>\[", "", content)
        content = re.sub(r"\[<thinking>[\s\S]*?</thinking>\]", "", content, flags=re.IGNORECASE)
        content = content.strip()

        # 2. Nettoyage des balises Markdown (ex: ```json ... ``` ou ``` ... ```)
        if "```" in content:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if match:
                content = match.group(1).strip()

        # 3. Extraction ciblée du premier objet JSON complet si texte parasite
        if not (content.startswith("{") and content.endswith("}")):
            match = re.search(r"(\{[\s\S]*\"translation\"[\s\S]*\})", content)
            if match:
                content = match.group(1).strip()
            else:
                match = re.search(r"(\{[\s\S]*\})", content)
                if match:
                    content = match.group(1).strip()

        data = json.loads(content)

        # Vérifier impérativement la présence d'une traduction exploitable
        if not data.get("translation") or not isinstance(data.get("translation"), str) or not data.get("translation").strip():
            raise ValueError(f"Payload JSON incomplet (clé 'translation' absente ou vide) : {data}")

        # Normaliser les éléments de breakdown pour assurer la présence de 'romanji' et 'romaji'
        if "breakdown" in data and isinstance(data["breakdown"], list):
            for item in data["breakdown"]:
                if isinstance(item, dict):
                    if "romaji" in item and "romanji" not in item:
                        item["romanji"] = item["romaji"]
                    elif "romanji" in item and "romaji" not in item:
                        item["romaji"] = item["romanji"]

        if not data.get("original"):
            data["original"] = text_source

        return data

    def _call_openrouter(self, user_prompt: str, text_source: str, system_prompt: str = None, max_tokens: int = None) -> dict:
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY non configurée.")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:5173",
            "X-Title": "SensAI",
        }
        sys_prompt = system_prompt or self.system_prompt
        # Optimisation haute performance pour la réactivité du lecteur
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens or OPENROUTER_MAX_TOKENS,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
            "include_reasoning": False,
            "provider": {"sort": "latency"},
        }

        with httpx.Client(timeout=OPENROUTER_TIMEOUT) as client:
            resp = client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        message = choice.get("message", {})
        # Certains fournisseurs renvoient le résultat dans 'content', d'autres dans 'reasoning'
        content = message.get("content") or message.get("reasoning")
        if not content and "reasoning_details" in message:
            for detail in message.get("reasoning_details", []):
                if isinstance(detail, dict) and detail.get("text"):
                    content = detail["text"]
                    break

        if not content:
            raise ValueError(f"Réponse vide reçue d'OpenRouter : {data}")

        return self._normalize_json_payload(content, text_source)


    def _call_groq(self, user_prompt: str, text_source: str, system_prompt: str = None, max_tokens: int = None) -> dict:
        if not self.groq_client:
            raise ValueError("GROQ_API_KEY non configurée pour le fallback.")

        sys_prompt = system_prompt or self.system_prompt
        completion = self.groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=MODEL_NAME,
            temperature=0,
            max_tokens=max_tokens or MAX_TOKENS,
            response_format={"type": "json_object"},
        )
        content = completion.choices[0].message.content
        return self._normalize_json_payload(content, text_source)

    def analyze_text(self, text_source: str, lang: str = "ja") -> dict:
        user_prompt = f"""
        Analyse ce segment de texte japonais provenant d'un scan : "{text_source}"

        Format JSON attendu (Strict) :
        {{
            "original": "{text_source}",
            "romaji": "Transcription phonétique en Romaji",
            "translation": "Traduction française fluide",
            "breakdown": [
                {{
                    "word": "Mot original (Kanji/Kana)",
                    "romanji": "Transcription Romaji",
                    "type": "Classe grammaticale (Nom, Verbe, Particule, etc.)",
                    "meaning": "Sens littéral",
                    "grammar": "Fonction ou nuance (ex: particule de sujet, forme causative, etc.)"
                }}
            ],
            "context_note": "Analyse du ton et contexte culturel (poli, familier, etc.)."
        }}
        """

        # 1. Tentative principale via OpenRouter (ex: minimax/minimax-m3)
        if OPENROUTER_API_KEY:
            try:
                logger.info(f"🤖 Analyse LLM via OpenRouter ({OPENROUTER_MODEL})...")
                return self._call_openrouter(user_prompt, text_source)
            except Exception as e:
                logger.warning(f"⚠️ Échec OpenRouter ({OPENROUTER_MODEL}) : {e}. Bascule sur Groq...")

        # 2. Fallback via Groq
        if GROQ_API_KEY:
            try:
                logger.info(f"🔄 Fallback analyse LLM via Groq ({MODEL_NAME})...")
                return self._call_groq(user_prompt, text_source)
            except Exception as e:
                logger.error(f"❌ Échec du fallback Groq ({MODEL_NAME}) : {e}")

        # 3. Réponse d'erreur sécurisée si tous les fournisseurs échouent
        return {
            "original": text_source,
            "translation": "Erreur de traduction",
            "romaji": "...",
            "breakdown": [],
            "error": "Impossible d'obtenir une réponse de l'IA (OpenRouter & Groq indisponibles).",
        }

    def _fetch_lrclib_lyrics(self, title: str, artist: str = "") -> dict:
        """
        Interroge l'API LRCLIB pour obtenir les paroles officielles et minutées (syncedLyrics).
        """
        clean_title = re.sub(r"\(.*?\)|\[.*?\]", "", title).strip()
        clean_artist = re.sub(r"\(.*?\)|\[.*?\]", "", artist).strip()
        headers = {"User-Agent": "SensAI-Music/1.0"}

        # 1. Recherche avec titre et artiste nettoyés
        if clean_title:
            try:
                params = {"track_name": clean_title}
                if clean_artist:
                    params["artist_name"] = clean_artist
                with httpx.Client(timeout=6.0) as client:
                    resp = client.get("https://lrclib.net/api/get", params=params, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("syncedLyrics") or data.get("plainLyrics"):
                            return data
            except Exception as e:
                logger.debug(f"LRCLIB essai 1 ({clean_title} - {clean_artist}) échec : {e}")

        # 2. Recherche avec juste le titre si artiste spécifié non trouvé
        if clean_title and clean_artist:
            try:
                with httpx.Client(timeout=6.0) as client:
                    resp = client.get("https://lrclib.net/api/get", params={"track_name": clean_title}, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("syncedLyrics") or data.get("plainLyrics"):
                            return data
            except Exception as e:
                logger.debug(f"LRCLIB essai 2 ({clean_title}) échec : {e}")

        # 3. Recherche avec le titre brut
        if title != clean_title:
            try:
                params = {"track_name": title.strip()}
                if artist:
                    params["artist_name"] = artist.strip()
                with httpx.Client(timeout=6.0) as client:
                    resp = client.get("https://lrclib.net/api/get", params=params, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("syncedLyrics") or data.get("plainLyrics"):
                            return data
            except Exception as e:
                logger.debug(f"LRCLIB essai 3 ({title}) échec : {e}")

        return {}

    def analyze_music_lyrics(self, title: str, artist: str = "", custom_lyrics: str = "") -> dict:
        """
        Extrait les paroles japonaises complètes (via LRCLIB ou saisie personnalisée),
        génère la transcription Romaji via pykakasi, synchronise les timestamps
        et traduit avec extraction du vocabulaire JLPT via LLM.
        """
        raw_lines = []
        is_synced = False

        # 1. Vérifier si des paroles personnalisées ont été fournies manuellement
        if custom_lyrics and custom_lyrics.strip():
            logger.info(f"📝 Utilisation des paroles personnalisées fournies pour '{title}'...")
            for line_str in custom_lyrics.strip().split("\n"):
                clean_l = line_str.strip()
                if clean_l:
                    raw_lines.append({"japanese": clean_l})
        else:
            # 2. Interroger LRCLIB pour les vraies paroles officielles
            logger.info(f"🔎 Recherche des paroles officielles sur LRCLIB pour '{title}' ({artist})...")
            lrclib_data = self._fetch_lrclib_lyrics(title, artist)
            synced_lyrics = lrclib_data.get("syncedLyrics")
            plain_lyrics = lrclib_data.get("plainLyrics")

            if synced_lyrics and synced_lyrics.strip():
                logger.info(f"✅ Paroles synchronisées trouvées sur LRCLIB pour '{title}' !")
                is_synced = True
                for line_str in synced_lyrics.strip().split("\n"):
                    m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)", line_str.strip())
                    if m and m.group(3).strip():
                        t = round(int(m.group(1)) * 60 + float(m.group(2)), 2)
                        raw_lines.append({"time": t, "japanese": m.group(3).strip()})
            elif plain_lyrics and plain_lyrics.strip():
                logger.info(f"✅ Paroles texte brut trouvées sur LRCLIB pour '{title}' !")
                for line_str in plain_lyrics.strip().split("\n"):
                    clean_l = line_str.strip()
                    if clean_l:
                        raw_lines.append({"japanese": clean_l})

        # 3. Si nous avons des vers réels (de LRCLIB ou custom_lyrics)
        if raw_lines:
            current_time = 0.0
            for i, line in enumerate(raw_lines):
                line["id"] = i + 1
                line["romaji"] = to_romaji(line["japanese"])
                if is_synced:
                    if i < len(raw_lines) - 1:
                        diff = round(raw_lines[i + 1]["time"] - line["time"], 1)
                        line["duration"] = min(max(2.5, diff), 6.5)
                    else:
                        line["duration"] = 4.0
                else:
                    line["time"] = round(current_time, 1)
                    jp_len = len(line["japanese"])
                    line["duration"] = round(max(3.2, min(7.5, jp_len * 0.28)), 1)
                    current_time += line["duration"]

            # Traduction et vocabulaire via LLM (Groq en priorité pour sa rapidité <1s et absence de dépassement)
            lines_to_translate = raw_lines[:40]
            lines_text = "\n".join([f"{l['id']}. {l['japanese']}" for l in lines_to_translate])

            translate_prompt = f"""
            Tu es un traducteur expert du japonais vers le français.
            Traduis chaque vers de la chanson '{title}' ({artist}) en français fluide et fidèle, détermine le niveau linguistique JLPT global (N5 à N1), et relève 8 à 15 mots de vocabulaire clés.
            
            Format JSON STRICT attendu :
            {{
                "jlpt_level": "N3",
                "translations": [
                    "Traduction du vers 1",
                    "Traduction du vers 2"
                ],
                "vocabulary": [
                    {{
                        "word": "Mot original",
                        "romanji": "Transcription romaji",
                        "meaning": "Signification en français",
                        "type": "Classe grammaticale"
                    }}
                ]
            }}

            Vers à traduire :
            {lines_text}
            """

            analysis_result = None
            if GROQ_API_KEY:
                try:
                    logger.info("⚡ Traduction et vocabulaire par Groq...")
                    analysis_result = self._call_groq(translate_prompt, title, max_tokens=850)
                except Exception as e:
                    logger.warning(f"⚠️ Échec Groq traduction : {e}")

            if not analysis_result and OPENROUTER_API_KEY:
                try:
                    logger.info(f"⚡ Traduction et vocabulaire par OpenRouter ({OPENROUTER_MODEL})...")
                    analysis_result = self._call_openrouter(translate_prompt, title, max_tokens=1500)
                except Exception as e:
                    logger.warning(f"⚠️ Échec OpenRouter traduction : {e}")

            translations = []
            vocabulary = []
            jlpt_level = "N3"

            if analysis_result and isinstance(analysis_result, dict):
                translations = analysis_result.get("translations", [])
                vocabulary = analysis_result.get("vocabulary", [])
                jlpt_level = analysis_result.get("jlpt_level", "N3")

            for i, line in enumerate(raw_lines):
                if i < len(translations) and isinstance(translations[i], str) and translations[i].strip():
                    line["translation"] = translations[i].strip()
                else:
                    line["translation"] = line["japanese"]

            return {
                "title": title,
                "artist": artist,
                "jlpt_level": jlpt_level,
                "lines": raw_lines,
                "vocabulary": vocabulary
            }

        # 4. Fallback LLM pur si ni LRCLIB ni custom_lyrics n'ont donné de résultats
        logger.info(f"🤖 Recherche et génération LLM pour '{title}' ({artist})...")
        music_system_prompt = """
        Tu es SensAI Music, une IA experte en linguistique japonaise.
        Fournis les paroles japonaises de la chanson, leur transcription Romaji, leur traduction française et le vocabulaire clé.
        Format JSON strict :
        {
            "title": "Titre",
            "artist": "Artiste",
            "jlpt_level": "N3",
            "lines": [
                {
                    "id": 1,
                    "time": 0.0,
                    "duration": 4.5,
                    "japanese": "Vers japonais",
                    "romaji": "Transcription romaji",
                    "translation": "Traduction française"
                }
            ],
            "vocabulary": [
                {
                    "word": "Mot",
                    "romanji": "romaji",
                    "meaning": "sens",
                    "type": "type"
                }
            ]
        }
        """
        user_prompt = f"Fournis et analyse les paroles japonaises de la chanson '{title}' par '{artist}'."
        data = None

        if GROQ_API_KEY:
            try:
                data = self._call_groq(user_prompt, title, system_prompt=music_system_prompt, max_tokens=850)
            except Exception as e:
                logger.warning(f"⚠️ Échec Groq fallback : {e}")

        if not data and OPENROUTER_API_KEY:
            try:
                data = self._call_openrouter(user_prompt, title, system_prompt=music_system_prompt, max_tokens=1500)
            except Exception as e:
                logger.warning(f"⚠️ Échec OpenRouter fallback : {e}")

        if not data or "lines" not in data or len(data["lines"]) == 0:
            data = {
                "title": title,
                "artist": artist,
                "jlpt_level": "N3",
                "lines": [
                    {
                        "id": 1,
                        "time": 0.0,
                        "duration": 4.5,
                        "japanese": f"{title} - {artist}",
                        "romaji": to_romaji(title),
                        "translation": f"Chanson {title} de {artist}"
                    }
                ],
                "vocabulary": []
            }

        current_time = 0.0
        for i, line in enumerate(data.get("lines", [])):
            if not isinstance(line, dict):
                continue
            line["id"] = i + 1
            if not line.get("romaji"):
                line["romaji"] = to_romaji(line.get("japanese", ""))
            if "duration" not in line or not line["duration"]:
                jp_len = len(line.get("japanese", ""))
                line["duration"] = round(max(3.2, min(7.5, jp_len * 0.28)), 1)
            if "time" not in line or line.get("time") is None:
                line["time"] = round(current_time, 1)
            current_time = line["time"] + line["duration"]

        return data


# Instance unique
llm_service = LLMService()

