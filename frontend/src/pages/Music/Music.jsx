import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../../components/Navbar/Navbar';
import { 
  getMusicPresets, 
  resolveSpotifyTrack, 
  getMusicLyrics, 
  getAudioUrl, 
  createFlashcard, 
  getDecks, 
  createDeck 
} from '../../api/client';
import { toast } from 'react-hot-toast';
import './Music.css';

export default function Music() {
  const [query, setQuery] = useState('');
  const [customLyrics, setCustomLyrics] = useState('');
  const [showCustomLyrics, setShowCustomLyrics] = useState(false);
  const [presets, setPresets] = useState([]);
  
  const [track, setTrack] = useState(null);
  const [lyricsData, setLyricsData] = useState(null);
  const [loading, setLoading] = useState(false);

  // État du mode Karaoké interactif et synchronisé
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false);
  const [karaokeTime, setKaraokeTime] = useState(0);
  const [activeLineId, setActiveLineId] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPronounce, setAutoPronounce] = useState(false);

  // Gestion des dossiers de flashcards
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckTitle, setNewDeckTitle] = useState('');
  const [showNewDeckForm, setShowNewDeckForm] = useState(false);
  const [savedLines, setSavedLines] = useState(new Set());
  const [savedWords, setSavedWords] = useState(new Set());

  const timerRef = useRef(null);

  useEffect(() => {
    loadPresets();
    loadDecks();
  }, []);

  async function loadPresets() {
    try {
      const data = await getMusicPresets();
      setPresets(data);
    } catch (err) {
      console.warn("Presets indisponibles :", err);
    }
  }

  async function loadDecks() {
    try {
      const data = await getDecks();
      setDecks(data);
      if (data.length > 0 && !selectedDeckId) {
        setSelectedDeckId(data[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement dossiers :", err);
    }
  }

  // --- LOGIQUE DE SYNCHRONISATION DU KARAOKÉ ---
  useEffect(() => {
    if (!karaokeMode || !isKaraokePlaying || !lyricsData?.lines?.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const lines = lyricsData.lines;
    const lastLine = lines[lines.length - 1];
    const totalDuration = lastLine.time + (lastLine.duration || 5);

    timerRef.current = setInterval(() => {
      setKaraokeTime((prev) => {
        const nextTime = prev + 0.2 * playbackSpeed;
        if (nextTime >= totalDuration) {
          setIsKaraokePlaying(false);
          return 0;
        }

        // Identifier la ligne active à ce timestamp
        const currentLine = lines.find(
          (l) => nextTime >= l.time && nextTime < l.time + (l.duration || 4.5)
        );

        if (currentLine && currentLine.id !== activeLineId) {
          setActiveLineId(currentLine.id);
        }

        return nextTime;
      });
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [karaokeMode, isKaraokePlaying, lyricsData, playbackSpeed, activeLineId]);

  // Défilement automatique fluide vers la ligne de karaoké active
  useEffect(() => {
    if (activeLineId && karaokeMode) {
      const el = document.getElementById(`music-line-${activeLineId}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Lecture vocale optionnelle en synchronisation karaoké
      if (autoPronounce) {
        const line = lyricsData?.lines?.find((l) => l.id === activeLineId);
        if (line) {
          playAudio(line.japanese);
        }
      }
    }
  }, [activeLineId, karaokeMode, autoPronounce]);

  const handleCreateDeck = async () => {
    if (!newDeckTitle.trim()) return;
    try {
      const deck = await createDeck(newDeckTitle);
      await loadDecks();
      setSelectedDeckId(deck.id);
      setNewDeckTitle('');
      setShowNewDeckForm(false);
      toast.success("Dossier créé !");
    } catch (e) {
      toast.error("Erreur création dossier");
    }
  };

  // Traitement d'un lien ou d'une recherche
  const handleSearch = async (overrideQuery = null) => {
    const targetQuery = overrideQuery !== null ? overrideQuery : query;
    if (!targetQuery.trim() && !customLyrics.trim()) {
      toast.error("Veuillez coller un lien Spotify ou saisir un titre de morceau.");
      return;
    }

    setLoading(true);
    setLyricsData(null);
    setIsKaraokePlaying(false);
    setKaraokeTime(0);

    try {
      // 1. Résolution du morceau Spotify
      const isSpotifyUrl = targetQuery.includes("spotify.com") || targetQuery.startsWith("spotify:track:");
      let trackInfo = null;

      try {
        trackInfo = await resolveSpotifyTrack(
          isSpotifyUrl ? targetQuery : "",
          isSpotifyUrl ? "" : targetQuery
        );
        setTrack(trackInfo);
      } catch (e) {
        console.warn("Échec résolution Spotify, poursuite avec titre brut:", e);
        trackInfo = {
          title: targetQuery,
          artist: "",
          embed_url: null
        };
        setTrack(trackInfo);
      }

      // 2. Récupération et analyse linguistique des paroles
      const titleToAnalyze = trackInfo?.title || targetQuery;
      const lyrics = await getMusicLyrics(
        titleToAnalyze,
        trackInfo?.artist || "",
        trackInfo?.track_id || null,
        customLyrics
      );

      setLyricsData(lyrics);
      if (lyrics.lines && lyrics.lines.length > 0) {
        setActiveLineId(lyrics.lines[0].id);
      }
      toast.success("Paroles et analyse chargées !");
    } catch (err) {
      console.error("Erreur analyse musicale:", err);
      toast.error(err.message || "Impossible d'analyser ce morceau.");
    } finally {
      setLoading(false);
    }
  };

  // Sélection d'un preset
  const handleSelectPreset = (preset) => {
    setQuery(preset.spotify_url || `${preset.artist} - ${preset.title}`);
    setTrack({
      track_id: preset.track_id,
      title: preset.title,
      artist: preset.artist,
      thumbnail: preset.thumbnail,
      embed_url: preset.embed_url
    });
    handleSearch(preset.spotify_url || `${preset.artist} - ${preset.title}`);
  };

  // Saut de ligne interactif (au clic sur n'importe quel vers)
  const jumpToLine = (line) => {
    setActiveLineId(line.id);
    setKaraokeTime(line.time || 0);
  };

  // Saut précédent / suivant en karaoké
  const handlePrevLine = () => {
    if (!lyricsData?.lines) return;
    const currentIndex = lyricsData.lines.findIndex((l) => l.id === activeLineId);
    if (currentIndex > 0) {
      jumpToLine(lyricsData.lines[currentIndex - 1]);
    }
  };

  const handleNextLine = () => {
    if (!lyricsData?.lines) return;
    const currentIndex = lyricsData.lines.findIndex((l) => l.id === activeLineId);
    if (currentIndex >= 0 && currentIndex < lyricsData.lines.length - 1) {
      jumpToLine(lyricsData.lines[currentIndex + 1]);
    }
  };

  // Lecture audio d'un texte japonais (TTS)
  const playAudio = (text) => {
    if (!text) return;
    const url = getAudioUrl(text);
    const audio = new Audio(url);
    audio.play();
  };

  // Sauvegarde d'une ligne de parole en carte Anki
  const handleSaveLineCard = async (line) => {
    try {
      await createFlashcard({
        text_source: line.japanese,
        translation: line.translation,
        romaji: line.romaji,
        context_note: `Tiré de: ${track?.title || lyricsData?.title || 'Chanson'} (${track?.artist || lyricsData?.artist || ''})`,
        deck_id: selectedDeckId || null
      });

      setSavedLines((prev) => new Set(prev).add(line.id));
      toast.success("Vers sauvegardé dans vos fiches !");
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde : " + err.message);
    }
  };

  // Sauvegarde d'un mot de vocabulaire de la chanson
  const handleSaveWordCard = async (vocab, lineJapanese = "") => {
    try {
      await createFlashcard({
        text_source: vocab.word,
        translation: vocab.meaning,
        romaji: vocab.romanji || "",
        context_note: lineJapanese ? `Extrait : "${lineJapanese}"` : `Tiré de la chanson ${track?.title || ''}`,
        deck_id: selectedDeckId || null
      });
      setSavedWords((prev) => new Set(prev).add(vocab.word));
      toast.success(`Mot "${vocab.word}" ajouté aux fiches !`);
    } catch (err) {
      toast.error("Erreur sauvegarde : " + err.message);
    }
  };

  // Formatage secondes -> mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalDuration = lyricsData?.lines?.length
    ? lyricsData.lines[lyricsData.lines.length - 1].time +
      (lyricsData.lines[lyricsData.lines.length - 1].duration || 5)
    : 0;

  return (
    <div className="music-page-container">
      <Navbar />

      <main className="music-main-content">
        {/* Hero Section */}
        <section className="music-hero" aria-label="Présentation de SensAI Music">
          <h1 className="music-hero-title">
            <span role="img" aria-label="musique">🎵</span> SensAI Music & Karaoké
          </h1>
          <p className="music-hero-subtitle">
            Collez un lien Spotify pour écouter le morceau, afficher les paroles complètes en kanji et romaji,
            suivre le karaoké synchronisé et mémoriser le vocabulaire japonais dans vos fiches Anki.
          </p>
        </section>

        {/* Search & Input Card */}
        <section className="music-input-card" aria-label="Recherche et saisie musicale">
          <div className="music-search-bar">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Collez un lien Spotify (ex: https://open.spotify.com/track/...) ou un titre (ex: YOASOBI - Idol)"
              className="music-input"
              aria-label="Lien Spotify ou nom du morceau"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="music-btn-analyze"
              aria-label="Analyser les paroles de la chanson"
            >
              {loading ? '⏳ Analyse...' : '✨ Analyser Paroles'}
            </button>
            <button
              onClick={() => setShowCustomLyrics(!showCustomLyrics)}
              className="music-custom-toggle-btn"
              aria-label="Afficher ou masquer la zone de paroles personnalisées"
            >
              {showCustomLyrics ? '▲ Masquer texte' : '📝 Coller mes paroles'}
            </button>
          </div>

          {/* Zone paroles personnalisées */}
          {showCustomLyrics && (
            <textarea
              value={customLyrics}
              onChange={(e) => setCustomLyrics(e.target.value)}
              placeholder="Collez ici les paroles japonaises complètes si vous souhaitez analyser un texte ou une version spécifique..."
              className="music-textarea"
              aria-label="Paroles personnalisées à analyser"
            />
          )}

          {/* Morceaux suggérés en 1 clic */}
          {presets.length > 0 && (
            <div className="music-presets-container" aria-label="Morceaux suggérés">
              <span className="music-presets-label">Suggérés :</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p)}
                  className="music-preset-chip"
                  aria-label={`Explorer le morceau ${p.title} de ${p.artist}`}
                >
                  🎵 {p.artist} — {p.title}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Loading Spinner */}
        {loading && (
          <div className="music-loading-box" role="status">
            <div className="music-spinner" />
            <h3>Extraction et transcription des paroles complètes...</h3>
            <p style={{ color: '#94a3b8' }}>Génération de la transcription Romaji et synchronisation temporelle.</p>
          </div>
        )}

        {/* Player & Content Area */}
        {lyricsData && !loading && (
          <div>
            {/* Lecteur Spotify & Infos Linguistiques */}
            <div className="music-player-grid">
              <div className="music-spotify-widget">
                {track?.embed_url ? (
                  <iframe
                    src={track.embed_url}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={`Lecteur Spotify pour ${track.title}`}
                    style={{ borderRadius: '12px', border: 'none', display: 'block' }}
                  />
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎧</div>
                    <strong>{lyricsData.title}</strong> {lyricsData.artist && `— ${lyricsData.artist}`}
                  </div>
                )}
              </div>

              {/* Carte Info Linguistique (Sans analyse anime) */}
              <div className="music-song-info-card">
                <h3 className="music-info-title">{lyricsData.title}</h3>
                <div className="music-info-artist">{lyricsData.artist || track?.artist}</div>
                <div className="music-info-badges">
                  {lyricsData.jlpt_level && (
                    <span className="music-badge music-badge-jlpt">
                      Niveau linguistique : JLPT {lyricsData.jlpt_level}
                    </span>
                  )}
                  <span className="music-badge" style={{ background: '#1e1e24', color: '#cbd5e1' }}>
                    {lyricsData.lines?.length || 0} vers extraits
                  </span>
                </div>
                <p className="music-info-desc">
                  Activez le mode Karaoké ci-dessous pour faire défiler les paroles en direct pendant la lecture de votre musique sur Spotify !
                </p>
              </div>
            </div>

            {/* Barre de contrôles (Karaoké & Dossier cible) */}
            <div className="music-controls-bar">
              <button
                className={`music-karaoke-toggle ${karaokeMode ? 'active' : ''}`}
                onClick={() => {
                  const nextState = !karaokeMode;
                  setKaraokeMode(nextState);
                  if (nextState) {
                    setIsKaraokePlaying(true);
                  } else {
                    setIsKaraokePlaying(false);
                  }
                }}
                aria-pressed={karaokeMode}
                aria-label="Basculer le mode Karaoké"
              >
                🎤 {karaokeMode ? 'Mode Karaoké Actif' : 'Activer Mode Karaoké'}
              </button>

              {/* Sélecteur de dossier flashcards */}
              <div className="music-deck-group">
                <label htmlFor="music-deck-select" style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                  📂 Enregistrer dans :
                </label>
                {showNewDeckForm ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={newDeckTitle}
                      onChange={(e) => setNewDeckTitle(e.target.value)}
                      placeholder="Nouveau dossier..."
                      style={{
                        padding: '6px 10px',
                        background: '#1e1e24',
                        border: '1px solid #333',
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleCreateDeck}
                      style={{ background: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setShowNewDeckForm(false)}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      ✗
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      id="music-deck-select"
                      value={selectedDeckId}
                      onChange={(e) => setSelectedDeckId(e.target.value)}
                      className="music-deck-select"
                    >
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowNewDeckForm(true)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #33333f',
                        color: '#cbd5e1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      + Nouveau
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CONTRÔLEUR SYNCHRONISÉ KARAOKÉ (Sticky lors du mode karaoké) */}
            {karaokeMode && (
              <div className="music-karaoke-controller" aria-label="Contrôleur de lecture karaoké">
                <div className="music-karaoke-main-ctrls">
                  <div className="music-karaoke-buttons">
                    <button
                      onClick={handlePrevLine}
                      className="music-karaoke-btn"
                      title="Vers précédent"
                      aria-label="Vers précédent"
                    >
                      ⏮️
                    </button>

                    <button
                      onClick={() => setIsKaraokePlaying(!isKaraokePlaying)}
                      className="music-karaoke-btn music-karaoke-btn-primary"
                      aria-label={isKaraokePlaying ? "Pause karaoké" : "Lecture karaoké"}
                    >
                      {isKaraokePlaying ? "⏸️ Pause" : "▶️ Lecture"}
                    </button>

                    <button
                      onClick={handleNextLine}
                      className="music-karaoke-btn"
                      title="Vers suivant"
                      aria-label="Vers suivant"
                    >
                      ⏭️
                    </button>

                    <button
                      onClick={() => setAutoPronounce(!autoPronounce)}
                      className="music-karaoke-btn"
                      style={{ background: autoPronounce ? 'rgba(29, 185, 84, 0.2)' : undefined, borderColor: autoPronounce ? '#1db954' : undefined }}
                      title="Prononcer automatiquement chaque vers en karaoké"
                      aria-label="Prononciation vocale automatique"
                    >
                      🔊 Voix {autoPronounce ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="music-karaoke-time-display">
                      {formatTime(karaokeTime)} / {formatTime(totalDuration)}
                    </span>
                    <button
                      onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.25 : playbackSpeed === 1.25 ? 0.8 : 1)}
                      className={`music-karaoke-speed-btn ${playbackSpeed !== 1 ? 'active' : ''}`}
                      title="Vitesse de défilement"
                      aria-label={`Vitesse actuelle : ${playbackSpeed}x`}
                    >
                      {playbackSpeed}x
                    </button>
                  </div>
                </div>

                {/* Curseur temporel karaoké */}
                <input
                  type="range"
                  min="0"
                  max={totalDuration || 100}
                  step="0.5"
                  value={karaokeTime}
                  onChange={(e) => {
                    const newTime = parseFloat(e.target.value);
                    setKaraokeTime(newTime);
                    const line = lyricsData.lines.find(
                      (l) => newTime >= l.time && newTime < l.time + (l.duration || 4.5)
                    );
                    if (line) setActiveLineId(line.id);
                  }}
                  className="music-karaoke-slider"
                  aria-label="Position temporelle du karaoké"
                />
              </div>
            )}

            {/* Liste des Paroles interactives */}
            <div className="music-lyrics-list" role="list">
              {lyricsData.lines.map((line) => {
                const isLineSaved = savedLines.has(line.id);
                const isActive = activeLineId === line.id;

                return (
                  <article
                    key={line.id}
                    id={`music-line-${line.id}`}
                    role="listitem"
                    onClick={() => jumpToLine(line)}
                    className={`music-line-card ${karaokeMode && isActive ? 'active-karaoke' : ''}`}
                    tabIndex="0"
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && jumpToLine(line)}
                  >
                    <div className="music-line-header">
                      <div className="music-line-left">
                        <span className="music-line-number">#{line.id}</span>
                        <div>
                          <h2 className="music-line-japanese">{line.japanese}</h2>
                          <p className="music-line-romaji">{line.romaji}</p>
                          <h3 className="music-line-translation">{line.translation}</h3>
                        </div>
                      </div>

                      <div className="music-line-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playAudio(line.japanese);
                          }}
                          className="music-audio-btn"
                          aria-label={`Écouter la prononciation du vers : ${line.japanese}`}
                          title="Écouter la prononciation"
                        >
                          🔊
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveLineCard(line);
                          }}
                          disabled={isLineSaved}
                          className={`music-save-card-btn ${isLineSaved ? 'saved' : ''}`}
                          aria-label={isLineSaved ? 'Vers déjà sauvegardé' : 'Sauvegarder ce vers en fiche'}
                        >
                          {isLineSaved ? 'Sauvegardé ✓' : '💾 Fiche'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* SECTION VOCABULAIRE CLÉ DU MORCEAU (Global) */}
            {lyricsData.vocabulary && lyricsData.vocabulary.length > 0 && (
              <section className="music-global-vocab-card" aria-label="Vocabulaire clé de la chanson">
                <h3 className="music-global-vocab-title">
                  <span>📖</span> Vocabulaire Essentiel du Morceau
                </h3>
                <p className="music-global-vocab-desc">
                  Les termes clés et tournures grammaticales les plus fréquents de cette chanson pour progresser en japonais.
                </p>

                <div className="music-global-vocab-grid">
                  {lyricsData.vocabulary.map((vocab, idx) => {
                    const isWordSaved = savedWords.has(vocab.word);
                    return (
                      <div key={idx} className="music-vocab-card-item">
                        <div className="music-vocab-item-left">
                          <div>
                            <span className="music-vocab-word">{vocab.word}</span>
                            {vocab.romanji && <span className="music-vocab-reading">({vocab.romanji})</span>}
                            {vocab.type && <span className="music-vocab-type">{vocab.type}</span>}
                          </div>
                          <div className="music-vocab-meaning">{vocab.meaning}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => playAudio(vocab.word)}
                            className="music-audio-btn"
                            style={{ width: '30px', height: '30px', fontSize: '0.8rem' }}
                            title="Écouter"
                            aria-label={`Écouter ${vocab.word}`}
                          >
                            🔊
                          </button>
                          <button
                            onClick={() => handleSaveWordCard(vocab)}
                            disabled={isWordSaved}
                            className={`music-vocab-add-btn ${isWordSaved ? 'saved' : ''}`}
                            style={{
                              padding: '4px 10px',
                              background: isWordSaved ? '#10b981' : '#272734',
                              color: isWordSaved ? 'white' : '#cbd5e1',
                              borderRadius: '6px'
                            }}
                            title={`Ajouter "${vocab.word}" aux fiches`}
                            aria-label={`Ajouter le mot ${vocab.word} aux fiches`}
                          >
                            {isWordSaved ? '✓' : '+ Fiche'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
