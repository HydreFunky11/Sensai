import io
from huggingface_hub import hf_hub_download
from ultralytics import YOLO
from PIL import Image
import os

class DetectionService:
    def __init__(self):
        print("Chargement du modèle de détection YOLOv8...")
        try:
            # Télécharge ou utilise le cache pour le modèle HuggingFace
            model_path = hf_hub_download(
                repo_id="ogkalu/comic-speech-bubble-detector-yolov8m",
                filename="comic-speech-bubble-detector.pt"
            )
            self.model = YOLO(model_path)
            self.is_loaded = True
            print("✅ Détecteur de bulles prêt !")
        except Exception as e:
            print(f"❌ Erreur chargement YOLO: {e}")
            self.is_loaded = False

    def detect_bubbles(self, image_data: bytes) -> list:
        if not self.is_loaded:
            raise Exception("Model not loaded")
            
        try:
            image = Image.open(io.BytesIO(image_data)).convert("RGB")
            
            # Inférer avec un niveau de confiance raisonnable
            results = self.model(image, conf=0.25)
            
            boxes_list = []
            
            if len(results) > 0:
                for box in results[0].boxes:
                    # coords: [x_min, y_min, x_max, y_max]
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # Padding optionnel pour ne pas couper de texte sur les bords de la bulle
                    padding = 5
                    x1 = max(0, x1 - padding)
                    y1 = max(0, y1 - padding)
                    x2 = min(image.width, x2 + padding)
                    y2 = min(image.height, y2 + padding)
                    
                    boxes_list.append({
                        "x": int(x1),
                        "y": int(y1),
                        "width": int(x2 - x1),
                        "height": int(y2 - y1),
                        "confidence": float(box.conf[0])
                    })
                    
            # Optionnel: trier les bulles de haut en bas, puis de droite à gauche pour le japonais
            # Pour l'instant on les renvoie brutes, le clic utilisateur fera foi
            return boxes_list
            
        except Exception as e:
            print(f"Erreur detection YOLO: {e}")
            raise Exception("Failed to detect bubbles")

detection_service = DetectionService()
