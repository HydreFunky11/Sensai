import io
from manga_ocr import MangaOcr
from PIL import Image, ImageOps

class OCRService:
    def __init__(self):
        # Manga-OCR (Japonais spécialisé)
        print("Chargement de Manga-OCR... (Japonais)")
        self.mocr = MangaOcr()
        print("✅ OCR Japonais Prêt !")

    def recognize_text(self, image_data: bytes, lang: str = "ja") -> str:
        """
        Reconnaissance de texte optimisée pour le japonais.
        Applique un rehaussement de contraste pour les photos réelles de mangas papier.
        """
        try:
            # On convertit les bytes en objet PIL Image
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            
            # Prétraitement : rehaussement de contraste pour corriger les ombres des photos papier
            try:
                image = ImageOps.autocontrast(image, cutoff=0.5)
            except Exception:
                pass
            
            # Reconnaissance Manga-OCR
            text = self.mocr(image)
            
            # Debug log pour voir ce qui est extrait
            print(f"--- OCR Result ---")
            print(f"Extracted: {text}")
            print(f"------------------")
            
            return text
        except Exception as e:
            print(f"Erreur OCR : {e}")
            raise Exception(f"Erreur OCR Japonais : {str(e)}")

# Instance unique
ocr_service = OCRService()
