import os
from dotenv import load_dotenv

# Charger les variables d'environnement du fichier .env
load_dotenv()

# --- CONFIGURATION SOLIDE ---
# Clé API Groq récupérée depuis l'environnement
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("⚠️ ATTENTION : GROQ_API_KEY non trouvée dans le fichier .env")


# Le modèle stable actuel sur Groq
MODEL_NAME = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "800"))

# Configuration des voix TTS par défaut
DEFAULT_VOICE = "ja-JP-NanamiNeural"
