import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../../components/Navbar/Navbar';
import { HIRAGANA, KATAKANA, KANJI_N5 } from './alphabetData';
import { toast } from 'react-hot-toast';

function Alphabets() {
  const [activeTab, setActiveTab] = useState('hiragana'); // 'hiragana', 'katakana', 'kanji'
  const [selectedChar, setSelectedChar] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef(null);
  const lastX = useRef(0);
  const lastY = useRef(0);

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

  // Dessiner le guide dans le canvas à chaque changement de sélection
  useEffect(() => {
    if (selectedChar && selectedChar.char) {
      // Un court délai permet au DOM du canvas de s'initialiser
      const timer = setTimeout(() => {
        drawGuide(selectedChar.char);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedChar]);

  // Prononciation par synthèse vocale du navigateur
  const playPronunciation = (char) => {
    if (!char) return;
    if ('speechSynthesis' in window) {
      // Annuler toute synthèse en cours pour éviter la file d'attente
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(char);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85; // Légèrement plus lent pour une meilleure écoute
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error("Votre navigateur ne prend pas en charge la prononciation vocale.");
    }
  };

  // Dessiner la grille de repères et le caractère d'arrière-plan
  const drawGuide = (char) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Nettoyage complet
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Lignes de guidage (Dashed)
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Ligne centrale horizontale
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    
    // Ligne centrale verticale
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    
    ctx.setLineDash([]); // Reset dash

    // Dessiner le caractère en filigrane (gris clair)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.font = 'bold 160px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, canvas.width / 2, canvas.height / 2);
  };

  // Gestionnaires de tracé sur Canvas
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
    
    // Calculer les coordonnées adaptées aux dimensions du canvas interne
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
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.strokeStyle = '#8b5cf6'; // Violet de notre charte graphique
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (selectedChar) {
      drawGuide(selectedChar.char);
    }
  };

  const handleCharClick = (charObj) => {
    if (!charObj.char) return; // Ignorer les cases vides de la grille
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
          // Si case vide (utilisé pour aligner la grille de kana)
          if (!charObj.char) {
            return <div key={`empty-${index}`} style={{ aspectRatio: '1/1' }} />;
          }

          const isSelected = selectedChar && selectedChar.char === charObj.char;

          return (
            <button
              key={index}
              onClick={() => handleCharClick(charObj)}
              style={{
                aspectRatio: '1/1',
                background: isSelected ? 'rgba(139, 92, 246, 0.15)' : '#18181c',
                border: isSelected ? '2px solid #8b5cf6' : '1px solid #27272a',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isSelected ? '#c084fc' : '#f8fafc',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 0 15px rgba(139, 92, 246, 0.25)' : 'none',
                outline: 'none',
                padding: '6px'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#4b5563';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#27272a';
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
          
          {/* Menu d'onglets premium */}
          <div style={{ display: 'flex', background: '#111113', borderRadius: '12px', padding: '6px', border: '1px solid #1f1f23', width: 'fit-content' }}>
            {['hiragana', 'katakana', 'kanji'].map((tab) => (
              <button
                key={tab}
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

          {/* Grille des caractères */}
          {renderGrid()}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
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
                        transition: 'all 0.2s'
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
                  </div>
                  <p style={{ margin: '4px 0 0 0', color: '#a1a1aa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                    Romaji: <span style={{ color: '#8b5cf6' }}>{selectedChar.romaji}</span>
                  </p>
                </div>

                <span style={{ fontSize: '0.75rem', background: '#1e1e24', color: '#94a3b8', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, textTransform: 'uppercase', border: '1px solid #27272a' }}>
                  {activeTab}
                </span>
              </div>

              {/* Sens (Pour Kanji) */}
              {selectedChar.meaning && (
                <div className="analysis-card" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Signification</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981' }}>{selectedChar.meaning}</div>
                </div>
              )}

              {/* Zone d'écriture interactive (Tracé Libre + Guide de repères) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>✍️ Entraînement au tracé</span>
                  <button
                    onClick={clearCanvas}
                    style={{
                      background: 'transparent',
                      color: '#f87171',
                      border: '1px solid rgba(248, 113, 113, 0.2)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Effacer
                  </button>
                </div>

                <div 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    background: '#09090b',
                    borderRadius: '12px',
                    border: '1px dashed #27272a',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: '220px'
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={300}
                    height={300}
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
                </div>
                <div style={{ fontSize: '0.75rem', color: '#71717a', textAlign: 'center', fontStyle: 'italic' }}>
                  Tracez le caractère en suivant le modèle. (Écriture libre)
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
