import os
from dotenv import load_dotenv

# Charger les variables d'environnement du fichier .env
load_dotenv()

# --- CONFIGURATION SOLIDE ---
# Clé API Groq récupérée depuis l'environnement
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("⚠️ ATTENTION : GROQ_API_KEY non trouvée dans le fichier .env")


# Le modèle stable actuel
MODEL_NAME = "llama-3.3-70b-versatile"

# Configuration des voix TTS par défaut
DEFAULT_VOICE = "ja-JP-NanamiNeural"
