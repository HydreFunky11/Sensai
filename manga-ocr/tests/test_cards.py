import pytest
from datetime import datetime, timedelta

def get_auth_headers(client, email="user@example.com"):
    # Utilitaire pour s'inscrire et obtenir les en-têtes d'authentification
    response = client.post(
        "/auth/register",
        json={"email": email, "password": "password123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_deck_lifecycle(client):
    headers = get_auth_headers(client, "deck@example.com")

    # 1. Lister les decks (doit créer le deck par défaut)
    list_response = client.get("/cards/decks", headers=headers)
    assert list_response.status_code == 200
    decks = list_response.json()
    assert len(decks) == 1
    assert decks[0]["title"] == "Dossier Principal"
    default_deck_id = decks[0]["id"]

    # 2. Créer un nouveau deck
    create_response = client.post(
        "/cards/decks",
        json={"title": "N5 Kanji List", "description": "Kanji vocabulary"},
        headers=headers
    )
    assert create_response.status_code == 200
    new_deck = create_response.json()
    assert new_deck["title"] == "N5 Kanji List"
    new_deck_id = new_deck["id"]

    # 3. Renommer le deck
    rename_response = client.put(
        f"/cards/decks/{new_deck_id}",
        json={"title": "Kanji N5 Modifié"},
        headers=headers
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["title"] == "Kanji N5 Modifié"

    # 4. Supprimer le deck
    delete_response = client.delete(f"/cards/decks/{new_deck_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["message"] == "Dossier supprimé avec succès"

    # Vérification que le deck supprimé n'existe plus
    list_after_delete = client.get("/cards/decks", headers=headers)
    assert len(list_after_delete.json()) == 1  # Uniquement le deck par défaut restant

def test_flashcard_creation_and_review(client):
    headers = get_auth_headers(client, "cards@example.com")

    # Création d'une carte dans le deck par défaut (le deck ID sera récupéré automatiquement si None)
    card_response = client.post(
        "/cards/",
        json={
            "text_source": "水",
            "translation": "Eau",
            "romaji": "mizu",
            "context_note": "character"
        },
        headers=headers
    )
    assert card_response.status_code == 200
    card = card_response.json()
    assert card["text_source"] == "水"
    assert card["romaji"] == "mizu"
    assert card["context_note"] == "character"
    card_id = card["id"]

    # Soumettre une révision SM-2 "Je ne sais plus" (quality = 1)
    review_response_again = client.post(
        f"/cards/{card_id}/review",
        json={"quality": 1},
        headers=headers
    )
    assert review_response_again.status_code == 200
    assert "next_review" in review_response_again.json()

    # Soumettre une révision SM-2 "Je sais" (quality = 3)
    review_response_know = client.post(
        f"/cards/{card_id}/review",
        json={"quality": 3},
        headers=headers
    )
    assert review_response_know.status_code == 200

def test_learned_characters_toggle(client):
    headers = get_auth_headers(client, "learned@example.com")

    # 1. Vérifier que la liste initiale des caractères appris est vide
    get_initial = client.get("/cards/learned", headers=headers)
    assert get_initial.status_code == 200
    assert get_initial.json() == []

    # 2. Ajouter un caractère en tant qu'appris
    toggle_add = client.post(
        "/cards/learned/toggle",
        json={"character": "あ", "alphabet_type": "hiragana"},
        headers=headers
    )
    assert toggle_add.status_code == 200
    assert toggle_add.json()["status"] == "added"
    assert toggle_add.json()["character"] == "あ"

    # 3. Vérifier qu'il apparaît dans la liste
    get_after_add = client.get("/cards/learned", headers=headers)
    assert "あ" in get_after_add.json()

    # 4. Retirer le caractère (toggle off)
    toggle_remove = client.post(
        "/cards/learned/toggle",
        json={"character": "あ", "alphabet_type": "hiragana"},
        headers=headers
    )
    assert toggle_remove.status_code == 200
    assert toggle_remove.json()["status"] == "removed"

    # 5. Vérifier qu'il est retiré de la liste
    get_after_remove = client.get("/cards/learned", headers=headers)
    assert "あ" not in get_after_remove.json()

def test_stats_include_learned_alphabets(client):
    headers = get_auth_headers(client, "stats@example.com")

    # Ajouter un hiragana et un kanji appris pour peupler les stats
    client.post(
        "/cards/learned/toggle",
        json={"character": "あ", "alphabet_type": "hiragana"},
        headers=headers
    )
    client.post(
        "/cards/learned/toggle",
        json={"character": "日", "alphabet_type": "kanji"},
        headers=headers
    )

    # Récupérer les stats
    stats_response = client.get("/cards/stats", headers=headers)
    assert stats_response.status_code == 200
    data = stats_response.json()
    
    # Vérifier que les stats contiennent la clé learned_alphabets
    assert "learned_alphabets" in data
    learned = data["learned_alphabets"]
    assert "hiragana" in learned
    assert "katakana" in learned
    assert "kanji" in learned

    # Vérifier le calcul des pourcentages
    assert learned["hiragana"]["count"] == 1
    assert learned["hiragana"]["percentage"] == round((1 / 46) * 100, 1)

    assert learned["kanji"]["count"] == 1
    assert learned["kanji"]["percentage"] == round((1 / 36) * 100, 1)

    assert learned["katakana"]["count"] == 0
    assert learned["katakana"]["percentage"] == 0.0
