import json
import logging
import re
import httpx
from groq import Groq
from core.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_MAX_TOKENS,
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
        content = raw_text.strip()
        # Nettoyage des balises Markdown (ex: ```json ... ```)
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
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

    def _call_openrouter(self, user_prompt: str, text_source: str) -> dict:
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY non configurée.")

        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:5173",
            "X-Title": "SensAI",
        }
        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": OPENROUTER_MAX_TOKENS,
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        content = choice["message"].get("content")
        if not content:
            raise ValueError(f"Réponse vide reçue d'OpenRouter : {data}")

        return self._normalize_json_payload(content, text_source)

    def _call_groq(self, user_prompt: str, text_source: str) -> dict:
        if not self.groq_client:
            raise ValueError("GROQ_API_KEY non configurée pour le fallback.")

        completion = self.groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=MODEL_NAME,
            temperature=0,
            max_tokens=MAX_TOKENS,
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


# Instance unique
llm_service = LLMService()

