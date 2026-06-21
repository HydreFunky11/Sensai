import React, { useState, useEffect } from 'react';
import { getAudioUrl, createFlashcard, getDecks, createDeck } from '../../api/client';
import { toast } from 'react-hot-toast';

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
      toast.error("Erreur création dossier");
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
      toast.success("Fiche créée avec succès !");
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde : " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!analysis) {
    return (
      <div className="analysis-placeholder">
        <div className="analysis-placeholder-icon">🏮</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#cbd5e1', fontWeight: 600 }}>Aucune sélection</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
          Dessinez un rectangle sur l'image ou cliquez sur une bulle pour afficher sa traduction et l'analyse grammaticale ici.
        </p>
      </div>
    );
  }

  return (
    <aside aria-label="Analyse et traduction" className="analysis-aside">
      {/* --- SELECTION DU DOSSIER --- */}
      <section className="analysis-card">
        <h3 id="deck-select-label" className="analysis-card-title">
          📂 Dossier cible
        </h3>
        
        {showNewDeckForm ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              value={newDeckTitle} 
              onChange={e => setNewDeckTitle(e.target.value)} 
              placeholder="Nouveau dossier..."
              aria-label="Nom du nouveau dossier"
              style={{
                flex: 1,
                padding: "8px 12px",
                background: "#1e1e24",
                border: "1px solid #2d2d35",
                borderRadius: "8px",
                color: "white",
                fontSize: "0.875rem",
                outline: "none"
              }}
            />
            <button 
              onClick={handleCreateDeck} 
              aria-label="Confirmer la création du dossier"
              className="new-deck-btn"
              style={{ background: "#10b981" }}
            >
              ✓
            </button>
            <button 
              onClick={() => setShowNewDeckForm(false)} 
              aria-label="Annuler la création"
              className="new-deck-btn"
              style={{ background: "#ef4444" }}
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
              className="deck-select-dropdown"
            >
              {decks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
            <button 
              onClick={() => setShowNewDeckForm(true)}
              aria-label="Créer un nouveau dossier"
              className="new-deck-btn"
            >
              + Nouveau
            </button>
          </div>
        )}
      </section>

      {/* --- PHRASE COMPLETE --- */}
      <article aria-live="polite" className="analysis-card">
        <div className="analysis-header">
          <div>
            <div className="original-text-container">
              <h2 className="original-text">{analysis.original}</h2>
              <button
                onClick={() => playAudio(analysis.original)}
                aria-label={`Écouter la prononciation de ${analysis.original}`}
                className="audio-btn"
              >
                🔊
              </button>
            </div>
            <p className="romaji-text">{analysis.romaji}</p>
          </div>
          
          <button
            onClick={handleSaveFull}
            disabled={saving || savedText === 'full'}
            aria-label={savedText === 'full' ? "Phrase sauvegardée" : "Sauvegarder la phrase complète"}
            className={`save-card-btn ${savedText === 'full' ? 'saved' : ''}`}
          >
            {savedText === 'full' ? "Sauvegardé ✓" : "💾 Fiche"}
          </button>
        </div>

        <h3 className="translated-text">{analysis.translation}</h3>

        {/* --- MOTS INDIVIDUELS --- */}
        <div role="list" className="word-breakdown-list">
          {analysis.breakdown?.map((item, i) => (
            <div key={i} role="listitem" className="word-breakdown-item">
              <div style={{ flex: 1, paddingRight: '10px' }}>
                <div>
                  <strong className="word-headword">{item.word}</strong>
                  {item.romanji && <span className="romaji-text" style={{ marginLeft: '6px' }}>({item.romanji})</span>}
                  <span className="word-type">{item.type}</span>
                </div>
                <div className="word-meaning">{item.meaning}</div>
              </div>
              
              <div className="word-action-column">
                <button
                  onClick={() => playAudio(item.word)}
                  aria-label={`Écouter la prononciation de ${item.word}`}
                  className="audio-btn"
                >
                  🔊
                </button>
                <button
                  onClick={() => handleSaveWord(item)}
                  disabled={saving || savedText === item.word}
                  aria-label={savedText === item.word ? "Mot sauvegardé" : `Ajouter aux fiches`}
                  className={`word-add-btn ${savedText === item.word ? 'saved' : ''}`}
                >
                  {savedText === item.word ? "Ajouté ✓" : "+ Ajouter"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </aside>
  );
}
