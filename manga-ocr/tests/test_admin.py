import pytest
import os

def create_admin_and_login(client, db):
    from db import models
    from core.security import get_password_hash
    # Créer un compte admin
    admin = models.User(
        email="superadmin@example.com",
        hashed_password=get_password_hash("AdminPass123!"),
        is_admin=True,
        is_premium=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    # Login
    res = client.post("/auth/login", json={"email": "superadmin@example.com", "password": "AdminPass123!"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, admin

def test_public_registration_blocking(client, monkeypatch):
    # Désactiver explicitement l'inscription publique
    monkeypatch.setenv("ALLOW_PUBLIC_REGISTRATION", "false")

    response = client.post(
        "/auth/register",
        json={"email": "blocked@example.com", "password": "password123"}
    )
    assert response.status_code == 403
    assert "bêta privée sur invitation" in response.json()["detail"]

def test_admin_endpoints_protection(client):
    # Utilisateur standard non-admin
    client.post(
        "/auth/register",
        json={"email": "tester@example.com", "password": "password123"}
    )
    login_res = client.post(
        "/auth/login",
        json={"email": "tester@example.com", "password": "password123"}
    )
    user_token = login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Tentative d'accès aux stats admin
    res_stats = client.get("/admin/stats", headers=user_headers)
    assert res_stats.status_code == 403

    # Tentative de lister les utilisateurs
    res_users = client.get("/admin/users", headers=user_headers)
    assert res_users.status_code == 403

    # Tentative de création par non-admin
    res_create = client.post(
        "/admin/users",
        json={"email": "newbie@example.com", "password": "secret"},
        headers=user_headers
    )
    assert res_create.status_code == 403

def test_admin_crud_and_stats_workflow(client, db):
    admin_headers, admin_user = create_admin_and_login(client, db)

    # 1. Vérifier stats initiales
    stats_res = client.get("/admin/stats", headers=admin_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_admins"] >= 1

    # 2. Créer un compte testeur via l'admin
    create_res = client.post(
        "/admin/users",
        json={
            "email": "beta_tester@example.com",
            "password": "TesterPassword123!",
            "is_premium": False,
            "is_admin": False
        },
        headers=admin_headers
    )
    assert create_res.status_code == 201
    created_user = create_res.json()
    assert created_user["email"] == "beta_tester@example.com"
    assert created_user["is_premium"] is False
    assert created_user["is_admin"] is False
    tester_id = created_user["id"]

    # 3. Le testeur peut se connecter avec les identifiants créés
    tester_login = client.post(
        "/auth/login",
        json={"email": "beta_tester@example.com", "password": "TesterPassword123!"}
    )
    assert tester_login.status_code == 200
    assert "access_token" in tester_login.json()

    # 4. Basculer le testeur en Premium
    toggle_res = client.patch(
        f"/admin/users/{tester_id}/premium",
        json={"is_premium": True},
        headers=admin_headers
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_premium"] is True

    # 5. Réinitialiser le mot de passe du testeur
    reset_pwd_res = client.patch(
        f"/admin/users/{tester_id}/password",
        json={"new_password": "NewSecretTester456!"},
        headers=admin_headers
    )
    assert reset_pwd_res.status_code == 200

    # Vérifier que le nouveau mot de passe fonctionne
    tester_new_login = client.post(
        "/auth/login",
        json={"email": "beta_tester@example.com", "password": "NewSecretTester456!"}
    )
    assert tester_new_login.status_code == 200

    # 6. Empêcher l'admin de supprimer son propre compte
    self_del = client.delete(f"/admin/users/{admin_user.id}", headers=admin_headers)
    assert self_del.status_code == 400

    # 7. Supprimer le testeur
    del_res = client.delete(f"/admin/users/{tester_id}", headers=admin_headers)
    assert del_res.status_code == 200
    assert "supprimé avec succès" in del_res.json()["message"]

    # Vérifier que le compte supprimé ne peut plus se connecter
    del_login = client.post(
        "/auth/login",
        json={"email": "beta_tester@example.com", "password": "NewSecretTester456!"}
    )
    assert del_login.status_code == 401
