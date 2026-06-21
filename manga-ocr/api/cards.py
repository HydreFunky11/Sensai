from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from db.database import get_db
from db import models
from api.deps import get_current_user
from sqlalchemy.sql import func

router = APIRouter(prefix="/cards", tags=["cards"])

# --- SCHEMAS ---

class DeckCreate(BaseModel):
    title: str
    description: Optional[str] = None

class DeckResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None

    class Config:
        orm_mode = True

class FlashcardCreate(BaseModel):
    deck_id: Optional[int] = None
    text_source: str
    translation: str
    romaji: Optional[str] = None
    breakdown: Optional[list] = None
    context_note: Optional[str] = None

class FlashcardResponse(BaseModel):
    id: int
    deck_id: int
    text_source: str
    translation: str
    romaji: Optional[str] = None
    breakdown: Optional[list] = None
    context_note: Optional[str] = None

    class Config:
        orm_mode = True

class ReviewSubmit(BaseModel):
    quality: int # 1: Again (Je sais plus), 2: Hard (Un peu), 3: Good (Je sais), 4: Easy (Trop facile)

# --- ROUTES DECKS ---

@router.get("/decks", response_model=List[DeckResponse])
def get_decks(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    decks = db.query(models.Deck).filter(models.Deck.user_id == current_user.id).all()
    # Créer le deck par défaut si aucun n'existe
    if not decks:
        deck = models.Deck(user_id=current_user.id, title="Dossier Principal")
        db.add(deck)
        db.commit()
        db.refresh(deck)
        decks = [deck]
    return decks

@router.post("/decks", response_model=DeckResponse)
def create_deck(deck: DeckCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_deck = models.Deck(user_id=current_user.id, title=deck.title, description=deck.description)
    db.add(db_deck)
    db.commit()
    db.refresh(db_deck)
    return db_deck

class DeckRename(BaseModel):
    title: str

@router.put("/decks/{deck_id}", response_model=DeckResponse)
def rename_deck(deck_id: int, deck_data: DeckRename, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id, models.Deck.user_id == current_user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
    deck.title = deck_data.title
    db.commit()
    db.refresh(deck)
    return deck

@router.delete("/decks/{deck_id}")
def delete_deck(deck_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id, models.Deck.user_id == current_user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
    
    # Supprimer les statistiques puis les cartes puis le deck
    cards = db.query(models.Flashcard).filter(models.Flashcard.deck_id == deck_id).all()
    card_ids = [c.id for c in cards]
    if card_ids:
        db.query(models.ReviewStats).filter(models.ReviewStats.flashcard_id.in_(card_ids)).delete(synchronize_session=False)
        db.query(models.Flashcard).filter(models.Flashcard.deck_id == deck_id).delete(synchronize_session=False)
    db.delete(deck)
    db.commit()
    return {"message": "Dossier supprimé avec succès"}

@router.delete("/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    card = db.query(models.Flashcard).join(models.Deck).filter(
        models.Flashcard.id == card_id,
        models.Deck.user_id == current_user.id
    ).first()
    if not card:
        raise HTTPException(status_code=404, detail="Carte non trouvée")
        
    db.query(models.ReviewStats).filter(models.ReviewStats.flashcard_id == card_id).delete()
    db.delete(card)
    db.commit()
    return {"message": "Carte supprimée avec succès"}

# --- ROUTES CARDS ---

@router.post("/", response_model=FlashcardResponse)
def create_card(card: FlashcardCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if card.deck_id:
        deck = db.query(models.Deck).filter(models.Deck.id == card.deck_id, models.Deck.user_id == current_user.id).first()
        if not deck:
            raise HTTPException(status_code=404, detail="Dossier non trouvé")
    else:
        deck = db.query(models.Deck).filter(models.Deck.user_id == current_user.id).first()
        if not deck:
            deck = models.Deck(user_id=current_user.id, title="Dossier Principal")
            db.add(deck)
            db.commit()
            db.refresh(deck)

    db_card = models.Flashcard(
        deck_id=deck.id,
        text_source=card.text_source,
        translation=card.translation,
        romaji=card.romaji,
        breakdown=card.breakdown,
        context_note=card.context_note
    )
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    
    review_stats = models.ReviewStats(flashcard_id=db_card.id)
    db.add(review_stats)
    db.commit()
    
    return db_card

@router.get("/", response_model=List[FlashcardResponse])
def get_cards(deck_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Flashcard).join(models.Deck).filter(models.Deck.user_id == current_user.id)
    if deck_id:
        query = query.filter(models.Flashcard.deck_id == deck_id)
    return query.all()

@router.get("/study", response_model=List[FlashcardResponse])
def get_due_cards(deck_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Récupère les cartes à réviser aujourd'hui"""
    query = db.query(models.Flashcard).join(models.Deck).join(models.ReviewStats).filter(
        models.Deck.user_id == current_user.id,
        models.ReviewStats.next_review_date <= func.now()
    )
    if deck_id:
        query = query.filter(models.Flashcard.deck_id == deck_id)
    return query.all()

@router.post("/{card_id}/review")
def submit_review(card_id: int, review: ReviewSubmit, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Soumet un score de révision (SM-2 Algorithm)"""
    card = db.query(models.Flashcard).join(models.Deck).filter(
        models.Flashcard.id == card_id, 
        models.Deck.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    stats = db.query(models.ReviewStats).filter(models.ReviewStats.flashcard_id == card_id).first()
    
    q = review.quality
    if q < 1 or q > 4:
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 4")

    if q == 1:
        stats.interval = 0
        stats.ease_factor = max(1.3, stats.ease_factor - 0.2)
    elif q == 2:
        stats.interval = max(1, int(stats.interval * 1.2))
        stats.ease_factor = max(1.3, stats.ease_factor - 0.15)
    elif q == 3:
        if stats.interval == 0: stats.interval = 1
        elif stats.interval == 1: stats.interval = 6
        else: stats.interval = round(stats.interval * stats.ease_factor)
    elif q == 4:
        if stats.interval == 0: stats.interval = 1
        elif stats.interval == 1: stats.interval = 6
        else: stats.interval = round(stats.interval * stats.ease_factor * 1.3)
        stats.ease_factor += 0.15

    if stats.interval == 0:
        stats.next_review_date = datetime.now() + timedelta(minutes=10)
    else:
        stats.next_review_date = datetime.now() + timedelta(days=stats.interval)

    # Enregistrer dans l'historique des révisions pour les statistiques
    log_entry = models.ReviewLog(
        user_id=current_user.id,
        flashcard_id=card_id,
        quality=q
    )
    db.add(log_entry)

    db.commit()
    return {"message": "Review saved", "next_review": stats.next_review_date}

@router.post("/decks/{deck_id}/complete")
def log_deck_completion(
    deck_id: int, 
    is_free_review: bool = False, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Enregistre la complétion d'une session de révision de dossier"""
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id, models.Deck.user_id == current_user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
        
    log_entry = models.DeckReviewLog(
        user_id=current_user.id,
        deck_id=deck_id,
        is_free_review=is_free_review
    )
    db.add(log_entry)
    db.commit()
    return {"message": "Complétion du dossier enregistrée"}

@router.get("/stats")
def get_review_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Récupère les statistiques de révision (par dossier fini) et d'autoévaluation"""
    deck_logs = db.query(models.DeckReviewLog).filter(models.DeckReviewLog.user_id == current_user.id).all()
    card_logs = db.query(models.ReviewLog).filter(models.ReviewLog.user_id == current_user.id).all()
    
    reviews_per_week = {}
    daily_reviews = {}
    
    # Agrégation par dossier révisé (DeckReviewLog)
    for log in deck_logs:
        # Date de révision locale
        date_str = log.reviewed_at.strftime("%Y-%m-%d")
        daily_reviews[date_str] = daily_reviews.get(date_str, 0) + 1
        
        # Par semaine de l'année (ex: 2026-W25)
        iso_year, iso_week, _ = log.reviewed_at.isocalendar()
        week_key = f"{iso_year}-W{iso_week:02d}"
        reviews_per_week[week_key] = reviews_per_week.get(week_key, 0) + 1

    # Boutons d'autoévaluation mois en cours (ReviewLog)
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    buttons_current_month = {1: 0, 2: 0, 3: 0, 4: 0}
    
    for log in card_logs:
        log_date = log.reviewed_at.replace(tzinfo=None)
        if log_date >= start_of_month:
            if log.quality in buttons_current_month:
                buttons_current_month[log.quality] += 1
                
    # Trier les semaines chronologiquement et limiter aux 12 dernières
    sorted_weeks = dict(sorted(reviews_per_week.items()))
    last_12_weeks = dict(list(sorted_weeks.items())[-12:])
    
    return {
        "weekly": last_12_weeks,
        "buttons_month": buttons_current_month,
        "daily": daily_reviews
    }
