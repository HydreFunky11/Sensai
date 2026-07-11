# Étape 1 : Build & Dépendances
FROM python:3.12-slim AS builder

WORKDIR /app

# Installer les dépendances système requises pour compiler certains paquets (si nécessaire)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier le fichier requirements
COPY requirements.txt .

# Installer les dépendances dans un dossier local pour pouvoir les copier ensuite
RUN pip install --no-cache-dir --user -r requirements.txt
# Installer également les paquets de tests pour pouvoir les exécuter en CI si besoin
RUN pip install --no-cache-dir --user pytest pytest-asyncio

# Étape 2 : Image finale de production
FROM python:3.12-slim

WORKDIR /app

# Installer les dépendances d'exécution pour OpenCV, PyMuPDF et edge-tts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copier les packages python installés depuis l'étape builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copier le reste du code backend
COPY . .

# Exposer le port de FastAPI
EXPOSE 8000

# Lancer FastAPI avec Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
