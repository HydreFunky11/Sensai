from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "706e309536098273645091827346091827346091827346091827346091827346") # À changer en prod
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 semaine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

from io import BytesIO
from PIL import Image
from fastapi import HTTPException, UploadFile, status

MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 Mo
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

async def validate_uploaded_image(file: UploadFile):
    # 1. Validation du type de contenu MIME déclaré
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format de fichier non autorisé. Formats autorisés : JPEG, PNG, WEBP, GIF."
        )
    
    # 2. Lecture du fichier pour vérification de la taille en octets
    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Le fichier dépasse la taille maximale autorisée de {MAX_IMAGE_SIZE / (1024 * 1024)} Mo."
        )
    
    # Repositionner le curseur au début pour que le reste de la route puisse lire le fichier
    await file.seek(0)

    # 3. Vérification de la signature du fichier (Magic Bytes) via l'ouverture par Pillow
    try:
        img = Image.open(BytesIO(contents))
        img.verify()  # Valide les en-têtes et le format de l'image
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fichier image invalide ou corrompu (signature incorrecte)."
        )
    
    # Repositionner une nouvelle fois le curseur pour la route principale
    await file.seek(0)

import fitz  # PyMuPDF

MAX_MANGA_SIZE = 100 * 1024 * 1024  # 100 Mo
ALLOWED_MANGA_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}

async def validate_uploaded_manga(file: UploadFile):
    # 1. Validation du type de contenu MIME
    if file.content_type not in ALLOWED_MANGA_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, WEBP."
        )
    
    # 2. Lecture du fichier pour vérification de la taille (max 100 Mo)
    contents = await file.read()
    if len(contents) > MAX_MANGA_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Le fichier dépasse la taille maximale autorisée de {MAX_MANGA_SIZE / (1024 * 1024)} Mo pour un manga."
        )
    
    # Repositionner le curseur
    await file.seek(0)

    # 3. Vérification d'intégrité selon le type
    if file.content_type == "application/pdf":
        try:
            # Vérifier si le PDF s'ouvre correctement en mémoire
            doc = fitz.open(stream=contents, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("PDF vide")
            doc.close()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fichier PDF invalide ou corrompu."
            )
    else:
        try:
            img = Image.open(BytesIO(contents))
            img.verify()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Fichier image invalide ou corrompu (signature incorrecte)."
            )
    
    # Repositionner une nouvelle fois le curseur
    await file.seek(0)
