const BASE_URL = "http://127.0.0.1:8000";

export async function analyzeImage(blob, documentName = "", page = 0, boxCoordinates = null) {
  const formData = new FormData();
  formData.append("file", blob, "crop.jpg");
  if (documentName) {
    formData.append("document_name", documentName);
  }
  if (page) {
    formData.append("page", page);
  }
  if (boxCoordinates) {
    formData.append("box_coordinates", JSON.stringify(boxCoordinates));
  }

  const response = await fetch(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de l'analyse");
  }

  return response.json();
}

export async function detectBubbles(blob) {
  const formData = new FormData();
  formData.append("file", blob, "page.jpg");

  const response = await fetch(`${BASE_URL}/detect`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la détection");
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
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(cardData),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la création de la carte");
  }
  return response.json();
}

export async function getDecks() {
  const response = await fetch(`${BASE_URL}/cards/decks`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok)
    throw new Error("Erreur lors de la récupération des dossiers");
  return response.json();
}

export async function createDeck(title) {
  const response = await fetch(`${BASE_URL}/cards/decks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la création du dossier");
  }
  return response.json();
}

export async function renameDeck(deckId, title) {
  const response = await fetch(`${BASE_URL}/cards/decks/${deckId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Erreur lors du renommage du dossier");
  return response.json();
}

export async function deleteDeck(deckId) {
  const response = await fetch(`${BASE_URL}/cards/decks/${deckId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Erreur lors de la suppression du dossier");
  return response.json();
}

export async function deleteFlashcard(cardId) {
  const response = await fetch(`${BASE_URL}/cards/${cardId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Erreur lors de la suppression de la carte");
  return response.json();
}

export async function getFlashcards(deckId = null) {
  const url = deckId
    ? `${BASE_URL}/cards/?deck_id=${deckId}`
    : `${BASE_URL}/cards/`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la récupération des cartes");
  }
  return response.json();
}

export async function getDueFlashcards(deckId = null) {
  const url = deckId
    ? `${BASE_URL}/cards/study?deck_id=${deckId}`
    : `${BASE_URL}/cards/study`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la récupération des cartes à réviser");
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

export async function logDeckCompletion(deckId, isFreeReview = false) {
  const response = await fetch(`${BASE_URL}/cards/decks/${deckId}/complete?is_free_review=${isFreeReview}`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Erreur lors de l'enregistrement de la complétion");
  }
  return response.json();
}

export async function getReviewStats() {
  const response = await fetch(`${BASE_URL}/cards/stats`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la récupération des statistiques");
  }
  return response.json();
}

export async function toggleLearnedCharacter(character, alphabetType) {
  const response = await fetch(`${BASE_URL}/cards/learned/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ character, alphabet_type: alphabetType }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la modification de l'état d'apprentissage");
  }
  return response.json();
}

export async function getLearnedCharacters() {
  const response = await fetch(`${BASE_URL}/cards/learned`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la récupération des caractères appris");
  }
  return response.json();
}

export async function getMe() {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la récupération du profil");
  }
  return response.json();
}

export async function createCheckoutSession() {
  const response = await fetch(`${BASE_URL}/payments/create-checkout-session`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la création de la session de paiement");
  }
  return response.json();
}

export async function createPortalSession() {
  const response = await fetch(`${BASE_URL}/payments/create-portal-session`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la création du portail client");
  }
  return response.json();
}

export async function syncSubscription(sessionId) {
  const response = await fetch(`${BASE_URL}/payments/sync-subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la synchronisation de l'abonnement");
  }
  return response.json();
}

export async function updateProfile(profileData) {
  const response = await fetch(`${BASE_URL}/auth/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(profileData),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || "Erreur lors de la mise à jour du profil");
  }
  return response.json();
}

// --- LIBRARY ---

export async function getLibrary(folderId = null, sortBy = 'date', order = 'desc') {
  let url = `${BASE_URL}/library/?sort_by=${sortBy}&order=${order}`;
  if (folderId !== null) {
    url = `${BASE_URL}/library/?folder_id=${folderId}&sort_by=${sortBy}&order=${order}`;
  }
  
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Erreur lors de la récupération de la bibliothèque");
  }
  return response.json();
}

export async function getLibraryFolders() {
  const response = await fetch(`${BASE_URL}/library/folders`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la récupération des dossiers');
  return response.json();
}

export async function createLibraryFolder(name) {
  const response = await fetch(`${BASE_URL}/library/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Erreur lors de la création du dossier');
  return response.json();
}

export async function renameLibraryFolder(folderId, name) {
  const response = await fetch(`${BASE_URL}/library/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('Erreur lors du renommage du dossier');
  return response.json();
}

export async function deleteLibraryFolder(folderId) {
  const response = await fetch(`${BASE_URL}/library/folders/${folderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression du dossier');
  return response.json();
}

export async function moveMangaToFolder(mangaId, folderId) {
  const response = await fetch(`${BASE_URL}/library/${mangaId}/folder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!response.ok) throw new Error('Erreur lors du déplacement');
  return response.json();
}

export async function renameManga(mangaId, title) {
  const response = await fetch(`${BASE_URL}/library/${mangaId}/rename`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Erreur lors du renommage');
  return response.json();
}

export async function deleteManga(mangaId) {
  const response = await fetch(`${BASE_URL}/library/${mangaId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Erreur lors de la suppression');
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

export async function importToLibrary(file, folderId = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (folderId) {
    formData.append("folder_id", folderId);
  }

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
