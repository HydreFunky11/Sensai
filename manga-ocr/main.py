from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as general_router
from api.auth import router as auth_router
from api.cards import router as cards_router
from api.library import router as library_router
from api.payments import router as payments_router
from db.database import engine
from db import models

# Création des tables dans la base de données
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SensAI API")

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
