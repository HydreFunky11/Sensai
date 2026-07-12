import time
from fastapi import HTTPException, Request, status
from collections import defaultdict

class InMemoryRateLimiter:
    def __init__(self, requests_limit: int = 60, window_seconds: int = 60):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # Associe chaque adresse IP à sa liste de timestamps de requêtes
        self.requests = defaultdict(list)

    async def __call__(self, request: Request):
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Nettoyer les requêtes hors de la fenêtre de temps glissante
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if current_time - t < self.window_seconds
        ]
        
        # Vérifier si la limite a été dépassée
        if len(self.requests[client_ip]) >= self.requests_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Trop de requêtes. Veuillez réessayer plus tard (Rate limit dépassé)."
            )
            
        # Enregistrer la requête actuelle
        self.requests[client_ip].append(current_time)

# 1. Limite globale standard : 100 requêtes / minute (pour l'utilisation courante de l'app)
limiter_general = InMemoryRateLimiter(requests_limit=100, window_seconds=60)

# 2. Limite stricte : 10 requêtes / minute (pour l'authentification et l'OCR/IA pour éviter le bruteforce et la ruine de quotas)
limiter_strict = InMemoryRateLimiter(requests_limit=10, window_seconds=60)
