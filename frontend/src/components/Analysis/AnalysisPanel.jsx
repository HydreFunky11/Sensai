import React, { useState, useEffect } from 'react';
import { getAudioUrl, createFlashcard, getDecks, createDeck } from '../../api/client';

export function AnalysisPanel({ analysis }) {
  const [saving, setSaving] = useState(false);
  const [savedText, setSavedText] = useState(null);
  
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);

  useEffect(() => {
    loadDecks();
  }, []);

  async function loadDecks() {
    try {
      const data = await getDecks();
      setDecks(data);
      if (data.length > 0 && !selectedDeckId) {
        setSelectedDeckId(data[0].id);
      }
    } catch (e) {
      console.error("Impossible de charger les dossiers", e);
    }
  }

  const handleCreateDeck = async () => {
    if (!newDeckTitle.trim()) return;
    try {
      const deck = await createDeck(newDeckTitle);
      await loadDecks();
      setSelectedDeckId(deck.id);
      setNewDeckTitle('');
      setShowNewDeckForm(false);
    } catch (e) {
      alert("Erreur création dossier");
    }
  };

  const playAudio = (text) => {
    if (!text) return;
    const url = getAudioUrl(text);
    const audio = new Audio(url);
    audio.play();
  };

  // Sauvegarder la phrase complète
  const handleSaveFull = async () => {
    if (!analysis) return;
    await saveCard({
      text_source: analysis.original,
      translation: analysis.translation,
      romaji: analysis.romaji,
      breakdown: analysis.breakdown,
      deck_id: selectedDeckId || null
    }, 'full');
  };

  // Sauvegarder un mot individuel
  const handleSaveWord = async (item) => {
    await saveCard({
      text_source: item.word,
      translation: item.meaning,
      romaji: item.romanji,
      context_note: `Tiré de: ${analysis.original}`,
      deck_id: selectedDeckId || null
    }, item.word);
  };

  const saveCard = async (data, id) => {
    setSaving(true);
    try {
      await createFlashcard(data);
      setSavedText(id);
      setTimeout(() => setSavedText(null), 2000);
    } catch (e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!analysis) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: "300px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#bdc3c7",
          border: "2px dashed #bdc3c7",
          borderRadius: "10px",
        }}
      >
        <p>Sélectionnez une zone pour voir la traduction ici</p>
      </div>
    );
  }

  return (
    <aside
      aria-label="Analyse et traduction"
      style={{
        flex: 1,
        minWidth: "300px",
        overflowY: "auto",
        height: "100%",
        paddingRight: "5px",
        display: "flex",
        flexDirection: "column",
        gap: "15px"
      }}
    >
      {/* --- SELECTION DU DOSSIER --- */}
      <section style={{ background: "white", padding: "15px", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <h3 id="deck-select-label" style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#2c3e50" }}>📁 Dossier de destination</h3>
        
        {showNewDeckForm ? (
          <div style={{ display: 'flex', gap: '5px' }}>
            <input 
              value={newDeckTitle} 
              onChange={e => setNewDeckTitle(e.target.value)} 
              placeholder="Nouveau dossier..."
              aria-label="Nom du nouveau dossier"
              style={{ flex: 1, padding: "5px" }}
            />
            <button 
              onClick={handleCreateDeck} 
              aria-label="Confirmer la création du dossier"
              style={{ background: "#27ae60", color: "white", border: "none", padding: "5px 10px", borderRadius: "3px" }}
            >
              ✓
            </button>
            <button 
              onClick={() => setShowNewDeckForm(false)} 
              aria-label="Annuler la création"
              style={{ background: "#e74c3c", color: "white", border: "none", padding: "5px 10px", borderRadius: "3px" }}
            >
              ✗
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <select 
              value={selectedDeckId} 
              onChange={e => setSelectedDeckId(e.target.value)}
              aria-labelledby="deck-select-label"
              style={{ flex: 1, padding: "5px" }}
            >
              {decks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <button 
              onClick={() => setShowNewDeckForm(true)}
              aria-label="Créer un nouveau dossier"
              style={{ background: "#3498db", color: "white", border: "none", padding: "5px 10px", borderRadius: "3px", cursor: "pointer" }}
            >
              + Nouveau
            </button>
          </div>
        )}
      </section>

      {/* --- PHRASE COMPLETE --- */}
      <article
        aria-live="polite"
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            borderBottom: "1px solid #eee",
            paddingBottom: "10px",
            marginBottom: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <h2 style={{ margin: 0, color: "#2c3e50" }}>
                {analysis.original}
              </h2>
              <button
                onClick={() => playAudio(analysis.original)}
                aria-label={`Écouter la prononciation de ${analysis.original}`}
                style={{
                  cursor: "pointer",
                  border: "none",
                  background: "none",
                  fontSize: "20px",
                }}
              >
                🔊
              </button>
            </div>
            <p style={{ color: "#7f8c8d", fontStyle: "italic", margin: "5px 0 0 0" }}>
              {analysis.romaji}
            </p>
          </div>
          <button
            onClick={handleSaveFull}
            disabled={saving || savedText === 'full'}
            aria-label={savedText === 'full' ? "Phrase sauvegardée" : "Sauvegarder la phrase complète comme fiche de révision"}
            style={{
              cursor: (saving || savedText === 'full') ? "default" : "pointer",
              background: savedText === 'full' ? "#27ae60" : "#3498db",
              color: "white",
              border: "none",
              padding: "8px 12px",
              borderRadius: "5px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {savedText === 'full' ? "✅" : "💾 Fiche"}
          </button>
        </div>

        <h3 style={{ color: "#27ae60", marginTop: "10px" }}>{analysis.translation}</h3>

        {/* --- MOTS INDIVIDUELS --- */}
        <div
          role="list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "15px",
          }}
        >
          {analysis.breakdown?.map((item, i) => (
            <div
              key={i}
              role="listitem"
              style={{
                background: "#f8f9fa",
                padding: "8px",
                borderLeft: "3px solid #3498db",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <strong style={{ color: "#3498db", fontSize: "1.2em" }}>
                    {item.word} {item.romanji ? ` (${item.romanji})` : ""}
                  </strong>{" "}
                  <span style={{ fontSize: "0.8em", color: "#7f8c8d" }}>
                    ({item.type})
                  </span>
                  <div style={{ fontSize: "0.9em", color: "#7f8c8d" }}>
                    {item.meaning}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <button
                    onClick={() => playAudio(item.word)}
                    aria-label={`Écouter la prononciation de ${item.word}`}
                    style={{
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      fontSize: "18px",
                    }}
                  >
                    🔊
                  </button>
                  <button
                    onClick={() => handleSaveWord(item)}
                    disabled={saving || savedText === item.word}
                    aria-label={savedText === item.word ? "Mot sauvegardé" : `Sauvegarder le mot ${item.word} comme fiche`}
                    style={{
                      cursor: (saving || savedText === item.word) ? "default" : "pointer",
                      background: savedText === item.word ? "#27ae60" : "transparent",
                      color: savedText === item.word ? "white" : "#7f8c8d",
                      border: "1px solid " + (savedText === item.word ? "#27ae60" : "#bdc3c7"),
                      borderRadius: "3px",
                      padding: "2px 5px",
                      fontSize: "12px",
                    }}
                  >
                    {savedText === item.word ? "✅" : "+ Add"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </aside>
  );
}
