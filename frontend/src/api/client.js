const BASE_URL = "http://127.0.0.1:8000";

export async function analyzeImage(blob) {
  const formData = new FormData();
  formData.append("file", blob, "crop.jpg");

  const response = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Erreur lors de l'analyse");
  }

  return response.json();
}

export function getAudioUrl(text, voice = "ja-JP-NanamiNeural") {
  if (!text) return null;
  return `${BASE_URL}/tts?text=${encodeURIComponent(text)}&voice=${voice}`;
}

// Récupère le token stocké (utilisé par Auth)
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- FLASHCARDS ---

export async function createFlashcard(cardData) {
  const response = await fetch(`${BASE_URL}/cards/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(cardData),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la création de la carte');
  }
  return response.json();
}

export async function getDecks() {
  const response = await fetch(`${BASE_URL}/cards/decks`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la récupération des dossiers');
  return response.json();
}

export async function createDeck(title) {
  const response = await fetch(`${BASE_URL}/cards/decks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Erreur lors de la création du dossier');
  return response.json();
}

export async function getFlashcards(deckId = null) {
  const url = deckId ? `${BASE_URL}/cards/?deck_id=${deckId}` : `${BASE_URL}/cards/`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des cartes');
  }
  return response.json();
}

export async function getDueFlashcards(deckId = null) {
  const url = deckId ? `${BASE_URL}/cards/study?deck_id=${deckId}` : `${BASE_URL}/cards/study`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des cartes à réviser');
  }
  return response.json();
}

export async function submitCardReview(cardId, quality) {
  const response = await fetch(`${BASE_URL}/cards/${cardId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ quality }),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la soumission de la révision");
  }
  return response.json();
}

// --- LIBRARY ---

export async function getLibrary() {
  const response = await fetch(`${BASE_URL}/library/`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la récupération de la bibliothèque");
  }
  return response.json();
}

export function getMangaFileUrl(mangaId) {
  const token = localStorage.getItem("token");
  return `${BASE_URL}/library/${mangaId}/file?token=${token}`; // Assuming token can be passed in URL, but usually it's in headers.
  // For images or pdfs loaded by browser, passing token in URL is easier. We need to update backend to accept token from query if we use it directly in <img> or PDF.js
}

export async function getMangaFileBlob(mangaId) {
  const response = await fetch(`${BASE_URL}/library/${mangaId}/file`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Erreur récupération fichier");
  return response.blob();
}

export async function importToLibrary(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}/library/import`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Erreur lors de l'importation");
  }
  return response.json();
}
