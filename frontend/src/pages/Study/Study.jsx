import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  getDueFlashcards,
  submitCardReview,
  getAudioUrl,
  getDecks,
  getFlashcards,
  renameDeck,
  deleteDeck,
  deleteFlashcard,
  createDeck,
  logDeckCompletion,
} from "../../api/client";
import { useNavigate } from "react-router-dom";
import { Navbar } from "../../components/Navbar/Navbar";
import { toast } from "react-hot-toast";

export default function Study() {
  const [viewMode, setViewMode] = useState("decks"); // 'decks', 'study', 'edit'
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);

  // Stats
  const [deckStats, setDeckStats] = useState({}); // { [deckId]: { total: X, due: Y } }

  // Study session
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // --- ÉTATS DESSIN CARACTÈRES ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [loadingSVG, setLoadingSVG] = useState(false);
  const [strokesData, setStrokesData] = useState([]);
  const [currentStrokeIndex, setCurrentStrokeIndex] = useState(0);
  const [completedStrokes, setCompletedStrokes] = useState([]);
  const [svgUnavailable, setSvgUnavailable] = useState(false);
  const [userDidNotKnow, setUserDidNotKnow] = useState(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState("");

  const canvasRef = useRef(null);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const userStrokePoints = useRef([]);

  // Annonce dynamique pour les lecteurs d'écran (A11y)
  useEffect(() => {
    if (viewMode !== "study" || cards.length === 0 || !cards[currentIndex]) return;
    const currentCard = cards[currentIndex];
    if (showAnswer) {
      setAriaAnnouncement(
        `Verso affiché. Traduction : ${currentCard.translation}. Romaji : ${currentCard.romaji || ''}. Saisissez votre niveau de maîtrise de 1 à 4.`
      );
    } else {
      setAriaAnnouncement(
        `Fiche ${currentIndex + 1} sur ${cards.length}. Recto : ${currentCard.context_note === 'character' ? 'Tracé correspondant pour ' + currentCard.romaji : currentCard.text_source}. Appuyez sur Espace pour afficher la réponse.`
      );
    }
  }, [currentIndex, showAnswer, viewMode, cards]);

  // Raccourcis clavier globaux pour la session de révision (A11y)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode !== "study" || cards.length === 0 || !cards[currentIndex]) return;
      
      const currentCard = cards[currentIndex];
      
      // Si la réponse n'est pas encore affichée, appuyer sur Espace ou Entrée l'affiche (si ce n'est pas une carte de tracé)
      if (!showAnswer) {
        if (e.key === " " || e.key === "Enter") {
          if (currentCard.context_note !== 'character') {
            e.preventDefault();
            setShowAnswer(true);
          }
        }
        return;
      }
      
      // Si la réponse est affichée, les touches 1, 2, 3, 4 déclenchent les scores de révision
      const key = e.key;
      if (key === "1" || key === "&") {
        e.preventDefault();
        handleReview(1);
      } else if (key === "2" || key === "é") {
        e.preventDefault();
        if (currentCard.context_note === 'character' && userDidNotKnow) {
          handleReview(1);
        } else {
          handleReview(2);
        }
      } else if (key === "3" || key === "\"") {
        e.preventDefault();
        if (!(currentCard.context_note === 'character' && userDidNotKnow)) {
          handleReview(3);
        }
      } else if (key === "4" || key === "'") {
        e.preventDefault();
        if (!(currentCard.context_note === 'character' && userDidNotKnow)) {
          handleReview(4);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        if (currentCard.context_note === 'character' && userDidNotKnow) {
          e.preventDefault();
          handleReview(1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewMode, currentIndex, showAnswer, cards, userDidNotKnow]);

  // Charger le tracé vectoriel KanjiVG
  const fetchStrokeOrder = async (char) => {
    if (!char) return;
    setLoadingSVG(true);
    setSvgUnavailable(false);
    setCompletedStrokes([]);
    setCurrentStrokeIndex(0);
    setStrokesData([]);
    
    try {
      const codePoint = char.codePointAt(0);
      const hex = codePoint.toString(16).padStart(5, '0');
      const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("SVG introuvable dans la base KanjiVG");
      }
      
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const paths = Array.from(doc.querySelectorAll('path'));
      
      const parsedStrokes = paths.map(path => {
        const d = path.getAttribute('d');
        return getPathPoints(d, 25);
      });
      
      setStrokesData(parsedStrokes);
      console.log(`✅ ${parsedStrokes.length} tracés chargés pour ${char}`);
    } catch (err) {
      console.warn("Impossible de charger le tracé KanjiVG:", err);
      setSvgUnavailable(true);
      toast.error("Modèle de tracé guidé indisponible pour ce caractère.");
    } finally {
      setLoadingSVG(false);
    }
  };

  const getPathPoints = (pathD, sampleCount = 25) => {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathD);
    const totalLength = pathEl.getTotalLength();
    const points = [];
    const canvasWidth = 300;
    const scale = canvasWidth / 109;

    for (let i = 0; i <= sampleCount; i++) {
      const distance = (i / sampleCount) * totalLength;
      const pt = pathEl.getPointAtLength(distance);
      points.push({ 
        x: pt.x * scale, 
        y: pt.y * scale 
      });
    }
    return points;
  };

  // Dessin du canevas guidé
  const drawGuidedGuide = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Grille de repères
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    
    ctx.setLineDash([]); // Reset

    // Si l'utilisateur ne sait pas ou qu'on affiche la réponse : afficher TOUT le tracé en filigrane (ou en vert)
    if (showAnswer || userDidNotKnow) {
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = userDidNotKnow ? 'rgba(239, 68, 68, 0.4)' : '#10b981';
      
      strokesData.forEach((stroke) => {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      });
      return;
    }

    // 1. Dessiner les traits futurs en filigrane (gris clair)
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    strokesData.forEach((stroke, idx) => {
      if (idx >= currentStrokeIndex) {
        ctx.strokeStyle = idx === currentStrokeIndex ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }
    });

    // 2. Dessiner les traits déjà validés en vert néon
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 10;
    completedStrokes.forEach(strokePoints => {
      ctx.beginPath();
      ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
      for (let i = 1; i < strokePoints.length; i++) {
        ctx.lineTo(strokePoints[i].x, strokePoints[i].y);
      }
      ctx.stroke();
    });

    // 3. Dessiner le badge indicateur du début de tracé du trait actif
    if (currentStrokeIndex < strokesData.length && strokesData[currentStrokeIndex]) {
      const activeStroke = strokesData[currentStrokeIndex];
      const startPt = activeStroke[0];
      
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(startPt.x - 14, startPt.y - 14, 11, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentStrokeIndex + 1, startPt.x - 14, startPt.y - 14);
    }
  }, [strokesData, currentStrokeIndex, completedStrokes, showAnswer, userDidNotKnow]);

  useEffect(() => {
    if (strokesData.length > 0) {
      drawGuidedGuide();
    }
  }, [strokesData, currentStrokeIndex, completedStrokes, showAnswer, userDidNotKnow, drawGuidedGuide]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    if (showAnswer || userDidNotKnow) return; // Ne pas dessiner si déjà répondu
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    lastX.current = x;
    lastY.current = y;
    userStrokePoints.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawing || showAnswer || userDidNotKnow) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX.current = x;
    lastY.current = y;
    userStrokePoints.current.push({ x, y });
  };

  const stopDrawing = () => {
    if (!isDrawing || showAnswer || userDidNotKnow) return;
    setIsDrawing(false);
    validateUserStroke();
  };

  const validateUserStroke = () => {
    const pts = userStrokePoints.current;
    if (pts.length < 5) {
      drawGuidedGuide();
      return;
    }

    if (currentStrokeIndex >= strokesData.length) return;

    const targetStroke = strokesData[currentStrokeIndex];
    const getDistance = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    
    const startDist = getDistance(pts[0], targetStroke[0]);
    const endDist = getDistance(pts[pts.length - 1], targetStroke[targetStroke.length - 1]);
    const midDist = getDistance(
      pts[Math.floor(pts.length / 2)], 
      targetStroke[Math.floor(targetStroke.length / 2)]
    );

    const threshold = 95;

    if (startDist < threshold && endDist < threshold && midDist < threshold) {
      toast.success(`Trait ${currentStrokeIndex + 1} validé !`, { id: 'study-stroke-toast', duration: 800 });
      const newCompleted = [...completedStrokes, targetStroke];
      setCompletedStrokes(newCompleted);
      
      const nextIndex = currentStrokeIndex + 1;
      setCurrentStrokeIndex(nextIndex);
      
      if (nextIndex >= strokesData.length) {
        toast.success(`🎉 Excellent ! Écriture complétée !`, { duration: 1500 });
        setShowAnswer(true); // Affiche le verso
      }
    } else {
      toast.error("Tracé incorrect. Respectez le sens et l'ordre des traits !", { id: 'study-stroke-toast', duration: 1200 });
      drawGuidedGuide();
    }
  };

  const resetWriting = () => {
    setCompletedStrokes([]);
    setCurrentStrokeIndex(0);
    setUserDidNotKnow(false);
    drawGuidedGuide();
  };

  const handleCanvasKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      resetWriting();
      toast.success("Zone de dessin réinitialisée", { id: 'study-canvas-reset', duration: 1000 });
    }
  };

  // Edit mode
  const [editDeckTitle, setEditDeckTitle] = useState("");
  const [deckCards, setDeckCards] = useState([]);

  // Decks list options
  const [newDeckTitle, setNewDeckTitle] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadDecksAndStats = async () => {
    setLoading(true);
    try {
      const fetchedDecks = await getDecks();
      setDecks(fetchedDecks);

      const allDue = await getDueFlashcards();
      const allCards = await getFlashcards();

      const stats = {};
      fetchedDecks.forEach((d) => {
        stats[d.id] = {
          total: allCards.filter((c) => c.deck_id === d.id).length,
          due: allDue.filter((c) => c.deck_id === d.id).length,
        };
      });
      setDeckStats(stats);
    } catch (e) {
      console.error(e);
      setError(e.message || "Erreur lors du chargement des dossiers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDecksAndStats();
  }, []);

  // Charger le tracé vectoriel au changement de carte de type caractère
  useEffect(() => {
    const currentCard = cards[currentIndex];
    if (viewMode === "study" && currentCard && currentCard.context_note === 'character') {
      setUserDidNotKnow(false);
      setCompletedStrokes([]);
      setCurrentStrokeIndex(0);
      fetchStrokeOrder(currentCard.text_source);
    }
  }, [currentIndex, viewMode, cards]);

  const startStudySession = async (deck) => {
    setLoading(true);
    try {
      let data = await getDueFlashcards(deck.id);
      let isFreeReview = false;
      if (data.length === 0) {
        data = await getFlashcards(deck.id);
        isFreeReview = true;
      }
      if (data.length === 0) {
        toast.error(
          "Ce dossier est vide ! Ajoutez des fiches depuis l'application de lecture avant de réviser.",
        );
        return;
      }
      setSelectedDeck({ ...deck, isFreeReview });
      setCards(data);
      setCurrentIndex(0);
      setShowAnswer(false);
      setViewMode("study");
    } catch (e) {
      toast.error("Erreur chargement session: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (quality) => {
    if (cards.length === 0) return;
    const currentCard = cards[currentIndex];

    try {
      await submitCardReview(currentCard.id, quality);

      const updatedQueue = [...cards];

      if (quality === 1) {
        // "Je ne sais plus" -> Recommence après 3-4 cartes (insertion à i + 4)
        // Mais pour un caractère japonais, la carte revient 6-7 cartes plus tard (insertion à i + 7)
        const gap = currentCard.context_note === 'character' ? 7 : 4;
        const insertIndex = Math.min(currentIndex + gap, updatedQueue.length);
        updatedQueue.splice(insertIndex, 0, currentCard);
      } else if (quality === 2) {
        // "Un peu dur" -> Recommence après 6-7 cartes (insertion à i + 7)
        const insertIndex = Math.min(currentIndex + 7, updatedQueue.length);
        updatedQueue.splice(insertIndex, 0, currentCard);
      } else if (quality === 3) {
        // "Je sais" -> Recommence après 12-13 cartes (insertion à i + 13)
        const insertIndex = Math.min(currentIndex + 13, updatedQueue.length);
        updatedQueue.splice(insertIndex, 0, currentCard);
      }
      // Si quality === 4 ("Trop facile"), on ne réinsère pas la carte.

      setCards(updatedQueue);

      // Passer à la carte suivante ou terminer
      if (currentIndex < updatedQueue.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        try {
          await logDeckCompletion(selectedDeck.id, selectedDeck.isFreeReview);
        } catch (logErr) {
          console.error("Erreur enregistrement complétion dossier:", logErr);
        }
        toast.success(
          "🎉 Toutes les fiches prévues pour cette session ont été révisées !",
        );
        setViewMode("decks");
        loadDecksAndStats();
      }
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde: " + err.message);
    }
  };

  const startEditMode = async (deck) => {
    setLoading(true);
    try {
      setSelectedDeck(deck);
      setEditDeckTitle(deck.title);
      const allDeckCards = await getFlashcards(deck.id);
      setDeckCards(allDeckCards);
      setViewMode("edit");
    } catch (e) {
      toast.error("Erreur chargement des cartes du dossier: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameDeck = async () => {
    if (!editDeckTitle.trim()) {
      toast.error("Le titre ne peut pas être vide");
      return;
    }
    try {
      const updated = await renameDeck(selectedDeck.id, editDeckTitle);
      setSelectedDeck(updated);
      toast.success("Dossier renommé avec succès !");
    } catch (e) {
      toast.error("Erreur renommage: " + e.message);
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette carte ?")) return;
    try {
      await deleteFlashcard(cardId);
      setDeckCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success("Carte supprimée avec succès !");
    } catch (e) {
      toast.error("Erreur lors de la suppression de la carte: " + e.message);
    }
  };

  const handleCreateDeck = async (e) => {
    e.preventDefault();
    if (!newDeckTitle.trim()) return;
    try {
      await createDeck(newDeckTitle);
      setNewDeckTitle("");
      loadDecksAndStats();
      toast.success("Dossier de révision créé !");
    } catch (e) {
      toast.error("Erreur lors de la création du dossier: " + e.message);
    }
  };

  const handleDeleteDeck = async (deckId) => {
    if (
      !window.confirm(
        "Voulez-vous vraiment supprimer ce dossier et TOUTES les cartes qu'il contient ? Cette action est irréversible !",
      )
    )
      return;
    try {
      await deleteDeck(deckId);
      loadDecksAndStats();
      toast.success("Dossier de révision supprimé !");
    } catch (e) {
      toast.error("Erreur lors de la suppression du dossier: " + e.message);
    }
  };

  const playAudio = (text) => {
    if (!text) return;
    const url = getAudioUrl(text);
    const audio = new Audio(url);
    audio.play();
  };

  if (loading && viewMode === "decks" && decks.length === 0) {
    return <div style={styles.center}>Chargement des fiches...</div>;
  }

  if (error) {
    return <div style={{ ...styles.center, color: "red" }}>{error}</div>;
  }

  return (
    <div style={styles.container}>
      <Navbar />
      <div style={styles.contentWrapper}>
        {/* 1. VUE LISTE DES DOSSIERS */}
        {viewMode === "decks" && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>📚 Dossiers de révision</h1>
                <p style={styles.subTitle}>
                  Entraînez votre mémoire avec notre système de répétition
                  espacée (SRS).
                </p>
              </div>
            </div>

            {/* Formulaire création dossier */}
            <div style={styles.cardContainerCompact}>
              <form onSubmit={handleCreateDeck} style={styles.createForm}>
                <input
                  type="text"
                  value={newDeckTitle}
                  onChange={(e) => setNewDeckTitle(e.target.value)}
                  placeholder="Créer un nouveau dossier de révision..."
                  style={styles.createInput}
                />
                <button type="submit" style={styles.btnCreate}>
                  Créer
                </button>
              </form>
            </div>

            {/* Liste des dossiers */}
            <div style={styles.decksGrid}>
              {decks.map((deck) => {
                const stats = deckStats[deck.id] || { total: 0, due: 0 };
                return (
                  <div key={deck.id} style={styles.deckCard}>
                    <div style={styles.deckHeader}>
                      <h3 style={styles.deckTitle}>{deck.title}</h3>
                      <span style={styles.totalBadge}>{stats.total} cartes</span>
                    </div>

                    <div style={styles.deckStatusRow}>
                      {stats.due > 0 ? (
                        <span style={styles.dueBadge}>
                          {stats.due} fiches à réviser
                        </span>
                      ) : (
                        <span style={styles.completedBadge}>
                          ✓ À jour pour aujourd'hui
                        </span>
                      )}
                    </div>

                    <div style={styles.deckActions}>
                      {stats.due > 0 ? (
                        <button
                          onClick={() => startStudySession(deck)}
                          style={styles.btnStudy}
                        >
                          Réviser
                        </button>
                      ) : (
                        <button
                          onClick={() => startStudySession(deck)}
                          disabled={stats.total === 0}
                          style={
                            stats.total > 0
                              ? styles.btnStudyFree
                              : styles.btnStudyDisabled
                          }
                        >
                          Révision libre
                        </button>
                      )}
                      <button
                        onClick={() => startEditMode(deck)}
                        style={styles.btnEdit}
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => handleDeleteDeck(deck.id)}
                        style={styles.btnDeleteDeck}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 2. VUE SESSION DE RÉVISION */}
        {viewMode === "study" && selectedDeck && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>
                  ⚡{" "}
                  {selectedDeck.isFreeReview
                    ? "Révision libre : "
                    : "Session : "}{" "}
                  {selectedDeck.title}
                </h1>
                <span style={styles.progressText}>
                  Fiche {currentIndex + 1} / {cards.length}
                </span>
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Quitter la session en cours ? Vos réponses validées sont enregistrées.",
                    )
                  ) {
                    setViewMode("decks");
                    loadDecksAndStats();
                  }
                }}
                style={styles.btnBack}
              >
                Quitter la session
              </button>
            </div>

            {/* Barre de progression */}
            <div style={styles.progressBarBg}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${(currentIndex / cards.length) * 100}%`,
                }}
              />
            </div>

            {cards.length > 0 && cards[currentIndex] && (
              <div style={styles.studyCard}>
                {/* RECTO */}
                {cards[currentIndex].context_note !== 'character' ? (
                  <div style={styles.cardSectionRecto}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "15px",
                      }}
                    >
                      <h2 style={styles.kanaText}>
                        {cards[currentIndex].text_source}
                      </h2>
                      <button
                        onClick={() => playAudio(cards[currentIndex].text_source)}
                        style={styles.btnAudio}
                        title="Écouter la prononciation"
                      >
                        🔊
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#cbd5e1', fontWeight: 600, margin: '0 0 5px 0', textAlign: 'center' }}>
                      Tracez le caractère correspondant :
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '2.5rem', color: '#8b5cf6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {cards[currentIndex].romaji}
                      </span>
                      <button
                        onClick={() => playAudio(cards[currentIndex].text_source)}
                        style={{ ...styles.btnAudio, fontSize: '24px' }}
                        title="Écouter la prononciation"
                      >
                        🔊
                      </button>
                    </div>
                    
                    {/* Canvas d'écriture pour la carte caractère */}
                    <div 
                      style={{ 
                        width: '300px',
                        height: '300px', 
                        background: '#09090b',
                        borderRadius: '16px',
                        border: '1px dashed #27272a',
                        position: 'relative',
                        overflow: 'hidden',
                        margin: '0 auto 10px auto'
                      }}
                    >
                      {loadingSVG ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
                          <div className="glass-loader-spinner" style={{ width: '35px', height: '35px', margin: 0 }} />
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Chargement...</span>
                        </div>
                      ) : (
                        <canvas
                          ref={canvasRef}
                          width={300}
                          height={300}
                          tabIndex={0}
                          className="a11y-canvas"
                          aria-label={`Zone d'écriture pour le tracé du caractère romaji ${cards[currentIndex]?.romaji || ''}. Appuyez sur Echap pour effacer votre tracé.`}
                          onKeyDown={handleCanvasKeyDown}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          style={{ 
                            display: 'block', 
                            cursor: (showAnswer || userDidNotKnow) ? 'default' : 'crosshair',
                            width: '100%',
                            height: '100%'
                          }}
                        />
                      )}
                    </div>

                    {/* Boutons de contrôle de dessin (seulement au Recto) */}
                    {!showAnswer && (
                      <div style={{ display: 'flex', gap: '15px', width: '100%', justifyContent: 'center', marginBottom: '15px' }}>
                        <button
                          onClick={resetWriting}
                          style={{
                            background: 'transparent',
                            color: '#cbd5e1',
                            border: '1px solid #3f3f3f',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                        >
                          Effacer
                        </button>
                        <button
                          onClick={() => {
                            setUserDidNotKnow(true);
                            setShowAnswer(true);
                          }}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          Je ne sais plus
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* VERSO */}
                {showAnswer ? (
                  <div style={styles.cardSectionVerso}>
                    <hr style={styles.divider} />

                    {cards[currentIndex].context_note === 'character' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ fontSize: '3rem', color: '#4ade80', margin: '0', fontWeight: '800', textAlign: 'center' }}>
                          {cards[currentIndex].text_source}
                        </h2>
                        
                        <p style={styles.romajiText}>Romaji : {cards[currentIndex].romaji}</p>
                        
                        <h3 style={styles.translationText}>
                          {cards[currentIndex].translation}
                        </h3>

                        {userDidNotKnow ? (
                          <div style={{ width: '100%', textAlign: 'center', marginTop: '10px' }}>
                            <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: 600, marginBottom: '15px' }}>
                              💡 Voici le tracé correct. Retenez-le, il reviendra 6-7 cartes plus tard !
                            </p>
                            <button
                              onClick={() => handleReview(1)}
                              style={{
                                padding: '12px 28px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 700,
                                boxShadow: '0 4px 10px rgba(239, 68, 68, 0.3)',
                                transition: 'transform 0.1s ease',
                                outline: 'none'
                              }}
                            >
                              Continuer
                            </button>
                          </div>
                        ) : (
                          <div style={{ width: '100%' }}>
                            <p style={{ color: '#22c55e', fontSize: '0.9rem', fontWeight: 600, textAlign: 'center', marginBottom: '15px' }}>
                              🎉 Tracé validé ! Saisissez votre niveau de maîtrise :
                            </p>
                            <div style={styles.buttonsContainer}>
                              <button
                                onClick={() => handleReview(2)}
                                style={{ ...styles.btnReview, background: "#f97316" }}
                              >
                                Un peu dur
                                <br />
                                <small style={styles.smallLabel}>
                                  Recommence dans ~6 cartes
                                </small>
                              </button>
                              <button
                                onClick={() => handleReview(3)}
                                style={{ ...styles.btnReview, background: "#22c55e" }}
                              >
                                Je sais
                                <br />
                                <small style={styles.smallLabel}>
                                  Recommence dans ~12 cartes
                                </small>
                              </button>
                              <button
                                onClick={() => handleReview(4)}
                                style={{ ...styles.btnReview, background: "#3b82f6" }}
                              >
                                Trop facile
                                <br />
                                <small style={styles.smallLabel}>
                                  Ne reviendra plus aujourd'hui
                                </small>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <p style={styles.romajiText}>{cards[currentIndex].romaji}</p>

                        <h3 style={styles.translationText}>
                          {cards[currentIndex].translation}
                        </h3>

                        {cards[currentIndex].context_note && (
                          <p style={styles.contextNote}>
                            📝 Note: {cards[currentIndex].context_note}
                          </p>
                        )}

                        {/* Découpage lexical */}
                        {cards[currentIndex].breakdown &&
                          cards[currentIndex].breakdown.length > 0 && (
                            <div style={styles.breakdownContainer}>
                              <h4
                                style={{
                                  margin: "0 0 10px 0",
                                  color: "#e2e8f0",
                                  fontSize: "0.95rem",
                                }}
                              >
                                Découpage lexical :
                              </h4>
                              {cards[currentIndex].breakdown.map((item, i) => (
                                <div key={i} style={styles.breakdownItem}>
                                  <strong style={{ color: '#60a5fa' }}>{item.word}</strong> 
                                  {item.romanji ? (
                                    <span
                                      style={{ color: "#94a3b8", fontSize: "0.8rem" }}
                                    >
                                      {" "}
                                      ({item.romanji})
                                    </span>
                                  ) : null}
                                  :{" "}
                                  <span style={{ fontWeight: "500" }}>
                                    {item.meaning}
                                  </span>
                                  {item.grammar ? (
                                    <span style={styles.grammarTag}>
                                      {item.grammar}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}

                        {/* Boutons d'auto-évaluation */}
                        <div style={styles.buttonsContainer}>
                          <button
                            onClick={() => handleReview(1)}
                            style={{ ...styles.btnReview, background: "#ef4444" }}
                          >
                            Je ne sais plus
                            <br />
                            <small style={styles.smallLabel}>
                              Recommence dans ~3 cartes
                            </small>
                          </button>
                          <button
                            onClick={() => handleReview(2)}
                            style={{ ...styles.btnReview, background: "#f97316" }}
                          >
                            Un peu dur
                            <br />
                            <small style={styles.smallLabel}>
                              Recommence dans ~6 cartes
                            </small>
                          </button>
                          <button
                            onClick={() => handleReview(3)}
                            style={{ ...styles.btnReview, background: "#22c55e" }}
                          >
                            Je sais
                            <br />
                            <small style={styles.smallLabel}>
                              Recommence dans ~12 cartes
                            </small>
                          </button>
                          <button
                            onClick={() => handleReview(4)}
                            style={{ ...styles.btnReview, background: "#3b82f6" }}
                          >
                            Trop facile
                            <br />
                            <small style={styles.smallLabel}>
                              Ne reviendra plus aujourd'hui
                            </small>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  cards[currentIndex].context_note !== 'character' && (
                    <div style={{ textAlign: "center", marginTop: "40px" }}>
                      <button
                        onClick={() => setShowAnswer(true)}
                        style={styles.btnShowAnswer}
                      >
                        Afficher la réponse
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        {/* 3. VUE ÉDITION DE DOSSIER */}
        {viewMode === "edit" && selectedDeck && (
          <>
            <div style={styles.header}>
              <div>
                <h1 style={styles.pageTitle}>🛠️ Édition : {selectedDeck.title}</h1>
                <p style={styles.subTitle}>
                  Renommez le dossier ou supprimez des fiches obsolètes.
                </p>
              </div>
              <button
                onClick={() => {
                  setViewMode("decks");
                  loadDecksAndStats();
                }}
                style={styles.btnBack}
              >
                Fermer l'édition
              </button>
            </div>

            {/* Formulaire Renommer */}
            <div style={styles.cardContainerCompact}>
              <div style={styles.renameForm}>
                <input
                  type="text"
                  value={editDeckTitle}
                  onChange={(e) => setEditDeckTitle(e.target.value)}
                  placeholder="Nom du dossier..."
                  style={styles.renameInput}
                />
                <button onClick={handleRenameDeck} style={styles.btnRename}>
                  Renommer
                </button>
              </div>
            </div>

            {/* Liste des cartes du dossier */}
            <div style={styles.editCardsSection}>
              <h3 style={styles.sectionTitle}>
                Cartes contenues dans ce dossier ({deckCards.length})
              </h3>

              {deckCards.length === 0 ? (
                <div style={styles.emptyState}>
                  <p>Aucune carte dans ce dossier pour l'instant.</p>
                </div>
              ) : (
                <div style={styles.editCardsList}>
                  {deckCards.map((card) => (
                    <div key={card.id} style={styles.editCardItem}>
                      <div style={styles.editCardDetails}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <span style={styles.cardTextSource}>
                            {card.text_source}
                          </span>
                          <span style={styles.cardRomaji}>{card.romaji}</span>
                        </div>
                        <div style={styles.cardTranslation}>
                          {card.translation}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        style={styles.btnDeleteCard}
                        title="Supprimer la carte"
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Zone d'annonce aria-live pour les lecteurs d'écran (A11y) */}
      <div 
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          border: 0
        }}
        aria-live="polite"
      >
        {ariaAnnouncement}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#121212",
    color: "#ffffff",
  },
  contentWrapper: {
    padding: "40px 20px",
    maxWidth: "900px",
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#aaaaaa",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "25px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  pageTitle: {
    fontSize: "2rem",
    fontWeight: "800",
    color: "#f8fafc",
    margin: "0 0 8px 0",
  },
  subTitle: {
    fontSize: "1rem",
    color: "#94a3b8",
    margin: 0,
  },
  btnBack: {
    padding: "10px 18px",
    background: "#2d2d2d",
    color: "#cbd5e1",
    border: "1px solid #3f3f3f",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
    outline: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  cardContainerCompact: {
    backgroundColor: "#1e1e1e",
    padding: "15px 20px",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    marginBottom: "30px",
    border: "1px solid #2d2d2d",
  },
  createForm: {
    display: "flex",
    gap: "12px",
  },
  createInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #3f3f3f",
    background: "#2c2c2c",
    color: "white",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  btnCreate: {
    padding: "12px 24px",
    background: "#2563eb",
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'background-color 0.2s ease'
  },
  decksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "20px",
    marginBottom: "40px",
  },
  deckCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    border: "1px solid #2d2d2d",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: "180px",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  deckHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },
  deckTitle: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#f8fafc",
    wordBreak: "break-word",
  },
  totalBadge: {
    backgroundColor: "#2d2d2d",
    color: "#cbd5e1",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: "600",
    whiteSpace: "nowrap",
  },
  deckStatusRow: {
    margin: "15px 0",
  },
  dueBadge: {
    backgroundColor: "#3f1a1a",
    color: "#fca5a5",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: "700",
    display: "inline-block",
  },
  completedBadge: {
    backgroundColor: "#143a1d",
    color: "#86efac",
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "0.85rem",
    fontWeight: "600",
    display: "inline-block",
  },
  deckActions: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: "8px",
    marginTop: "10px",
  },
  btnStudy: {
    padding: "10px",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
    transition: "all 0.2s ease",
  },
  btnStudyFree: {
    padding: "10px",
    background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
    transition: "all 0.2s ease",
  },
  btnStudyDisabled: {
    padding: "10px",
    backgroundColor: "#2d2d2d",
    color: "#64748b",
    border: "1px solid #3f3f3f",
    borderRadius: "8px",
    cursor: "not-allowed",
    fontSize: "0.9rem",
    fontWeight: "600",
  },
  btnEdit: {
    padding: "10px",
    backgroundColor: "#1e1e1e",
    color: "#cbd5e1",
    border: "1px solid #3f3f3f",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  btnDeleteDeck: {
    padding: "10px",
    backgroundColor: "#3f1a1a",
    color: "#fca5a5",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
  progressText: {
    fontSize: "1rem",
    fontWeight: "700",
    color: "#60a5fa",
    marginTop: "4px",
    display: "inline-block",
  },
  progressBarBg: {
    width: "100%",
    height: "6px",
    backgroundColor: "#2d2d2d",
    borderRadius: "3px",
    marginBottom: "30px",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  studyCard: {
    backgroundColor: "#1e1e1e",
    padding: "40px 30px",
    borderRadius: "20px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
    border: "1px solid #2d2d2d",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  cardSectionRecto: {
    textAlign: "center",
    margin: "20px 0 30px 0",
  },
  kanaText: {
    fontSize: "3.5rem",
    color: "#f8fafc",
    margin: 0,
    fontWeight: "700",
    letterSpacing: "1px",
  },
  btnAudio: {
    background: "none",
    border: "none",
    fontSize: "30px",
    cursor: "pointer",
    padding: "5px",
    transition: "transform 0.1s ease",
  },
  cardSectionVerso: {
    animation: "fadeIn 0.25s ease-out",
  },
  divider: {
    margin: "20px 0",
    border: "none",
    borderTop: "1px dashed #3f3f3f",
  },
  romajiText: {
    fontSize: "1.25rem",
    color: "#94a3b8",
    fontStyle: "italic",
    textAlign: "center",
    margin: "0 0 10px 0",
  },
  translationText: {
    fontSize: "2.25rem",
    color: "#4ade80",
    textAlign: "center",
    margin: "10px 0 20px 0",
    fontWeight: "800",
  },
  contextNote: {
    backgroundColor: "#3a2a0a",
    color: "#fde047",
    padding: "10px 15px",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "500",
    margin: "0 auto 20px auto",
    maxWidth: "500px",
    textAlign: "center",
  },
  breakdownContainer: {
    backgroundColor: "#151515",
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid #2d2d2d",
    marginTop: "25px",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  breakdownItem: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "8px 0",
    borderBottom: "1px solid #252525",
    fontSize: "0.9rem",
    color: "#cbd5e1",
  },
  grammarTag: {
    backgroundColor: "#172554",
    color: "#60a5fa",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "600",
    marginLeft: "10px",
  },
  buttonsContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginTop: "40px",
  },
  btnReview: {
    padding: "16px 10px",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "1.1rem",
    fontWeight: "700",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.1s ease, filter 0.2s ease",
    boxShadow: "0 4px 6px rgba(0,0,0,0.2)",
  },
  smallLabel: {
    fontSize: "0.75rem",
    fontWeight: "500",
    opacity: 0.85,
    marginTop: "4px",
    textAlign: "center",
  },
  btnShowAnswer: {
    padding: "16px 32px",
    background: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "1.2rem",
    fontWeight: "600",
    width: "100%",
    maxWidth: "320px",
    boxShadow: "0 8px 16px rgba(37, 99, 235, 0.3)",
    transition: "all 0.2s ease",
  },
  renameForm: {
    display: "flex",
    gap: "12px",
  },
  renameInput: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #3f3f3f",
    fontSize: "1rem",
    outline: "none",
    background: "#2c2c2c",
    color: "white",
  },
  btnRename: {
    padding: "12px 24px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: "15px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  editCardsSection: {
    marginTop: "10px",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    backgroundColor: "#1e1e1e",
    borderRadius: "12px",
    border: "1px dashed #3f3f3f",
    color: "#94a3b8",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  editCardsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  editCardItem: {
    backgroundColor: "#1e1e1e",
    padding: "18px 24px",
    borderRadius: "12px",
    border: "1px solid #2d2d2d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    transition: "box-shadow 0.2s ease",
  },
  editCardDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  cardTextSource: {
    fontSize: "1.4rem",
    fontWeight: "700",
    color: "#f8fafc",
  },
  cardRomaji: {
    fontSize: "0.95rem",
    color: "#94a3b8",
    fontStyle: "italic",
  },
  cardTranslation: {
    fontSize: "1.05rem",
    color: "#4ade80",
    fontWeight: "600",
  },
  btnDeleteCard: {
    padding: "8px 16px",
    backgroundColor: "#3f1a1a",
    color: "#fca5a5",
    border: "1px solid #ef4444",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },
};
