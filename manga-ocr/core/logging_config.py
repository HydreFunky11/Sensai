import logging
from logging.handlers import RotatingFileHandler
import os

# Définir le chemin du fichier log (dans le dossier racine de manga-ocr)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(BASE_DIR, "sensai.log")

def setup_logging():
    # Format structuré incluant l'horodatage, le niveau de sévérité, le nom du logger et la ligne du fichier source
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(name)s - [%(filename)s:%(lineno)d] - %(message)s"
    )

    # Fichier journal rotatif (5 Mo max, 3 backups) pour empêcher tout déni de service disque (DoS)
    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Sortie console standard pour le conteneur Docker et le développement
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Éviter de dupliquer les flux de sortie
    if not root_logger.handlers:
        root_logger.addHandler(file_handler)
        root_logger.addHandler(console_handler)

    # Réduire le bruit des frameworks internes
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("multipart").setLevel(logging.WARNING)

    logging.info("Système de journalisation SensAI activé. Fichier cible : %s", LOG_FILE)
