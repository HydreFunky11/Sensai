import pytest
import io
import fitz
from fastapi import status
def get_auth_headers(client, email="user@example.com"):
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def create_mock_pdf(num_pages=3):
    # Utilitaire pour générer un PDF valide en mémoire pour les tests unitaires
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        page.insert_text((50, 50), f"Page de test {i+1}")
    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes

from PIL import Image as PILImage

def create_mock_png():
    # Générer une image PNG valide en mémoire pour les tests unitaires
    img = PILImage.new("RGB", (100, 100), color="blue")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    return buffered.getvalue()

def test_import_image_with_custom_title(client):
    headers = get_auth_headers(client, "import_img@example.com")
    
    # Simuler un fichier image valide
    img_data = create_mock_png()
    file = io.BytesIO(img_data)
    
    response = client.post(
        "/library/import",
        files={"file": ("test_manga.png", file, "image/png")},
        data={"title": "Mon Super Manga Renommé"},
        headers=headers
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["title"] == "Mon Super Manga Renommé"
    assert data["file_path"].endswith(".png")

def test_import_pdf_with_page_split(client):
    headers = get_auth_headers(client, "import_pdf@example.com")
    
    # Générer un PDF de 5 pages en mémoire
    pdf_bytes = create_mock_pdf(5)
    file = io.BytesIO(pdf_bytes)
    
    # 1. Découper et importer uniquement les pages 2 à 4 (soit 3 pages extraites)
    response = client.post(
        "/library/import",
        files={"file": ("manga_volume.pdf", file, "application/pdf")},
        data={"title": "Chapitre Extrait", "page_start": 2, "page_end": 4},
        headers=headers
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["title"] == "Chapitre Extrait"
    
    # Vérifier que le fichier résultant sur le disque est bien un PDF de 3 pages
    saved_path = data["file_path"]
    assert saved_path.endswith(".pdf")
    
    doc = fitz.open(saved_path)
    assert len(doc) == 3  # Les pages 2, 3, et 4
    doc.close()

def test_import_pdf_with_invalid_range(client):
    headers = get_auth_headers(client, "import_fail@example.com")
    
    pdf_bytes = create_mock_pdf(3)
    
    # Test case 1 : Page de début > page de fin (2 à 1)
    file1 = io.BytesIO(pdf_bytes)
    response1 = client.post(
        "/library/import",
        files={"file": ("manga.pdf", file1, "application/pdf")},
        data={"page_start": 2, "page_end": 1},
        headers=headers
    )
    assert response1.status_code == status.HTTP_400_BAD_REQUEST
    assert "Plage de pages invalide" in response1.json()["detail"]

    # Test case 2 : Page de fin supérieure aux pages du document (1 à 10 sur un PDF de 3 pages)
    file2 = io.BytesIO(pdf_bytes)
    response2 = client.post(
        "/library/import",
        files={"file": ("manga.pdf", file2, "application/pdf")},
        data={"page_start": 1, "page_end": 10},
        headers=headers
    )
    assert response2.status_code == status.HTTP_400_BAD_REQUEST

def test_import_validation_security(client):
    headers = get_auth_headers(client, "security_import@example.com")
    
    # 1. Format non autorisé (.txt déguisé en PDF)
    fake_file = io.BytesIO(b"Hello world, I am a text file, not a PDF")
    response_type = client.post(
        "/library/import",
        files={"file": ("hack.pdf", fake_file, "application/pdf")},
        headers=headers
    )
    assert response_type.status_code == status.HTTP_400_BAD_REQUEST
    assert "Fichier PDF invalide" in response_type.json()["detail"]
    
    # 2. Format MIME interdit
    response_mime = client.post(
        "/library/import",
        files={"file": ("script.sh", io.BytesIO(b"echo hello"), "text/x-shellscript")},
        headers=headers
    )
    assert response_mime.status_code == status.HTTP_400_BAD_REQUEST
    assert "Format de fichier non autorisé" in response_mime.json()["detail"]
