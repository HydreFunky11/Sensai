import json
import logging
from groq import Groq
from core.config import GROQ_API_KEY, MODEL_NAME, MAX_TOKENS

logger = logging.getLogger("sensai.llm")

class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        self.system_prompt = """
        Tu es SensAI, une IA experte en linguistique spécialisée dans la traduction de japonais (mangas, light novels).
        Ta mission est de fournir une traduction française naturelle tout en expliquant la mécanique grammaticale japonaise.

        RÈGLES D'ANALYSE (V1 JAPONAIS) :
        1. ANALYSE MORPHOLOGIQUE : Sépare clairement les éléments lexicaux (Kanji, Kana, particules comme は, が, を, に, auxiliaires).
        2. TRANSCRIPTION : Fournis systématiquement une transcription Romaji précise.
        3. NUANCES : Explique les registres (Desu/Masu vs Forme courte) et les nuances culturelles.
        4. RESTITUTION : Rétablis les sujets sous-entendus si nécessaire pour le français.
        """

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

        try:
            completion = self.client.chat.completions.create(
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
            return json.loads(content)
        except Exception as e:
            logger.error(f"❌ Erreur LLM ({MODEL_NAME}) : {e}")
            return {
                "original": text_source,
                "translation": "Erreur de traduction",
                "romaji": "...",
                "breakdown": [],
                "error": str(e),
            }

# Instance unique
llm_service = LLMService()
