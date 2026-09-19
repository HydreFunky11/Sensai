import json
import logging
import re
import httpx
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
        # 1. Nettoyage des balises Markdown (ex: ```json ... ``` ou ``` ... ```)
        if "```" in content:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if match:
                content = match.group(1).strip()

        # 2. Extraction ciblée du premier objet JSON complet si texte parasite
        if not (content.startswith("{") and content.endswith("}")):
            match = re.search(r"(\{[\s\S]*\})", content)
            if match:
                content = match.group(1).strip()

        data = json.loads(content)

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

    def analyze_music_lyrics(self, title: str, artist: str = "", custom_lyrics: str = "") -> dict:
        music_system_prompt = """
        Tu es SensAI Music, une IA experte en linguistique japonaise et en transcription de paroles de musique.
        Ta mission est de fournir les paroles japonaises complètes (ou d'analyser le texte fourni), leur transcription Romaji, leur traduction française poétique et fidèle, ainsi que le minutage précis pour le karaoké et le vocabulaire clé.

        NE FOURNIS AUCUNE ANALYSE D'ANIME, HISTORIQUE OU INTERPRÉTATION SUPERFICIELLE. Concentre-toi strictement sur les paroles et le niveau linguistique JLPT.

        Format JSON strict :
        {
            "title": "Titre exact",
            "artist": "Nom de l'artiste",
            "jlpt_level": "N3",
            "lines": [
                {
                    "id": 1,
                    "time": 0.0,
                    "duration": 4.5,
                    "japanese": "誰もが目を奪われていく",
                    "romaji": "Daremo ga me wo ubawarete iku",
                    "translation": "Tout le monde se fait captiver le regard"
                }
            ],
            "vocabulary": [
                {
                    "word": "目を奪う",
                    "romanji": "me wo ubau",
                    "meaning": "capter le regard, éblouir",
                    "type": "expression / verbe"
                }
            ]
        }
        Règles d'extraction :
        1. Transcris chaque vers dans 'lines' avec son timestamp 'time' en secondes progressif (0.0, 4.0, 8.5...) et 'duration' (en secondes).
        2. Fournis un découpage complet et fluide (20 à 40 vers).
        3. Dans 'vocabulary', regroupe 8 à 15 mots et tournures grammaticales clés à apprendre pour ce morceau.
        4. Réponds STRICTEMENT avec l'objet JSON ci-dessus, sans aucun texte introductif.
        """

        if custom_lyrics and custom_lyrics.strip():
            user_prompt = f"""
            Analyse et synchronise ces paroles pour la chanson '{title}' ({artist}) :
            {custom_lyrics.strip()}
            """
        else:
            user_prompt = f"""
            Fournis et synchronise les paroles japonaises complètes de la chanson '{title}' par '{artist}'.
            Chaque phrase ou vers doit former un élément individuel dans 'lines' avec son minutage approximatif (time en secondes).
            """

        data = None
        if OPENROUTER_API_KEY:
            try:
                logger.info(f"🎵 Analyse Paroles Musique via OpenRouter ({OPENROUTER_MODEL})...")
                data = self._call_openrouter(user_prompt, title, system_prompt=music_system_prompt, max_tokens=3500)
            except Exception as e:
                logger.warning(f"⚠️ Échec OpenRouter musique : {e}. Bascule Groq...")

        if not data or "lines" not in data:
            if GROQ_API_KEY:
                try:
                    logger.info(f"🔄 Fallback analyse Paroles Musique via Groq ({MODEL_NAME})...")
                    data = self._call_groq(user_prompt, title, system_prompt=music_system_prompt, max_tokens=3500)
                except Exception as e:
                    logger.error(f"❌ Échec fallback Groq musique : {e}")

        if not data or "lines" not in data or len(data["lines"]) == 0:
            # Fallback gracieux si échec
            data = {
                "title": title,
                "artist": artist,
                "jlpt_level": "N4",
                "lines": [
                    {
                        "id": 1,
                        "time": 0.0,
                        "duration": 4.5,
                        "japanese": f"{title} - {artist}",
                        "romaji": "Nihon no ongaku",
                        "translation": f"Paroles de {title} par {artist}"
                    }
                ],
                "vocabulary": []
            }

        # Post-traitement : s'assurer que chaque ligne dispose d'un timestamp 'time' et 'duration' cohérents
        current_time = 0.0
        for i, line in enumerate(data.get("lines", [])):
            if not isinstance(line, dict):
                continue
            line["id"] = i + 1
            if "duration" not in line or not line["duration"]:
                # Durée calculée intelligemment selon la longueur du vers japonais (min 3.5s)
                jp_len = len(line.get("japanese", ""))
                line["duration"] = round(max(3.2, min(7.5, jp_len * 0.28)), 1)
            if "time" not in line or line.get("time") is None:
                line["time"] = round(current_time, 1)
            current_time = line["time"] + line["duration"]

        return data


# Instance unique
llm_service = LLMService()

