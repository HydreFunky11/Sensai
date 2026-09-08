from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import tempfile
import zipfile
import sqlite3
import os
import re
import json
import uuid
import genanki
from db.database import get_db
from db import models
from api.deps import get_current_user
from sqlalchemy.sql import func

router = APIRouter(prefix="/cards", tags=["cards"])

AUDIO_DIR = "uploads/audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

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
    audio_path: Optional[str] = None

    class Config:
        orm_mode = True

class ReviewSubmit(BaseModel):
    quality: int # 1: Again (Je sais plus), 2: Hard (Un peu), 3: Good (Je sais), 4: Easy (Trop facile)

class LearnedCharacterToggle(BaseModel):
    character: str
    alphabet_type: str # 'hiragana', 'katakana', 'kanji'

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
    if not current_user.is_premium:
        deck_count = db.query(models.Deck).filter(models.Deck.user_id == current_user.id).count()
        if deck_count >= 5:
            raise HTTPException(
                status_code=403,
                detail="Limite de 5 dossiers de révision atteinte pour les comptes gratuits. Passez à SensAI Premium pour un nombre illimité !"
            )
    
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

@router.get("/decks/{deck_id}/export-anki")
def export_deck_anki(
    deck_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Exporte un deck SensAI au format Anki (.apkg)"""
    deck = db.query(models.Deck).filter(models.Deck.id == deck_id, models.Deck.user_id == current_user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Dossier non trouvé")
    
    cards = db.query(models.Flashcard).filter(models.Flashcard.deck_id == deck_id).all()
    if not cards:
        raise HTTPException(status_code=400, detail="Ce dossier ne contient aucune fiche à exporter")

    # Modèle Anki personnalisé SensAI
    model = genanki.Model(
        1607392319,
        'SensAI Model',
        fields=[
            {'name': 'Expression'},
            {'name': 'Reading'},
            {'name': 'Meaning'},
            {'name': 'Context'},
            {'name': 'Breakdown'}
        ],
        templates=[
            {
                'name': 'SensAI Card',
                'qfmt': '<div class="card"><div class="japanese">{{Expression}}</div></div>',
                'afmt': '''{{FrontSide}}
<hr id="answer">
<div class="reading">{{Reading}}</div>
<div class="meaning">{{Meaning}}</div>
{{#Context}}<div class="context">{{Context}}</div>{{/Context}}
{{#Breakdown}}<div class="breakdown">{{Breakdown}}</div>{{/Breakdown}}''',
            },
        ],
        css='''
        .card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; color: #0f172a; background-color: #ffffff; padding: 24px; border-radius: 12px; }
        .japanese { font-size: 32px; font-weight: bold; margin-bottom: 12px; color: #1e293b; }
        .reading { font-size: 20px; color: #6366f1; font-weight: 500; margin-bottom: 8px; }
        .meaning { font-size: 18px; color: #334155; margin-bottom: 12px; }
        .context { font-size: 14px; color: #64748b; font-style: italic; margin-top: 10px; padding: 6px 12px; background: #f1f5f9; border-radius: 6px; display: inline-block; }
        .breakdown { font-size: 13px; color: #475569; margin-top: 10px; text-align: left; }
        '''
    )

    genanki_deck_id = 1000000000 + (deck.id % 900000000)
    anki_deck = genanki.Deck(genanki_deck_id, f"SensAI::{deck.title}")
    media_files = []

    for card in cards:
        breakdown_str = ""
        if card.breakdown and isinstance(card.breakdown, list):
            items = []
            for item in card.breakdown:
                if isinstance(item, dict):
                    word = item.get("word") or item.get("kanji") or ""
                    reading = item.get("reading") or item.get("kana") or ""
                    meaning = item.get("meaning") or item.get("translation") or ""
                    part = item.get("type") or ""
                    items.append(f"<b>{word}</b> [{reading}] : {meaning} {f'<i>({part})</i>' if part else ''}")
                elif isinstance(item, str):
                    items.append(item)
            if items:
                breakdown_str = "<ul style='text-align: left; padding-left: 20px;'>" + "".join(f"<li>{it}</li>" for it in items) + "</ul>"

        # Vérifier si la carte possède un fichier audio à inclure dans le paquet Anki
        reading_field = card.romaji or ""
        if card.audio_path and os.path.exists(card.audio_path):
            media_files.append(card.audio_path)
            audio_base = os.path.basename(card.audio_path)
            reading_field = f"{reading_field} [sound:{audio_base}]".strip()

        note = genanki.Note(
            model=model,
            fields=[
                card.text_source or "",
                reading_field,
                card.translation or "",
                card.context_note or "",
                breakdown_str
            ]
        )
        anki_deck.add_note(note)

    tmp_file = tempfile.NamedTemporaryFile(suffix=".apkg", delete=False)
    tmp_path = tmp_file.name
    tmp_file.close()

    package = genanki.Package(anki_deck)
    if media_files:
        package.media_files = media_files
    package.write_to_file(tmp_path)
    background_tasks.add_task(os.remove, tmp_path)

    safe_title = re.sub(r'[^\w\s-]', '', deck.title).strip().replace(' ', '_') or "deck"
    filename = f"{safe_title}.apkg"

    return FileResponse(
        path=tmp_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.post("/decks/import-anki", response_model=DeckResponse)
async def import_deck_anki(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Importe un fichier de deck Anki (.apkg avec audio ou .tsv/.txt/.csv)"""
    if not current_user.is_premium:
        deck_count = db.query(models.Deck).filter(models.Deck.user_id == current_user.id).count()
        if deck_count >= 5:
            raise HTTPException(
                status_code=403,
                detail="Limite de 5 dossiers de révision atteinte pour les comptes gratuits. Passez à SensAI Premium pour un nombre illimité !"
            )

    filename = file.filename or "deck_importe"
    deck_name = title.strip() if title and title.strip() else os.path.splitext(filename)[0]
    deck_name = deck_name.replace('_', ' ').strip() or "Deck Importé"

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Fichier vide")

    cards_to_create = []

    if filename.lower().endswith(".apkg") or contents[:2] == b'PK':
        try:
            with tempfile.TemporaryDirectory() as extract_dir:
                zip_path = os.path.join(extract_dir, "archive.zip")
                with open(zip_path, "wb") as f:
                    f.write(contents)

                with zipfile.ZipFile(zip_path, 'r') as z:
                    z.extractall(extract_dir)

                db_file = os.path.join(extract_dir, 'collection.anki2')
                if not os.path.exists(db_file):
                    db_file = os.path.join(extract_dir, 'collection.anki21')

                if not os.path.exists(db_file):
                    raise HTTPException(status_code=400, detail="Format APKG invalide : base de données Anki introuvable")

                # Récupérer la table de correspondance des médias (media JSON)
                media_map = {}
                media_file_path = os.path.join(extract_dir, 'media')
                if os.path.exists(media_file_path):
                    try:
                        with open(media_file_path, 'r', encoding='utf-8', errors='ignore') as mf:
                            media_map = json.load(mf)
                    except Exception:
                        pass
                
                # Inversion: nom réel de fichier -> nom de fichier zip ("0", "1", etc.)
                rev_media = {str(v): str(k) for k, v in media_map.items()}

                conn = sqlite3.connect(db_file)
                c = conn.cursor()
                c.execute('SELECT flds FROM notes')
                rows = c.fetchall()
                conn.close()

                for row in rows:
                    if not row or not row[0]:
                        continue
                    raw_flds = row[0].split('\x1f')
                    
                    # 1. Détection et extraction des fichiers audio
                    card_audio_path = None
                    for rf in raw_flds:
                        sound_tags = re.findall(r'\[sound:([^\]]+)\]', rf) + re.findall(r'<audio[^>]*src=["\']?([^"\'>\s]+)["\']?', rf)
                        for sref in sound_tags:
                            zip_entry = rev_media.get(sref, sref)
                            entry_path = os.path.join(extract_dir, zip_entry)
                            if not os.path.exists(entry_path):
                                entry_path = os.path.join(extract_dir, sref)

                            if os.path.exists(entry_path) and os.path.isfile(entry_path):
                                try:
                                    safe_sref = re.sub(r'[^\w\.-]', '_', sref)
                                    saved_filename = f"{uuid.uuid4().hex}_{safe_sref}"
                                    dest_path = os.path.join(AUDIO_DIR, saved_filename)
                                    with open(entry_path, "rb") as sf, open(dest_path, "wb") as df:
                                        df.write(sf.read())
                                    card_audio_path = dest_path
                                    break
                                except Exception as ex:
                                    print(f"Erreur enregistrement audio {sref}: {ex}")
                        if card_audio_path:
                            break

                    # 2. Nettoyage du texte des balises audio et HTML
                    clean_flds = [re.sub(r'\[sound:[^\]]+\]', '', f) for f in raw_flds]
                    clean_flds = [re.sub(r'<[^>]+>', '', f).strip() for f in clean_flds]
                    if not clean_flds or not clean_flds[0]:
                        continue

                    text_source = clean_flds[0]
                    romaji = clean_flds[1] if len(clean_flds) > 1 and len(clean_flds[1]) < 80 else None
                    translation = clean_flds[2] if len(clean_flds) > 2 else (clean_flds[1] if len(clean_flds) > 1 else text_source)
                    context_note = clean_flds[3] if len(clean_flds) > 3 else "Importé depuis Anki"

                    cards_to_create.append({
                        "text_source": text_source,
                        "translation": translation or text_source,
                        "romaji": romaji,
                        "context_note": context_note,
                        "audio_path": card_audio_path
                    })
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Fichier .apkg corrompu ou invalide")
    else:
        try:
            text = contents.decode("utf-8-sig", errors="replace")
            lines = text.splitlines()
            for line in lines:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "\t" in line:
                    parts = line.split("\t")
                elif ";" in line:
                    parts = line.split(";")
                else:
                    parts = line.split(",")

                clean_parts = [re.sub(r'\[sound:[^\]]+\]', '', p) for p in parts]
                clean_parts = [re.sub(r'<[^>]+>', '', p).strip() for p in clean_parts]
                if not clean_parts or not clean_parts[0]:
                    continue

                text_source = clean_parts[0]
                translation = clean_parts[1] if len(clean_parts) > 1 else text_source
                romaji = clean_parts[2] if len(clean_parts) > 2 else None
                context_note = clean_parts[3] if len(clean_parts) > 3 else "Importé depuis Anki"

                cards_to_create.append({
                    "text_source": text_source,
                    "translation": translation,
                    "romaji": romaji,
                    "context_note": context_note,
                    "audio_path": None
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erreur de lecture du fichier texte: {str(e)}")

    if not cards_to_create:
        raise HTTPException(status_code=400, detail="Aucune carte valide n'a pu être extraite du fichier")

    if not current_user.is_premium and len(cards_to_create) > 15:
        cards_to_create = cards_to_create[:15]

    db_deck = models.Deck(
        user_id=current_user.id,
        title=deck_name,
        description=f"Importé le {datetime.now().strftime('%d/%m/%Y')} ({len(cards_to_create)} cartes)"
    )
    db.add(db_deck)
    db.commit()
    db.refresh(db_deck)

    for c_data in cards_to_create:
        fc = models.Flashcard(
            deck_id=db_deck.id,
            text_source=c_data["text_source"],
            translation=c_data["translation"],
            romaji=c_data.get("romaji"),
            context_note=c_data.get("context_note"),
            audio_path=c_data.get("audio_path")
        )
        db.add(fc)
        db.commit()
        db.refresh(fc)
        rs = models.ReviewStats(flashcard_id=fc.id)
        db.add(rs)

    db.commit()
    return db_deck

@router.get("/{card_id}/audio")
def get_card_audio(card_id: int, db: Session = Depends(get_db)):
    """Récupère le fichier audio natif associé à une flashcard"""
    card = db.query(models.Flashcard).filter(models.Flashcard.id == card_id).first()
    if not card or not card.audio_path:
        raise HTTPException(status_code=404, detail="Fichier audio non associé à cette carte")
    if not os.path.exists(card.audio_path):
        raise HTTPException(status_code=404, detail="Fichier audio introuvable sur le disque")

    ext = os.path.splitext(card.audio_path)[1].lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".opus": "audio/opus"
    }
    media_type = media_types.get(ext, "audio/mpeg")
    return FileResponse(path=card.audio_path, media_type=media_type)

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

    if not current_user.is_premium:
        card_count = db.query(models.Flashcard).filter(models.Flashcard.deck_id == deck.id).count()
        if card_count >= 15:
            raise HTTPException(
                status_code=403,
                detail="Limite de 15 fiches par dossier atteinte pour les comptes gratuits. Passez à SensAI Premium pour un nombre illimité !"
            )

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
    
    # Statistiques des alphabets appris
    learned_counts = db.query(
        models.LearnedCharacter.alphabet_type,
        func.count(models.LearnedCharacter.id)
    ).filter(
        models.LearnedCharacter.user_id == current_user.id
    ).group_by(
        models.LearnedCharacter.alphabet_type
    ).all()
    
    # Hiragana total: 46, Katakana total: 46, Kanji N5 total: 36
    totals = {
        "hiragana": 46,
        "katakana": 46,
        "kanji": 36
    }
    
    learned_stats = {
        "hiragana": {"count": 0, "total": 46, "percentage": 0.0},
        "katakana": {"count": 0, "total": 46, "percentage": 0.0},
        "kanji": {"count": 0, "total": 36, "percentage": 0.0}
    }
    
    for alphabet, count in learned_counts:
        if alphabet in learned_stats:
            learned_stats[alphabet]["count"] = count
            tot = totals[alphabet]
            learned_stats[alphabet]["percentage"] = round((count / tot) * 100, 1) if tot > 0 else 0.0

    return {
        "weekly": last_12_weeks,
        "buttons_month": buttons_current_month,
        "daily": daily_reviews,
        "learned_alphabets": learned_stats
    }

@router.post("/learned/toggle")
def toggle_learned_character(
    data: LearnedCharacterToggle,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Marque ou démarque un caractère comme connu/appris"""
    learned = db.query(models.LearnedCharacter).filter(
        models.LearnedCharacter.user_id == current_user.id,
        models.LearnedCharacter.character == data.character
    ).first()
    
    if learned:
        db.delete(learned)
        db.commit()
        return {"status": "removed", "character": data.character}
    else:
        new_learned = models.LearnedCharacter(
            user_id=current_user.id,
            character=data.character,
            alphabet_type=data.alphabet_type
        )
        db.add(new_learned)
        db.commit()
        return {"status": "added", "character": data.character}

@router.get("/learned")
def get_learned_characters(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Récupère la liste de tous les caractères appris par l'utilisateur"""
    learned = db.query(models.LearnedCharacter).filter(
        models.LearnedCharacter.user_id == current_user.id
    ).all()
    return [l.character for l in learned]
