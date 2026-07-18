import os
import pytest
import logging

def test_logging_file_created():
    # S'assurer que le fichier log existe bien à l'emplacement configuré
    from core.logging_config import LOG_FILE
    assert os.path.exists(LOG_FILE)
    
    # Vérifier que le fichier est exploitable
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
        assert len(content) >= 0

def test_global_exception_handler(client):
    from fastapi.testclient import TestClient
    
    # Enregistrer dynamiquement une route qui lève une exception non gérée sur l'application FastAPI de test
    app = client.app
    
    @app.get("/trigger-dummy-500-error")
    def trigger_error():
        raise RuntimeError("Problème de test critique provoqué !")

    # Créer un client de test avec raise_server_exceptions=False pour tester le handler d'exceptions de FastAPI
    local_client = TestClient(app, raise_server_exceptions=False)

    # Appeler la route d'erreur de test
    response = local_client.get("/trigger-dummy-500-error")
    
    # 1. Vérifier que l'utilisateur reçoit un code HTTP 500 avec un message d'erreur anonymisé (Sécurité OWASP)
    assert response.status_code == 500
    data = response.json()
    assert "detail" in data
    assert "erreur serveur interne" in data["detail"].lower()
    assert "RuntimeError" not in data["detail"] # Pas de fuite de types d'erreurs internes

    # 2. Vérifier que la vraie stack trace de l'erreur est consignée dans le fichier journal confidentiel
    from core.logging_config import LOG_FILE
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        logs = f.read()
        assert "trigger-dummy-500-error" in logs
        assert "Problème de test critique provoqué" in logs
