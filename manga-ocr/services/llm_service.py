import json
from groq import Groq
from core.config import GROQ_API_KEY, MODEL_NAME

class LLMService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        self.system_prompt = """
        Tu es SensAI, une IA experte en linguistique spécialisée dans la traduction de mangas, bandes dessinées et comics.
        Ta mission est de fournir une traduction française naturelle tout en expliquant la mécanique grammaticale de la langue source.

        RÈGLES D'ANALYSE GLOBALES :
        1. ANALYSE MORPHOLOGIQUE : Sépare clairement les éléments lexicaux (racines, particules, auxiliaires).
        2. NUANCES ET CONTEXTE : Explique les subtilités culturelles ou les registres de langue (poli, familier, argot).
        3. RESTITUTION : Rétablis les éléments implicites pour une lecture fluide en français.
        4. ADAPTATION : Adapte-toi à la langue source détectée (Japonais, Coréen, Chinois, Anglais...).
        """

    def analyze_text(self, text_source: str, lang: str = "ja") -> dict:
        user_prompt = f"""
        Analyse ce segment de texte provenant d'un scan (Langue source : {lang}) : "{text_source}"

        Format JSON attendu (Strict) :
        {{
            "original": "{text_source}",
            "romaji": "Transcription phonétique (Romaji pour JP, Pinyin pour CN, etc.)",
            "translation": "Traduction française fluide",
            "breakdown": [
                {{
                    "word": "Mot",
                    "romanji": "Transcription",
                    "type": "Classe grammaticale",
                    "meaning": "Sens littéral",
                    "grammar": "Fonction ou nuance"
                }}
            ],
            "context_note": "Analyse du ton et contexte culturel."
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
                response_format={"type": "json_object"},
            )
            return json.loads(completion.choices[0].message.content)
        except Exception as e:
            print(f"❌ Erreur Groq : {e}")
            return {
                "original": text_jap,
                "translation": "Erreur de traduction",
                "romaji": "...",
                "breakdown": [],
                "error": str(e),
            }

# Instance unique
llm_service = LLMService()
