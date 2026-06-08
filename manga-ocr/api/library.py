import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from db.database import get_db
from db import models
from api.deps import get_current_user
import uuid

router = APIRouter(prefix="/library", tags=["library"])

UPLOAD_DIR = "uploads/library"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class MangaResponse(BaseModel):
    id: int
    title: str
    file_path: str
    cover_image: str | None = None

    class Config:
        orm_mode = True

@router.post("/import", response_model=MangaResponse)
async def import_manga(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ext = file.filename.split('.')[-1] if '.' in file.filename else ''
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    title = file.filename.rsplit('.', 1)[0]
    
    db_manga = models.Manga(
        user_id=current_user.id,
        title=title,
        file_path=file_path,
        cover_image=None
    )
    db.add(db_manga)
    db.commit()
    db.refresh(db_manga)

    return db_manga

@router.get("/", response_model=List[MangaResponse])
def get_library(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    mangas = db.query(models.Manga).filter(models.Manga.user_id == current_user.id).all()
    return mangas

@router.get("/{manga_id}/file")
def get_manga_file(manga_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    manga = db.query(models.Manga).filter(models.Manga.id == manga_id, models.Manga.user_id == current_user.id).first()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    
    if not os.path.exists(manga.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(manga.file_path)
