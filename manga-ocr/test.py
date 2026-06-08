from manga_ocr import MangaOcr

# 1. Initialisation du modèle
# Au premier lancement, ça va télécharger environ 400-500 Mo de données.
print("Chargement du modèle Manga-OCR... (Patientez)")
mocr = MangaOcr()

# 2. Chemin vers ton image
image_path = "test.png"

# 3. Lecture (OCR)
print(f"Lecture de l'image : {image_path}...")
resultat = mocr(image_path)

# 4. Affichage du résultat
print("-" * 30)
print("TEXTE DÉTECTÉ :")
print(resultat)
print("-" * 30)
