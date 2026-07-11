import pytest

def test_register_user(client):
    # Inscription réussie
    response = client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Tentative d'inscription avec le même e-mail
    response_duplicate = client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "otherpassword"}
    )
    assert response_duplicate.status_code == 400
    assert response_duplicate.json()["detail"] == "Email déjà enregistré"

def test_login_user(client):
    # Création initiale de l'utilisateur
    client.post(
        "/auth/register",
        json={"email": "login@example.com", "password": "securepassword"}
    )

    # Connexion réussie
    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

    # Connexion échouée (mauvais mot de passe)
    response_fail_pwd = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "wrongpassword"}
    )
    assert response_fail_pwd.status_code == 401
    assert response_fail_pwd.json()["detail"] == "Email ou mot de passe incorrect"

    # Connexion échouée (e-mail inexistant)
    response_fail_email = client.post(
        "/auth/login",
        json={"email": "nonexistent@example.com", "password": "securepassword"}
    )
    assert response_fail_email.status_code == 401

def test_get_current_user_profile(client):
    # Inscription et récupération du token
    reg_response = client.post(
        "/auth/register",
        json={"email": "profile@example.com", "password": "password123"}
    )
    token = reg_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Récupération des informations de profil
    me_response = client.get("/auth/me", headers=headers)
    assert me_response.status_code == 200
    data = me_response.json()
    assert data["email"] == "profile@example.com"
    assert data["is_premium"] is False

    # Accès sans token d'authentification
    me_no_auth = client.get("/auth/me")
    assert me_no_auth.status_code == 401

def test_update_profile(client):
    # Inscription et récupération du token
    reg_response = client.post(
        "/auth/register",
        json={"email": "update@example.com", "password": "password123"}
    )
    token = reg_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Mise à jour de l'e-mail
    update_response = client.put(
        "/auth/me",
        json={"email": "newemail@example.com"},
        headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["email"] == "newemail@example.com"

    # Se reconnecter avec le nouvel e-mail pour obtenir un token valide
    login_res = client.post(
        "/auth/login",
        json={"email": "newemail@example.com", "password": "password123"}
    )
    new_token = login_res.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # Essayer d'utiliser un e-mail déjà pris par un autre utilisateur
    # 1. Créer un autre utilisateur
    client.post(
        "/auth/register",
        json={"email": "taken@example.com", "password": "password"}
    )
    # 2. Essayer de prendre cet e-mail
    update_fail = client.put(
        "/auth/me",
        json={"email": "taken@example.com"},
        headers=new_headers
    )
    assert update_fail.status_code == 400
    assert "déjà utilisée" in update_fail.json()["detail"]
