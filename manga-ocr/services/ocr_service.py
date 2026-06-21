import io
from manga_ocr import MangaOcr
from PIL import Image

class OCRService:
    def __init__(self):
        # Manga-OCR (Japonais spécialisé)
        print("Chargement de Manga-OCR... (Japonais)")
        self.mocr = MangaOcr()
        print("✅ OCR Japonais Prêt !")

    def recognize_text(self, image_data: bytes, lang: str = "ja") -> str:
        """
        Reconnaissance de texte optimisée pour le japonais (V1).
        L'argument lang est conservé pour la compatibilité mais ignoré.
        """
        try:
            # On convertit les bytes en objet PIL Image
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            
            # V1 : On utilise exclusivement Manga-OCR
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
