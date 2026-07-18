from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import logging
from db.database import get_db
from db import models
from core import security
from core.rate_limiter import limiter_strict

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("sensai.auth")

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", response_model=Token, dependencies=[Depends(limiter_strict)])
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        logger.warning("Échec d'inscription : l'email %s est déjà enregistré", user.email)
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    
    hashed_password = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    logger.info("Nouvel utilisateur enregistré avec succès : %s", user.email)
    access_token = security.create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token, dependencies=[Depends(limiter_strict)])
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not security.verify_password(user.password, db_user.hashed_password):
        logger.warning("Échec de connexion : email ou mot de passe incorrect pour %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info("Connexion réussie pour l'utilisateur : %s", db_user.email)
    access_token = security.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

from api.deps import get_current_user

from typing import Optional

class UserMe(BaseModel):
    id: int
    email: str
    is_premium: bool

    class Config:
        from_attributes = True

@router.get("/me", response_model=UserMe)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None

@router.put("/me", response_model=UserMe)
def update_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if profile_data.email:
        # Check if email is already registered by another user
        existing_user = db.query(models.User).filter(
            models.User.email == profile_data.email, 
            models.User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Cette adresse email est déjà utilisée par un autre compte.")
        current_user.email = profile_data.email

    if profile_data.password:
        current_user.hashed_password = security.get_password_hash(profile_data.password)

    db.commit()
    db.refresh(current_user)
    return current_user

import os

@router.delete("/me")
def delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    logger.info("Demande de suppression définitive du compte reçue pour : %s", current_user.email)
    # 1. Supprimer tous les fichiers mangas physiques de l'utilisateur sur le disque
    manga_count = len(current_user.mangas)
    for manga in current_user.mangas:
        if manga.file_path and os.path.exists(manga.file_path):
            try:
                os.remove(manga.file_path)
            except Exception as e:
                logger.error("Erreur de suppression du fichier manga %s : %s", manga.file_path, str(e))
                pass

    # 2. Supprimer les logs de révision et d'analyse liés
    db.query(models.ReviewLog).filter(models.ReviewLog.user_id == current_user.id).delete()
    db.query(models.DeckReviewLog).filter(models.DeckReviewLog.user_id == current_user.id).delete()
    db.query(models.AnalysisLog).filter(models.AnalysisLog.user_id == current_user.id).delete()

    # 3. Supprimer le compte utilisateur (les relations en cascade s'occupent des mangas, decks, flashcards et learned_characters)
    user_email = current_user.email
    db.delete(current_user)
    db.commit()

    logger.info("Compte %s et %d fichiers mangas associés supprimés définitivement de la base de données et du disque.", user_email, manga_count)
    return {"message": "Votre compte et toutes les données associées ont été définitivement supprimés."}

@router.get("/me/export")
def export_user_data(
    current_user: models.User = Depends(get_current_user)
):
    logger.info("Exportation des données personnelles initiée pour : %s (RGPD Droit à la portabilité)", current_user.email)
    # Structurer toutes les informations confidentielles de l'utilisateur au format standard portabilité RGPD
    data = {
        "profile": {
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "is_premium": current_user.is_premium
        },
        "library": {
            "folders": [
                {
                    "name": folder.name,
                    "mangas": [
                        {
                            "title": manga.title,
                            "file_path": manga.file_path
                        } for manga in folder.mangas
                    ]
                } for folder in current_user.folders
            ],
            "root_mangas": [
                {
                    "title": manga.title,
                    "file_path": manga.file_path
                } for manga in current_user.mangas if manga.folder_id is None
            ]
        },
        "srs_revision": {
            "learned_characters": [
                {
                    "character": char.character,
                    "alphabet_type": char.alphabet_type,
                    "learned_at": char.learned_at.isoformat() if char.learned_at else None
                } for char in current_user.learned_characters
            ],
            "decks": [
                {
                    "title": deck.title,
                    "description": deck.description,
                    "cards": [
                        {
                            "text_source": card.text_source,
                            "translation": card.translation,
                            "romaji": card.romaji,
                            "context_note": card.context_note,
                            "review_stats": {
                                "next_review_date": card.review_stats.next_review_date.isoformat() if card.review_stats and card.review_stats.next_review_date else None,
                                "interval": card.review_stats.interval if card.review_stats else 0,
                                "ease_factor": card.review_stats.ease_factor if card.review_stats else 2.5
                            } if card.review_stats else None
                        } for card in deck.cards
                    ]
                } for deck in current_user.decks
            ]
        }
    }
    return data
