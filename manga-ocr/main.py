from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from api.routes import router as general_router
from api.auth import router as auth_router
from api.cards import router as cards_router
from api.library import router as library_router
from api.payments import router as payments_router
from db.database import engine
from db import models
from core.rate_limiter import limiter_general
from core.logging_config import setup_logging

# Initialiser le système de journalisation
setup_logging()
logger = logging.getLogger("sensai.main")

# Création des tables dans la base de données
models.Base.metadata.create_all(bind=engine)

# Initialisation de l'API avec la dépendance de rate limiting globale
app = FastAPI(
    title="SensAI API",
    dependencies=[Depends(limiter_general)]
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Enregistrer la stack trace confidentiellement dans le fichier journal
    logger.error("Exception interne non interceptée sur %s : %s", request.url.path, str(exc), exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Une erreur serveur interne est survenue. Veuillez contacter le support technique."}
    )

# Middleware pour forcer les en-têtes HTTP de sécurité (Top 10 OWASP)
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Configuration CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routes
app.include_router(auth_router)
app.include_router(general_router)
app.include_router(cards_router)
app.include_router(library_router)
app.include_router(payments_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
