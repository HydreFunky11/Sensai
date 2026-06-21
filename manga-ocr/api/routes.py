import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, File, UploadFile, Response, Form, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db import models
from services.ocr_service import ocr_service
from services.llm_service import llm_service
from services.tts_service import tts_service
from services.detection_service import detection_service
from core.config import DEFAULT_VOICE
from api.deps import get_current_user

router = APIRouter()

def cleanup_old_cache(db: Session):
    try:
        limit = datetime.utcnow() - timedelta(hours=48)
        # Supprimer les détections de plus de 48h
        db.query(models.CacheDetection).filter(models.CacheDetection.created_at < limit).delete()
        # Supprimer les anciennes traductions (tables simple et enrichie)
        db.query(models.CacheTranslation).filter(models.CacheTranslation.created_at < limit).delete()
        db.query(models.CacheTranslationAnalysis).filter(models.CacheTranslationAnalysis.created_at < limit).delete()
        db.commit()
        print("🧹 Cache nettoyé avec succès (plus de 48h)")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Erreur lors du nettoyage du cache : {e}")

@router.post("/detect")
async def detect_bubbles(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    try:
        # Lancer le nettoyage en arrière-plan
        background_tasks.add_task(cleanup_old_cache, db)
        
        image_data = await file.read()
        
        # Calculer le hash de l'image de la page
        image_hash = hashlib.md5(image_data).hexdigest()
        
        # Vérifier dans le cache
        cached = db.query(models.CacheDetection).filter(models.CacheDetection.image_hash == image_hash).first()
        if cached:
            print("🚀 Détection YOLO récupérée depuis le cache SQLite")
            return {"boxes": cached.boxes}
            
        # Sinon, lancer l'inférence YOLO
        boxes = detection_service.detect_bubbles(image_data)
        
        # Sauvegarder dans le cache
        try:
            db_cache = models.CacheDetection(image_hash=image_hash, boxes=boxes)
            db.add(db_cache)
            db.commit()
        except Exception as cache_err:
            db.rollback()
            print(f"Erreur écriture cache détection: {cache_err}")
            
        return {"boxes": boxes}
    except Exception as e:
        return {"error": str(e)}

@router.post("/analyze")
async def analyze_manga(
    file: UploadFile = File(...),
    lang: str = "ja",
    document_name: Optional[str] = Form(None),
    page: Optional[int] = Form(None),
    box_coordinates: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Lancer le nettoyage en arrière-plan
    background_tasks.add_task(cleanup_old_cache, db)
    
    # Gating : Limite pour les comptes gratuits : 20 requêtes d'analyse par tranche de 6 heures
    if not current_user.is_premium:
        time_limit = datetime.utcnow() - timedelta(hours=6)
        usage_count = db.query(models.AnalysisLog).filter(
            models.AnalysisLog.user_id == current_user.id,
            models.AnalysisLog.created_at >= time_limit
        ).count()
        if usage_count >= 20:
            raise HTTPException(
                status_code=403,
                detail="Limite d'analyse de 20 requêtes par 6 heures atteinte pour les comptes gratuits. Passez à SensAI Premium pour un nombre illimité !"
            )
    
    try:
        image_data = await file.read()
        crop_hash = hashlib.md5(image_data).hexdigest()
        
        # Charger les coordonnées JSON si présentes
        parsed_coords = None
        if box_coordinates:
            try:
                parsed_coords = json.loads(box_coordinates)
            except Exception:
                pass
                
        # 1. Vérification Cache Niveau 1 : Même sélection recadrée (crop_hash)
        cached_analysis = db.query(models.CacheTranslationAnalysis).filter(
            models.CacheTranslationAnalysis.crop_hash == crop_hash
        ).first()
        
        if cached_analysis:
            print("🚀 Analyse/Traduction récupérée depuis le cache Niveau 1 (crop image hash)")
            return cached_analysis.result_json
            
        # 2. OCR (si pas de cache Niveau 1)
        try:
            text_source = ocr_service.recognize_text(image_data, lang=lang)
            print(f"👁️ Lu ({lang}) : {text_source}")
        except Exception as e:
            return {"error": "Problème d'analyse OCR", "details": str(e)}

        if not text_source.strip():
            return {
                "original": "",
                "translation": "Aucun texte détecté",
                "romaji": "",
                "breakdown": [],
                "context_note": ""
            }

        # 3. Vérification Cache Niveau 2 : Même texte source
        # Vérification d'abord dans la table enrichie
        cached_by_text = db.query(models.CacheTranslationAnalysis).filter(
            models.CacheTranslationAnalysis.text_source == text_source
        ).first()
        
        if cached_by_text:
            print("🚀 Traduction récupérée depuis le cache Niveau 2 (texte source)")
            analysis = cached_by_text.result_json
            
            # On crée une nouvelle entrée pour lier ce crop_hash spécifique et les métadonnées de page
            try:
                new_cache_entry = models.CacheTranslationAnalysis(
                    crop_hash=crop_hash,
                    document_name=document_name,
                    page=page,
                    box_coordinates=parsed_coords,
                    text_source=text_source,
                    result_json=analysis
                )
                db.add(new_cache_entry)
                db.commit()
            except Exception as cache_err:
                db.rollback()
                print(f"Erreur écriture cache Niveau 2: {cache_err}")
                
            return analysis
            
        # Vérification de repli dans la table CacheTranslation simple
        cached_translation_simple = db.query(models.CacheTranslation).filter(
            models.CacheTranslation.text_source == text_source
        ).first()
        
        if cached_translation_simple:
            print("🚀 Traduction récupérée depuis le cache simple de repli")
            analysis = cached_translation_simple.result_json
            
            # On enrichit dans la table CacheTranslationAnalysis
            try:
                new_cache_entry = models.CacheTranslationAnalysis(
                    crop_hash=crop_hash,
                    document_name=document_name,
                    page=page,
                    box_coordinates=parsed_coords,
                    text_source=text_source,
                    result_json=analysis
                )
                db.add(new_cache_entry)
                db.commit()
            except Exception as cache_err:
                db.rollback()
                print(f"Erreur écriture cache repli: {cache_err}")
                
            return analysis

        # 4. Inférence LLM (si aucun cache)
        analysis = llm_service.analyze_text(text_source, lang=lang)
        
        # Enregistrer l'utilisation de l'API LLM pour le compte gratuit
        if not current_user.is_premium:
            try:
                log_entry = models.AnalysisLog(user_id=current_user.id)
                db.add(log_entry)
                db.commit()
            except Exception as log_err:
                db.rollback()
                print(f"Erreur enregistrement log utilisation: {log_err}")
        
        # Enregistrer dans les caches
        try:
            # Table simple
            simple_cache = models.CacheTranslation(text_source=text_source, result_json=analysis)
            db.merge(simple_cache) # merge pour écraser ou insérer
            
            # Table enrichie avec document/page/coordonnées
            enriched_cache = models.CacheTranslationAnalysis(
                crop_hash=crop_hash,
                document_name=document_name,
                page=page,
                box_coordinates=parsed_coords,
                text_source=text_source,
                result_json=analysis
            )
            db.add(enriched_cache)
            db.commit()
        except Exception as cache_err:
            db.rollback()
            print(f"Erreur sauvegarde cache final: {cache_err}")
            
        return analysis
    except Exception as e:
        return {"error": "Problème d'analyse", "details": str(e)}

@router.get("/tts")
async def text_to_speech(text: str, voice: str = DEFAULT_VOICE):
    try:
        audio_data = await tts_service.generate_audio(text, voice)
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        return {"error": str(e)}
