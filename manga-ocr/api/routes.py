from fastapi import APIRouter, File, UploadFile, Response
from services.ocr_service import ocr_service
from services.llm_service import llm_service
from services.tts_service import tts_service
from core.config import DEFAULT_VOICE

router = APIRouter()

@router.post("/analyze")
async def analyze_manga(file: UploadFile = File(...), lang: str = "auto"):
    # 1. OCR
    try:
        image_data = await file.read()
        text_source = ocr_service.recognize_text(image_data, lang=lang)
        print(f"👁️ Lu ({lang}) : {text_source}")
    except Exception as e:
        return {"error": "Problème d'analyse", "details": str(e)}

    # 2. Analyse LLM
    analysis = llm_service.analyze_text(text_source, lang=lang)
    return analysis

@router.get("/tts")
async def text_to_speech(text: str, voice: str = DEFAULT_VOICE):
    try:
        audio_data = await tts_service.generate_audio(text, voice)
        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        return {"error": str(e)}
