import React, { useEffect, useState } from 'react';
import { getDueFlashcards, submitCardReview, getAudioUrl, getDecks } from '../../api/client';
import { useNavigate } from 'react-router-dom';

export default function Study() {
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
        const fetchedDecks = await getDecks();
        setDecks(fetchedDecks);
        // On charge toutes les cartes par défaut (selectedDeckId = '')
        await loadCards('');
      } catch(e) {
        console.error(e);
      }
    }
    init();
  }, []);

  async function loadCards(deckId) {
    setLoading(true);
    try {
      const data = await getDueFlashcards(deckId || null);
      setCards(data);
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleDeckChange = (e) => {
    const newDeckId = e.target.value;
    setSelectedDeckId(newDeckId);
    loadCards(newDeckId);
  };

  const playAudio = (text) => {
    if (!text) return;
    const url = getAudioUrl(text);
    const audio = new Audio(url);
    audio.play();
  };

  const handleReview = async (quality) => {
    if (cards.length === 0) return;
    const currentCard = cards[currentIndex];
    
    try {
      await submitCardReview(currentCard.id, quality);
      
      // Passer à la carte suivante
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        // Fin de la session
        setCards([]);
      }
    } catch (err) {
      alert("Erreur lors de la sauvegarde: " + err.message);
    }
  };

  if (loading) return <div style={styles.center}>Chargement des fiches...</div>;
  if (error) return <div style={{...styles.center, color: 'red'}}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: '0 0 10px 0' }}>Révisions</h1>
          <select 
            value={selectedDeckId} 
            onChange={handleDeckChange}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #bdc3c7' }}
          >
            <option value="">Tous les dossiers</option>
            {decks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
        <div>
          {cards.length > 0 && (
            <span style={{ marginRight: '15px', color: '#7f8c8d', fontWeight: 'bold' }}>
              {currentIndex + 1} / {cards.length}
            </span>
          )}
          <button onClick={() => navigate('/home')} style={styles.btnBack}>Retour</button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div style={styles.center}>
          <h2>🎉 Félicitations !</h2>
          <p>Vous avez révisé toutes vos cartes pour ce dossier aujourd'hui.</p>
          <button onClick={() => loadCards(selectedDeckId)} style={styles.btnPrimary}>Vérifier les nouvelles cartes</button>
        </div>
      ) : (
        <div style={styles.cardContainer}>
          {/* RECTO */}
          <div style={styles.cardRecto}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px' }}>
              <h2 style={{ fontSize: '3rem', color: '#2c3e50', margin: 0 }}>{cards[currentIndex].text_source}</h2>
              <button onClick={() => playAudio(cards[currentIndex].text_source)} style={styles.btnAudio}>🔊</button>
            </div>
          </div>

          {/* VERSO (Réponse) */}
          {showAnswer ? (
            <div style={styles.cardVerso}>
              <hr style={{ margin: '20px 0', border: '1px solid #ecf0f1' }} />
              <p style={{ fontSize: '1.2rem', color: '#7f8c8d', fontStyle: 'italic', textAlign: 'center' }}>
                {cards[currentIndex].romaji}
              </p>
              <h3 style={{ fontSize: '2rem', color: '#27ae60', textAlign: 'center', margin: '10px 0' }}>
                {cards[currentIndex].translation}
              </h3>
              
              {/* Découpage grammatical optionnel */}
              {cards[currentIndex].breakdown && cards[currentIndex].breakdown.length > 0 && (
                <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                  {cards[currentIndex].breakdown.map((item, i) => (
                    <div key={i} style={{ marginBottom: '5px', padding: '5px', background: '#f8f9fa', borderRadius: '4px' }}>
                      <strong style={{ color: '#3498db' }}>{item.word}</strong>: {item.meaning} ({item.type})
                    </div>
                  ))}
                </div>
              )}

              {/* Boutons de difficulté type Anki */}
              <div style={styles.buttonsContainer}>
                <button onClick={() => handleReview(1)} style={{...styles.btnReview, background: '#e74c3c'}}>
                  Je ne sais plus<br/><small>(Again)</small>
                </button>
                <button onClick={() => handleReview(2)} style={{...styles.btnReview, background: '#e67e22'}}>
                  Un peu dur<br/><small>(Hard)</small>
                </button>
                <button onClick={() => handleReview(3)} style={{...styles.btnReview, background: '#2ecc71'}}>
                  Je sais<br/><small>(Good)</small>
                </button>
                <button onClick={() => handleReview(4)} style={{...styles.btnReview, background: '#3498db'}}>
                  Trop facile<br/><small>(Easy)</small>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <button onClick={() => setShowAnswer(true)} style={styles.btnShowAnswer}>
                Afficher la réponse
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  btnBack: { padding: '8px 15px', background: '#bdc3c7', color: '#2c3e50', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' },
  btnPrimary: { padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '1.1rem', marginTop: '20px' },
  cardContainer: { background: 'white', padding: '40px', borderRadius: '15px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  cardRecto: { textAlign: 'center', marginBottom: '20px' },
  cardVerso: { animation: 'fadeIn 0.3s ease-in' },
  btnAudio: { background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer' },
  btnShowAnswer: { padding: '15px 30px', background: '#2c3e50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1.2rem', width: '100%', maxWidth: '300px' },
  buttonsContainer: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '40px' },
  btnReview: { padding: '15px 5px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
};
