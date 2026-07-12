import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from '../../components/Navbar/Navbar';
import { HIRAGANA, KATAKANA, KANJI_N5 } from './alphabetData';
import { toast } from 'react-hot-toast';
import { getDecks, createFlashcard, toggleLearnedCharacter, getLearnedCharacters } from '../../api/client';

function Alphabets() {
  const [activeTab, setActiveTab] = useState('hiragana'); // 'hiragana', 'katakana', 'kanji'
  const [selectedChar, setSelectedChar] = useState(null);
  const [mode, setMode] = useState('guided'); // 'free' or 'guided'
  const [isDrawing, setIsDrawing] = useState(false);

  // États pour le dossier de révision
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  // État pour les caractères appris (connu)
  const [learnedChars, setLearnedChars] = useState(new Set());
  const [togglingLearned, setTogglingLearned] = useState(false);

  // États pour le mode Guidé (KanjiVG)
  const [loadingSVG, setLoadingSVG] = useState(false);
  const [strokesData, setStrokesData] = useState([]); // Tableau de tableaux de {x, y}
  const [currentStrokeIndex, setCurrentStrokeIndex] = useState(0);
  const [completedStrokes, setCompletedStrokes] = useState([]); // Liste des tracés validés
  const [svgUnavailable, setSvgUnavailable] = useState(false);

  const canvasRef = useRef(null);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const userStrokePoints = useRef([]);

  // Charger les dossiers de révision et les caractères appris au montage
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const fetchedDecks = await getDecks();
        setDecks(fetchedDecks);
        if (fetchedDecks.length > 0) {
          setSelectedDeckId(fetchedDecks[0].id);
        }
      } catch (e) {
        console.error("Erreur chargement dossiers de révision:", e);
      }

      try {
        const chars = await getLearnedCharacters();
        setLearnedChars(new Set(chars));
      } catch (e) {
        console.error("Erreur chargement caractères appris:", e);
      }
    };
    loadInitialData();
  }, []);

  const handleSaveToDeck = async () => {
    if (!selectedChar || !selectedDeckId) {
      toast.error("Veuillez sélectionner un caractère et un dossier");
      return;
    }
    setSavingCard(true);
    try {
      const cardData = {
        deck_id: parseInt(selectedDeckId, 10),
        text_source: selectedChar.char,
        translation: selectedChar.meaning || selectedChar.char,
        romaji: selectedChar.romaji,
        context_note: 'character',
      };
      await createFlashcard(cardData);
      toast.success(`Caractère "${selectedChar.char}" ajouté au dossier de révision !`);
    } catch (err) {
      toast.error(err.detail || err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSavingCard(false);
    }
  };

  const handleToggleLearned = async () => {
    if (!selectedChar) return;
    setTogglingLearned(true);
    try {
      const res = await toggleLearnedCharacter(selectedChar.char, activeTab);
      const updated = new Set(learnedChars);
      if (res.status === 'added') {
        updated.add(selectedChar.char);
        toast.success(`Caractère "${selectedChar.char}" marqué comme connu !`);
      } else {
        updated.delete(selectedChar.char);
        toast.success(`Caractère "${selectedChar.char}" retiré de la liste des connus.`);
      }
      setLearnedChars(updated);
    } catch (err) {
      toast.error(err.message || "Erreur lors du changement de statut");
    } finally {
      setTogglingLearned(false);
    }
  };

  // Charger le premier caractère par défaut à l'ouverture ou au changement d'onglet
  useEffect(() => {
    if (activeTab === 'hiragana') {
      setSelectedChar(HIRAGANA[0]);
    } else if (activeTab === 'katakana') {
      setSelectedChar(KATAKANA[0]);
    } else if (activeTab === 'kanji') {
      setSelectedChar(KANJI_N5[0]);
    }
  }, [activeTab]);

  // Charger l'ordre des tracés en mode guidé
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
        return getPathPoints(d, 25); // Échantillonner 25 points par trait
      });
      
      setStrokesData(parsedStrokes);
      console.log(`✅ ${parsedStrokes.length} tracés chargés pour ${char}`);
    } catch (err) {
      console.warn("Impossible de charger le tracé KanjiVG:", err);
      setSvgUnavailable(true);
      // Fallback automatique en mode libre en cas d'erreur de chargement
      setMode('free');
      toast.error("Modèle de tracé guidé indisponible. Passage en écriture libre.");
    } finally {
      setLoadingSVG(false);
    }
  };

  // Convertir le d d'un chemin SVG en points échantillonnés et mis à l'échelle
  const getPathPoints = (pathD, sampleCount = 25) => {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', pathD);
    const totalLength = pathEl.getTotalLength();
    const points = [];
    const canvasWidth = 300; // Largeur fixe interne
    const scale = canvasWidth / 109; // Grille d'origine de KanjiVG (109x109)

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

  // Gérer le changement de caractère ou de mode
  useEffect(() => {
    if (selectedChar && selectedChar.char) {
      if (mode === 'guided') {
        fetchStrokeOrder(selectedChar.char);
      } else {
        const timer = setTimeout(() => {
          drawFreeGuide(selectedChar.char);
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedChar, mode]);

  // Redessiner le canvas guidé lorsque l'état progresse
  useEffect(() => {
    if (mode === 'guided' && strokesData.length > 0) {
      drawGuidedGuide();
    }
  }, [strokesData, currentStrokeIndex, completedStrokes, mode]);

  // Prononciation par synthèse vocale du navigateur
  const playPronunciation = (char) => {
    if (!char) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(char);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error("Votre navigateur ne prend pas en charge la prononciation vocale.");
    }
  };

  // Dessin du filigrane d'aide en mode écriture libre
  const drawFreeGuide = (char) => {
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
    
    ctx.setLineDash([]); // Reset dash

    // Modèle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.font = 'bold 180px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, canvas.width / 2, canvas.height / 2);
  };

  // Dessin du canevas en mode guidé pas-à-pas
  const drawGuidedGuide = () => {
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

    // 3. Dessiner le badge indicateur de début de tracé du trait en cours
    if (currentStrokeIndex < strokesData.length && strokesData[currentStrokeIndex]) {
      const activeStroke = strokesData[currentStrokeIndex];
      const startPt = activeStroke[0];
      
      // Petit rond bleu
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(startPt.x - 14, startPt.y - 14, 11, 0, Math.PI * 2);
      ctx.fill();
      
      // Numéro
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(currentStrokeIndex + 1, startPt.x - 14, startPt.y - 14);
    }
  };

  // Coordonnées du curseur/doigt
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
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);
    lastX.current = x;
    lastY.current = y;
    
    userStrokePoints.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    // Dessiner en violet néon (tracé temporaire utilisateur)
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
    if (!isDrawing) return;
    setIsDrawing(false);

    if (mode === 'guided') {
      validateUserStroke();
    }
  };

  // Algorithme de validation avec 30%+ de tolérance
  const validateUserStroke = () => {
    const pts = userStrokePoints.current;
    if (pts.length < 5) {
      // Trop court : tracé annulé et réinitialisé
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

    // Seuil de validation : ~95px sur un canevas de 300px (marge d'erreur de plus de 30%)
    const threshold = 95;

    console.log(`[Validation trait ${currentStrokeIndex + 1}] Décalages:`, { Début: startDist, Milieu: midDist, Fin: endDist });

    if (startDist < threshold && endDist < threshold && midDist < threshold) {
      // Trait valide
      toast.success(`Trait ${currentStrokeIndex + 1} validé !`, { id: 'stroke-toast', duration: 800 });
      
      const newCompleted = [...completedStrokes, targetStroke];
      setCompletedStrokes(newCompleted);
      
      const nextIndex = currentStrokeIndex + 1;
      setCurrentStrokeIndex(nextIndex);
      
      // Tout le caractère a été complété !
      if (nextIndex >= strokesData.length) {
        toast.success(`🎉 Excellent ! Écriture complétée avec succès !`, { duration: 2500 });
        playPronunciation(selectedChar.char);
      }
    } else {
      // Erreur de sens ou de tracé
      toast.error("Tracé incorrect. Suivez le guide et respectez le sens !", { id: 'stroke-toast', duration: 1200 });
      // Efface le tracé utilisateur erroné et redessine le guide
      drawGuidedGuide();
    }
  };

  const resetWriting = () => {
    if (mode === 'guided') {
      setCompletedStrokes([]);
      setCurrentStrokeIndex(0);
    } else if (selectedChar) {
      drawFreeGuide(selectedChar.char);
    }
  };

  const handleCanvasKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      resetWriting();
      toast.success("Zone de dessin réinitialisée", { id: 'canvas-reset', duration: 1000 });
    }
  };

  const handleCharClick = (charObj) => {
    if (!charObj.char) return; // Case vide de la grille
    setSelectedChar(charObj);
  };

  const renderGrid = () => {
    let charList = [];
    if (activeTab === 'hiragana') charList = HIRAGANA;
    else if (activeTab === 'katakana') charList = KATAKANA;
    else if (activeTab === 'kanji') charList = KANJI_N5;

    return (
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: activeTab === 'kanji' ? 'repeat(auto-fill, minmax(80px, 1fr))' : 'repeat(5, 1fr)',
          gap: '12px',
          width: '100%',
          maxHeight: 'calc(100vh - 210px)',
          overflowY: 'auto',
          paddingRight: '8px'
        }}
      >
        {charList.map((charObj, index) => {
          if (!charObj.char) {
            return <div key={`empty-${index}`} style={{ aspectRatio: '1/1' }} />;
          }

          const isSelected = selectedChar && selectedChar.char === charObj.char;
          const isLearned = learnedChars.has(charObj.char);

          let btnBackground = '#18181c';
          let btnBorder = '1px solid #27272a';
          let btnColor = '#f8fafc';
          let btnShadow = 'none';

          if (isSelected) {
            if (isLearned) {
              btnBackground = 'rgba(16, 185, 129, 0.2)';
              btnBorder = '2px solid #10b981';
              btnColor = '#a7f3d0';
              btnShadow = '0 0 15px rgba(16, 185, 129, 0.35)';
            } else {
              btnBackground = 'rgba(139, 92, 246, 0.15)';
              btnBorder = '2px solid #8b5cf6';
              btnColor = '#c084fc';
              btnShadow = '0 0 15px rgba(139, 92, 246, 0.25)';
            }
          } else if (isLearned) {
            btnBackground = 'rgba(16, 185, 129, 0.08)';
            btnBorder = '1px solid rgba(16, 185, 129, 0.35)';
            btnColor = '#a7f3d0';
          }

          return (
            <button
              key={index}
              onClick={() => handleCharClick(charObj)}
              className="a11y-grid-btn"
              aria-label={`${charObj.char}, prononcé ${charObj.romaji}. ${isLearned ? 'Caractère connu' : 'Non appris'}. ${isSelected ? 'Sélectionné' : 'Cliquer pour étudier'}`}
              aria-pressed={isSelected}
              style={{
                aspectRatio: '1/1',
                background: btnBackground,
                border: btnBorder,
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: btnColor,
                transition: 'all 0.2s ease',
                boxShadow: btnShadow,
                padding: '6px'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = isLearned ? 'rgba(16, 185, 129, 0.7)' : '#4b5563';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = isLearned ? 'rgba(16, 185, 129, 0.35)' : '#27272a';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <span style={{ fontSize: activeTab === 'kanji' ? '1.5rem' : '1.8rem', fontWeight: 700 }}>
                {charObj.char}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', textTransform: 'lowercase' }}>
                {charObj.romaji}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0c0c0e', color: '#f8fafc', overflow: 'hidden' }}>
      <Navbar />

      <main style={{ display: 'flex', flex: 1, padding: '24px', gap: '24px', boxSizing: 'border-box', height: 'calc(100vh - 64px)' }}>
        
        {/* Panneau gauche : Sélections & Grilles */}
        <section style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          
          <div role="tablist" aria-label="Sélection de l'alphabet" style={{ display: 'flex', background: '#111113', borderRadius: '12px', padding: '6px', border: '1px solid #1f1f23', width: 'fit-content' }}>
            {['hiragana', 'katakana', 'kanji'].map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls="alphabet-tab-panel"
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'transparent',
                  color: activeTab === tab ? 'white' : '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'kanji' ? 'Kanji (N5)' : tab}
              </button>
            ))}
          </div>

          <div id="alphabet-tab-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} style={{ width: '100%' }}>
            {renderGrid()}
          </div>
        </section>

        {/* Panneau droit : Fiche d'étude active */}
        <section 
          className="analysis-aside" 
          style={{ 
            flex: 0.9, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            borderRadius: '16px', 
            border: '1px solid #1f1f23',
            background: '#111113',
            padding: '24px',
            boxSizing: 'border-box',
            maxWidth: '440px'
          }}
        >
          {selectedChar ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              
              {/* Entête Fiche */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '3.5rem', fontWeight: 800, color: '#f8fafc' }}>
                      {selectedChar.char}
                    </span>
                    <button
                      onClick={() => playPronunciation(selectedChar.char)}
                      aria-label="Écouter la prononciation"
                      style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        color: '#c084fc',
                        borderRadius: '50%',
                        width: '44px',
                        height: '44px',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#8b5cf6';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                        e.currentTarget.style.color = '#c084fc';
                      }}
                    >
                      🔊
                    </button>

                    <button
                      onClick={handleToggleLearned}
                      disabled={togglingLearned}
                      style={{
                        background: learnedChars.has(selectedChar.char) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        border: learnedChars.has(selectedChar.char) ? '1px solid #10b981' : '1px solid #27272a',
                        color: learnedChars.has(selectedChar.char) ? '#10b981' : '#cbd5e1',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        cursor: togglingLearned ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        transition: 'all 0.2s',
                        outline: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        height: '34px',
                        boxShadow: learnedChars.has(selectedChar.char) ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (!togglingLearned) {
                          e.currentTarget.style.background = learnedChars.has(selectedChar.char) ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = learnedChars.has(selectedChar.char) ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      {learnedChars.has(selectedChar.char) ? '✓ Connu' : 'Je connais'}
                    </button>
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: '#a1a1aa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                    Romaji: <span style={{ color: '#8b5cf6' }}>{selectedChar.romaji}</span>
                  </p>
                </div>

                <span style={{ fontSize: '0.75rem', background: '#1e1e24', color: '#94a3b8', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid #27272a' }}>
                  {activeTab}
                </span>
              </div>

              {/* Signification (Kanji) */}
              {selectedChar.meaning && (
                <div className="analysis-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Signification</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981' }}>{selectedChar.meaning}</div>
                </div>
              )}

              {/* Zone d'écriture interactive */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  {/* Sélecteur de mode d'écriture */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>✍️ Écriture</span>
                    <div style={{ display: 'flex', background: '#18181b', borderRadius: '8px', padding: '2px', border: '1px solid #27272a' }}>
                      <button
                        onClick={() => setMode('guided')}
                        disabled={svgUnavailable}
                        style={{
                          background: mode === 'guided' ? '#8b5cf6' : 'transparent',
                          color: mode === 'guided' ? 'white' : '#94a3b8',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: svgUnavailable ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Guidé
                      </button>
                      <button
                        onClick={() => setMode('free')}
                        style={{
                          background: mode === 'free' ? '#8b5cf6' : 'transparent',
                          color: mode === 'free' ? 'white' : '#94a3b8',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        Libre
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={resetWriting}
                    style={{
                      background: 'transparent',
                      color: '#f87171',
                      border: '1px solid rgba(248, 113, 113, 0.2)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {mode === 'guided' ? 'Recommencer' : 'Effacer'}
                  </button>
                </div>

                <div 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#09090b',
                    borderRadius: '16px',
                    border: '1px dashed #27272a',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '300px'
                  }}
                >
                  {loadingSVG ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <div className="glass-loader-spinner" style={{ width: '35px', height: '35px', margin: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Chargement des tracés...</span>
                    </div>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={300}
                      tabIndex={0}
                      className="a11y-canvas"
                      aria-label={`Zone de dessin pour le caractère ${selectedChar.char}. Mode ${mode === 'guided' ? 'guidé pas-à-pas' : 'libre'}. Appuyez sur Echap pour recommencer.`}
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
                        cursor: 'crosshair',
                        width: '100%',
                        height: '100%',
                        maxHeight: '300px',
                        maxWidth: '300px',
                      }}
                    />
                  )}
                </div>
                
                <div style={{ fontSize: '0.75rem', color: '#71717a', textAlign: 'center', fontStyle: 'italic' }}>
                  {mode === 'guided' 
                    ? `Tracez le trait ${currentStrokeIndex + 1} (indiqué par le numéro bleu) dans le bon sens.` 
                    : "Entraînement en écriture libre sur le modèle en filigrane."}
                </div>
              </div>

              {/* Ajouter au dossier de révision */}
              <div 
                style={{ 
                  marginTop: '10px', 
                  paddingTop: '16px', 
                  borderTop: '1px solid #1f1f23',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
                  📁 Ajouter aux révisions
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    style={{
                      flex: 1,
                      background: '#18181b',
                      color: '#f8fafc',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {decks.length === 0 ? (
                      <option value="">Aucun dossier disponible</option>
                    ) : (
                      decks.map(deck => (
                        <option key={deck.id} value={deck.id}>
                          {deck.title}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    onClick={handleSaveToDeck}
                    disabled={savingCard || !selectedDeckId}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: (savingCard || !selectedDeckId) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap',
                      opacity: (savingCard || !selectedDeckId) ? 0.6 : 1
                    }}
                  >
                    {savingCard ? 'Enregistrement...' : '💾 Enregistrer'}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#71717a', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✏️</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Sélectionnez un caractère dans la grille de gauche pour commencer l'étude.</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default Alphabets;
