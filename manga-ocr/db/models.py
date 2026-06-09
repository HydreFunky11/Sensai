from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mangas = relationship("Manga", back_populates="owner")
    decks = relationship("Deck", back_populates="owner")

class MangaFolder(Base):
    __tablename__ = "manga_folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)

    owner = relationship("User")
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
    cards = relationship("Flashcard", back_populates="deck")

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
    review_stats = relationship("ReviewStats", back_populates="card", uselist=False)

class ReviewStats(Base):
    __tablename__ = "review_stats"

    id = Column(Integer, primary_key=True, index=True)
    flashcard_id = Column(Integer, ForeignKey("flashcards.id"))
    next_review_date = Column(DateTime(timezone=True), server_default=func.now())
    interval = Column(Integer, default=0) # days
    ease_factor = Column(Float, default=2.5)

    card = relationship("Flashcard", back_populates="review_stats")
