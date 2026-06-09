import os
import shutil
import base64
from io import BytesIO
from PIL import Image
import fitz  # PyMuPDF
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from db.database import get_db
from db import models
from api.deps import get_current_user
import uuid

router = APIRouter(prefix="/library", tags=["library"])

UPLOAD_DIR = "uploads/library"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class FolderCreate(BaseModel):
    name: str

class FolderRename(BaseModel):
    name: str

class FolderResponse(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True

class MangaResponse(BaseModel):
    id: int
    folder_id: Optional[int] = None
    title: str
    file_path: str
    cover_image: str | None = None

    class Config:
        orm_mode = True

class MangaUpdateFolder(BaseModel):
    folder_id: Optional[int] = None

class MangaRename(BaseModel):
    title: str

def generate_b64_thumbnail(file_path: str, ext: str) -> str | None:
    try:
        img = None
        if ext.lower() == 'pdf':
            doc = fitz.open(file_path)
            if len(doc) > 0:
                page = doc.load_page(0)
                pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        elif ext.lower() in ['jpg', 'jpeg', 'png', 'webp']:
            img = Image.open(file_path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
        
        if img:
            img.thumbnail((300, 450))
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=80)
            img_str = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        print(f"Erreur génération miniature: {e}")
    return None

@router.get("/folders", response_model=List[FolderResponse])
def get_folders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.MangaFolder).filter(models.MangaFolder.user_id == current_user.id).all()

@router.post("/folders", response_model=FolderResponse)
def create_folder(folder: FolderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_folder = models.MangaFolder(user_id=current_user.id, name=folder.name)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@router.put("/folders/{folder_id}", response_model=FolderResponse)
def rename_folder(folder_id: int, folder_data: FolderRename, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    folder = db.query(models.MangaFolder).filter(models.MangaFolder.id == folder_id, models.MangaFolder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Dossier introuvable")
    
    folder.name = folder_data.name
    db.commit()
    db.refresh(folder)
    return folder

@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    folder = db.query(models.MangaFolder).filter(models.MangaFolder.id == folder_id, models.MangaFolder.user_id == current_user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # Récupérer tous les mangas dans ce dossier pour supprimer les fichiers physiques
    mangas_in_folder = db.query(models.Manga).filter(models.Manga.folder_id == folder_id).all()
    for manga in mangas_in_folder:
        if manga.file_path and os.path.exists(manga.file_path):
            try:
                os.remove(manga.file_path)
            except Exception as e:
                print(f"Erreur lors de la suppression du fichier {manga.file_path} : {e}")
        # La suppression des entrées mangas se fera via le cascade SQLAlchemy ou manuellement
        db.delete(manga)
    
    db.delete(folder)
    db.commit()
    return {"message": "Dossier et son contenu supprimés avec succès"}

@router.post("/import", response_model=MangaResponse)
async def import_manga(file: UploadFile = File(...), folder_id: Optional[int] = Form(None), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ext = file.filename.split('.')[-1] if '.' in file.filename else ''
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    title = file.filename.rsplit('.', 1)[0]
    
    # Génération de la miniature
    cover_b64 = generate_b64_thumbnail(file_path, ext)
    
    if folder_id:
        # Verify folder ownership
        folder = db.query(models.MangaFolder).filter(models.MangaFolder.id == folder_id, models.MangaFolder.user_id == current_user.id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Dossier introuvable")

    db_manga = models.Manga(
        user_id=current_user.id,
        folder_id=folder_id,
        title=title,
        file_path=file_path,
        cover_image=cover_b64
    )
    db.add(db_manga)
    db.commit()
    db.refresh(db_manga)

    return db_manga

@router.put("/{manga_id}/folder", response_model=MangaResponse)
def update_manga_folder(manga_id: int, update_data: MangaUpdateFolder, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    manga = db.query(models.Manga).filter(models.Manga.id == manga_id, models.Manga.user_id == current_user.id).first()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
        
    if update_data.folder_id is not None:
        folder = db.query(models.MangaFolder).filter(models.MangaFolder.id == update_data.folder_id, models.MangaFolder.user_id == current_user.id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Dossier introuvable")
            
    manga.folder_id = update_data.folder_id
    db.commit()
    db.refresh(manga)
    return manga

@router.get("/", response_model=List[MangaResponse])
def get_library(folder_id: Optional[int] = None, sort_by: str = "date", order: str = "desc", db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Manga).filter(models.Manga.user_id == current_user.id)
    if folder_id is not None:
        if folder_id == 0:
             query = query.filter(models.Manga.folder_id == None)
        else:
             query = query.filter(models.Manga.folder_id == folder_id)
             
    if sort_by == "name":
        if order == "asc":
            query = query.order_by(models.Manga.title.asc())
        else:
            query = query.order_by(models.Manga.title.desc())
    else: # date
        if order == "asc":
            query = query.order_by(models.Manga.id.asc())
        else:
            query = query.order_by(models.Manga.id.desc())
            
    return query.all()

@router.get("/{manga_id}/file")
def get_manga_file(manga_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    manga = db.query(models.Manga).filter(models.Manga.id == manga_id, models.Manga.user_id == current_user.id).first()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    
    if not os.path.exists(manga.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
        
    return FileResponse(manga.file_path)

@router.put("/{manga_id}/rename", response_model=MangaResponse)
def rename_manga(manga_id: int, rename_data: MangaRename, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    manga = db.query(models.Manga).filter(models.Manga.id == manga_id, models.Manga.user_id == current_user.id).first()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
        
    manga.title = rename_data.title
    db.commit()
    db.refresh(manga)
    return manga

@router.delete("/{manga_id}")
def delete_manga(manga_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    manga = db.query(models.Manga).filter(models.Manga.id == manga_id, models.Manga.user_id == current_user.id).first()
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    
    # Supprimer le fichier physique
    if manga.file_path and os.path.exists(manga.file_path):
        try:
            os.remove(manga.file_path)
        except Exception as e:
            print(f"Erreur lors de la suppression du fichier physique : {e}")

    db.delete(manga)
    db.commit()
    return {"message": "Manga supprimé avec succès"}
