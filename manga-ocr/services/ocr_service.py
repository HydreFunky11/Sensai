import io
import easyocr
from manga_ocr import MangaOcr
from PIL import Image
from langdetect import detect, DetectorFactory

# Pour avoir des résultats reproductibles avec langdetect
DetectorFactory.seed = 0

class OCRService:
    def __init__(self):
        # Manga-OCR (Japonais spécialisé)
        print("Chargement de Manga-OCR... (Japonais)")
        self.mocr = MangaOcr()
        
        # EasyOCR Reader cache
        self.readers = {}
        print("✅ OCR Japonais Prêt ! (EasyOCR chargé au besoin)")

    def _get_reader(self, langs):
        """Récupère ou crée un reader EasyOCR pour une liste de langues."""
        lang_key = tuple(sorted(langs))
        if lang_key not in self.readers:
            print(f"Chargement de EasyOCR pour : {langs}...")
            self.readers[lang_key] = easyocr.Reader(list(langs), gpu=False)
        return self.readers[lang_key]

    def recognize_text(self, image_data: bytes, lang: str = "ja") -> str:
        try:
            image = Image.open(io.BytesIO(image_data))
            print(f"--- Nouvelle requête OCR (lang demandée: {lang}) ---")
            
            # Cas 1 : Japonais forcé (Manga-OCR est bien meilleur)
            if lang == "ja":
                print("Utilisation forcée de Manga-OCR...")
                return self.mocr(image)
            
            # Cas 2 : Détection automatique
            if lang == "auto":
                print("Détection automatique activée...")
                # On commence par le japonais car c'est le cas le plus probable pour cette app
                text = self.mocr(image)
                
                # Si le texte est très court ou semble vide, ou si on veut confirmer la langue
                if text:
                    try:
                        detected_lang = detect(text)
                        print(f"Langue détectée par langdetect : {detected_lang}")
                        if detected_lang == 'ja':
                            print("Confirmation Japonais (Manga-OCR utilisé)")
                            return text
                    except Exception as e:
                        print(f"Erreur lors de la détection de langue: {e}")
                
                # Sinon on essaie EasyOCR avec un set large
                print("Essai avec EasyOCR (Multi-langues: en, ja, ch_sim, ko, fr)...")
                reader = self._get_reader(['en', 'ja', 'ch_sim', 'ko', 'fr'])
                results = reader.readtext(image_data, detail=0)
                full_text = " ".join(results)
                print(f"Résultat EasyOCR: {full_text[:50]}...")
                return full_text

            # Cas 3 : Autre langue spécifique (EasyOCR)
            else:
                print(f"Utilisation forcée de EasyOCR ({lang})...")
                reader = self._get_reader([lang])
                results = reader.readtext(image_data, detail=0)
                return " ".join(results)

        except Exception as e:
            raise Exception(f"Erreur OCR ({lang}): {str(e)}")

# Instance unique
ocr_service = OCRService()
