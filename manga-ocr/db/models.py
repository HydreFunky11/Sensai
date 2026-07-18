from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Stripe payment integrations
    stripe_customer_id = Column(String, unique=True, index=True, nullable=True)
    is_premium = Column(Boolean, default=False)
    subscription_id = Column(String, nullable=True)
    subscription_end_at = Column(DateTime, nullable=True)

    mangas = relationship("Manga", back_populates="owner", cascade="all, delete-orphan")
    decks = relationship("Deck", back_populates="owner", cascade="all, delete-orphan")
    learned_characters = relationship("LearnedCharacter", back_populates="owner", cascade="all, delete-orphan")
    folders = relationship("MangaFolder", back_populates="owner", cascade="all, delete-orphan")

class MangaFolder(Base):
    __tablename__ = "manga_folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)

    owner = relationship("User", back_populates="folders")
    mangas = relationship("Manga", back_populates="folder")

class Manga(Base):
    __tablename__ = "mangas"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # null for demo mangas
    folder_id = Column(Integer, ForeignKey("manga_folders.id"), nullable=True)
    title = Column(String)
    file_path = Column(String)
    cover_image = Column(String, nullable=True)

    owner = relationship("User", back_populates="mangas")
    folder = relationship("MangaFolder", back_populates="mangas")

class Deck(Base):
    __tablename__ = "decks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    description = Column(String, nullable=True)

    owner = relationship("User", back_populates="decks")
    cards = relationship("Flashcard", back_populates="deck", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    deck_id = Column(Integer, ForeignKey("decks.id"))
    text_source = Column(String)
    translation = Column(String)
    romaji = Column(String, nullable=True)
    breakdown = Column(JSON, nullable=True)
    context_note = Column(String, nullable=True)
    image_crop_path = Column(String, nullable=True)

    deck = relationship("Deck", back_populates="cards")
    review_stats = relationship("ReviewStats", back_populates="card", uselist=False, cascade="all, delete-orphan")

class ReviewStats(Base):
    __tablename__ = "review_stats"

    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"))
    next_review_date = Column(DateTime(timezone=True), server_default=func.now())
    interval = Column(Integer, default=0) # days
    ease_factor = Column(Float, default=2.5)

    card = relationship("Flashcard", back_populates="review_stats")

# --- CACHE TABLES ---

class CacheDetection(Base):
    """Cache pour les résultats YOLO (lié au hash de l'image)"""
    __tablename__ = "cache_detection"

    image_hash = Column(String, primary_key=True, index=True)
    boxes = Column(JSON) # Liste des coordonnées des bulles
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CacheTranslation(Base):
    """Cache pour les résultats LLM (lié au texte source)"""
    __tablename__ = "cache_translation"

    text_source = Column(String, primary_key=True, index=True)
    result_json = Column(JSON) # Le résultat complet de Groq (traduction, romaji, breakdown)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CacheTranslationAnalysis(Base):
    """Cache pour les résultats d'analyse et traduction (avec métadonnées document)"""
    __tablename__ = "cache_translation_analysis"

    id = Column(Integer, primary_key=True, index=True)
    crop_hash = Column(String, index=True, nullable=True)
    document_name = Column(String, index=True, nullable=True)
    page = Column(Integer, index=True, nullable=True)
    box_coordinates = Column(JSON, nullable=True)
    text_source = Column(String, index=True)
    result_json = Column(JSON) # Le résultat complet de l'analyse et de la traduction
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ReviewLog(Base):
    """Historique des révisions pour les statistiques"""
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"), index=True)
    quality = Column(Integer)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

class DeckReviewLog(Base):
    """Historique des sessions de révision terminées par dossier"""
    __tablename__ = "deck_review_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    deck_id = Column(Integer, ForeignKey("decks.id"), index=True)
    is_free_review = Column(Boolean, default=False)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

class AnalysisLog(Base):
    """Journal d'utilisation des requêtes d'analyse pour limiter les utilisateurs gratuits"""
    __tablename__ = "analysis_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LearnedCharacter(Base):
    """Caractères japonais appris par l'utilisateur"""
    __tablename__ = "learned_characters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    character = Column(String, index=True)
    alphabet_type = Column(String) # 'hiragana', 'katakana', 'kanji'
    learned_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="learned_characters")
