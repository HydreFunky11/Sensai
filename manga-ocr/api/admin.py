from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import logging

from db.database import get_db
from db import models
from api.deps import get_current_admin_user
from core import security

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("sensai.admin")

class UserSummary(BaseModel):
    id: int
    email: str
    is_admin: bool
    is_premium: bool
    created_at: Optional[datetime] = None
    flashcards_count: int = 0
    decks_count: int = 0
    mangas_count: int = 0

    class Config:
        from_attributes = True

class AdminUserCreate(BaseModel):
    email: str
    password: str
    is_premium: bool = False
    is_admin: bool = False

class AdminUserUpdatePremium(BaseModel):
    is_premium: bool

class AdminUserResetPassword(BaseModel):
    new_password: str

class AdminStats(BaseModel):
    total_users: int
    total_testers: int
    total_admins: int
    total_premium: int
    total_mangas: int
    total_decks: int
    total_cards: int

@router.get("/stats", response_model=AdminStats)
def get_stats(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    total_users = db.query(models.User).count()
    total_admins = db.query(models.User).filter(models.User.is_admin == True).count()
    total_testers = total_users - total_admins
    total_premium = db.query(models.User).filter(models.User.is_premium == True).count()
    total_mangas = db.query(models.Manga).count()
    total_decks = db.query(models.Deck).count()
    total_cards = db.query(models.Flashcard).count()

    return {
        "total_users": total_users,
        "total_testers": total_testers,
        "total_admins": total_admins,
        "total_premium": total_premium,
        "total_mangas": total_mangas,
        "total_decks": total_decks,
        "total_cards": total_cards
    }

@router.get("/users", response_model=List[UserSummary])
def list_users(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    users = db.query(models.User).order_by(models.User.id.desc()).all()
    results = []
    for u in users:
        cards_count = db.query(func.count(models.Flashcard.id)).join(models.Deck, models.Flashcard.deck_id == models.Deck.id).filter(models.Deck.user_id == u.id).scalar() or 0
        decks_count = db.query(func.count(models.Deck.id)).filter(models.Deck.user_id == u.id).scalar() or 0
        mangas_count = db.query(func.count(models.Manga.id)).filter(models.Manga.user_id == u.id).scalar() or 0
        results.append(UserSummary(
            id=u.id,
            email=u.email,
            is_admin=bool(getattr(u, "is_admin", False)),
            is_premium=bool(getattr(u, "is_premium", False)),
            created_at=u.created_at,
            flashcards_count=cards_count,
            decks_count=decks_count,
            mangas_count=mangas_count
        ))
    return results

@router.post("/users", response_model=UserSummary, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un compte avec cet email existe déjà."
        )
    
    hashed_pwd = security.get_password_hash(payload.password)
    new_user = models.User(
        email=payload.email,
        hashed_password=hashed_pwd,
        is_admin=payload.is_admin,
        is_premium=payload.is_premium
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info("L'administrateur %s a créé le compte : %s (admin=%s, premium=%s)",
                admin.email, new_user.email, new_user.is_admin, new_user.is_premium)

    return UserSummary(
        id=new_user.id,
        email=new_user.email,
        is_admin=bool(new_user.is_admin),
        is_premium=bool(new_user.is_premium),
        created_at=new_user.created_at,
        flashcards_count=0,
        decks_count=0,
        mangas_count=0
    )

@router.patch("/users/{user_id}/premium", response_model=UserSummary)
def toggle_user_premium(
    user_id: int,
    payload: AdminUserUpdatePremium,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    
    target.is_premium = payload.is_premium
    db.commit()
    db.refresh(target)

    logger.info("Admin %s a modifié le statut premium de %s -> %s", admin.email, target.email, target.is_premium)

    cards_count = db.query(func.count(models.Flashcard.id)).join(models.Deck, models.Flashcard.deck_id == models.Deck.id).filter(models.Deck.user_id == target.id).scalar() or 0
    decks_count = db.query(func.count(models.Deck.id)).filter(models.Deck.user_id == target.id).scalar() or 0
    mangas_count = db.query(func.count(models.Manga.id)).filter(models.Manga.user_id == target.id).scalar() or 0

    return UserSummary(
        id=target.id,
        email=target.email,
        is_admin=bool(target.is_admin),
        is_premium=bool(target.is_premium),
        created_at=target.created_at,
        flashcards_count=cards_count,
        decks_count=decks_count,
        mangas_count=mangas_count
    )

@router.patch("/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    payload: AdminUserResetPassword,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    
    if len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 4 caractères.")

    target.hashed_password = security.get_password_hash(payload.new_password)
    db.commit()

    logger.info("Admin %s a réinitialisé le mot de passe de %s", admin.email, target.email)
    return {"message": f"Mot de passe réinitialisé avec succès pour {target.email}"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte administrateur.")
    
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    
    user_email = target.email
    db.delete(target)
    db.commit()

    logger.info("Admin %s a supprimé l'utilisateur %s (id=%d)", admin.email, user_email, user_id)
    return {"message": f"Utilisateur {user_email} supprimé avec succès."}
