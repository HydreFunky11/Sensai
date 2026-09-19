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
  const [searchMode, setSearchMode] = useState('manual'); // 'manual' (option principale) | 'spotify'
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
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
  const spotifyControllerRef = useRef(null);
  const embedContainerRef = useRef(null);
  const lastSpotifyUpdateRef = useRef(0);

  // Méthodes de commande du lecteur Spotify Embed
  const playSpotify = (seekTime = null) => {
    if (spotifyControllerRef.current) {
      try {
        if (typeof seekTime === 'number' && seekTime >= 0) {
          spotifyControllerRef.current.seek(Math.floor(seekTime));
        }
        spotifyControllerRef.current.play();
      } catch (err) {
        console.warn("Erreur lecture Spotify :", err);
      }
    }
  };

  const pauseSpotify = () => {
    if (spotifyControllerRef.current) {
      try {
        spotifyControllerRef.current.pause();
      } catch (err) {
        console.warn("Erreur pause Spotify :", err);
      }
    }
  };

  const seekSpotify = (timeInSec) => {
    if (spotifyControllerRef.current) {
      try {
        spotifyControllerRef.current.seek(Math.floor(timeInSec));
      } catch (err) {
        console.warn("Erreur seek Spotify :", err);
      }
    }
  };

  useEffect(() => {
    loadPresets();
    loadDecks();

    return () => {
      if (spotifyControllerRef.current) {
        try {
          spotifyControllerRef.current.destroy();
        } catch (e) {}
        spotifyControllerRef.current = null;
      }
    };
  }, []);

  // Initialisation et gestion du contrôleur Spotify iFrame API
  useEffect(() => {
    if (!track?.track_id || !embedContainerRef.current) return;

    let isMounted = true;

    const onApiReady = (IFrameAPI) => {
      if (!isMounted || !embedContainerRef.current) return;

      const container = embedContainerRef.current;

      // Si un contrôleur est déjà actif et que le conteneur a son iframe, charger la nouvelle piste
      if (spotifyControllerRef.current && container.querySelector('iframe')) {
        try {
          spotifyControllerRef.current.loadUri(`spotify:track:${track.track_id}`);
          return;
        } catch (e) {
          console.warn("Échec loadUri Spotify, réinitialisation du contrôleur :", e);
        }
      }

      // Vider le conteneur et insérer un placeholder propre pour l'API Spotify
      container.innerHTML = '';
      const placeholder = document.createElement('div');
      placeholder.id = `spotify-player-${Date.now()}`;
      container.appendChild(placeholder);

      const options = {
        width: '100%',
        height: 152,
        uri: `spotify:track:${track.track_id}`,
      };

      try {
        IFrameAPI.createController(placeholder, options, (controller) => {
          if (!isMounted) {
            try { controller.destroy(); } catch (e) {}
            return;
          }

          spotifyControllerRef.current = controller;

          controller.addListener('ready', () => {
            console.log("Spotify EmbedController prêt pour :", track.title);
          });

          controller.addListener('playback_update', (e) => {
            if (!e || !e.data) return;
            const { position, isPaused, duration } = e.data;

            if (typeof position === 'number') {
              lastSpotifyUpdateRef.current = Date.now();
              const timeSec = position / 1000;
              setKaraokeTime(timeSec);

              if (lyricsData?.lines?.length) {
                const currentLine = lyricsData.lines.find(
                  (l) => timeSec >= l.time && timeSec < l.time + (l.duration || 4.5)
                );
                if (currentLine) {
                  setActiveLineId(currentLine.id);
                }
              }
            }

            if (typeof isPaused === 'boolean') {
              if (isPaused && duration && position >= duration - 500) {
                setIsKaraokePlaying(false);
                setKaraokeTime(0);
              } else {
                setIsKaraokePlaying(!isPaused);
              }
            }
          });
        });
      } catch (err) {
        console.warn("Échec d'initialisation du Spotify Controller :", err);
      }
    };

    if (window.SpotifyIframeApi) {
      onApiReady(window.SpotifyIframeApi);
    } else {
      window.__spotifyIframeApiCallbacks = window.__spotifyIframeApiCallbacks || [];
      window.__spotifyIframeApiCallbacks.push(onApiReady);
    }

    return () => {
      isMounted = false;
    };
  }, [track?.track_id, lyricsData]);

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
      // Si Spotify est en cours de lecture et envoie des mises à jour actives (< 800ms),
      // on laisse Spotify piloter directement le temps pour éviter tout décalage
      const isSpotifyActive = Date.now() - lastSpotifyUpdateRef.current < 800;
      if (isSpotifyActive) {
        return;
      }

      setKaraokeTime((prev) => {
        const nextTime = prev + 0.2 * playbackSpeed;
        if (nextTime >= totalDuration) {
          setIsKaraokePlaying(false);
          pauseSpotify();
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

  // Traitement d'une recherche (Titre & Artiste ou Lien Spotify)
  const handleSearch = async (overrideData = null) => {
    let targetTitle = songTitle.trim();
    let targetArtist = songArtist.trim();
    let targetUrl = spotifyUrl.trim();

    if (overrideData) {
      if (typeof overrideData === 'object') {
        targetTitle = overrideData.title || "";
        targetArtist = overrideData.artist || "";
        targetUrl = overrideData.spotify_url || "";
      } else if (typeof overrideData === 'string') {
        if (overrideData.includes("spotify.com") || overrideData.startsWith("spotify:track:")) {
          targetUrl = overrideData;
        } else {
          targetTitle = overrideData;
        }
      }
    }

    // Auto-détection : si l'utilisateur a collé un lien Spotify dans le champ Titre
    if (targetTitle.includes("spotify.com") || targetTitle.startsWith("spotify:track:")) {
      targetUrl = targetTitle;
      targetTitle = "";
    }

    if (!targetUrl && !targetTitle && !customLyrics.trim()) {
      toast.error("Veuillez saisir un titre de chanson ou coller un lien Spotify.");
      return;
    }

    setLoading(true);
    setLyricsData(null);
    setIsKaraokePlaying(false);
    setKaraokeTime(0);
    pauseSpotify();

    try {
      // 1. Résolution du morceau (via Titre/Artiste ou Lien Spotify)
      let trackInfo = null;
      try {
        trackInfo = await resolveSpotifyTrack({
          spotify_url: targetUrl,
          title: targetTitle,
          artist: targetArtist
        });
        setTrack(trackInfo);
      } catch (e) {
        console.warn("Échec résolution Spotify, utilisation des informations saisies:", e);
        trackInfo = {
          title: targetTitle || "Morceau",
          artist: targetArtist || "",
          embed_url: null
        };
        setTrack(trackInfo);
      }

      // 2. Récupération et analyse linguistique des paroles
      const titleToAnalyze = trackInfo?.title || targetTitle;
      const artistToAnalyze = trackInfo?.artist || targetArtist;
      const lyrics = await getMusicLyrics(
        titleToAnalyze,
        artistToAnalyze,
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

  // Sélection d'un morceau suggéré
  const handleSelectPreset = (preset) => {
    setSongTitle(preset.title);
    setSongArtist(preset.artist);
    setSpotifyUrl(preset.spotify_url);
    setTrack({
      track_id: preset.track_id,
      title: preset.title,
      artist: preset.artist,
      thumbnail: preset.thumbnail,
      embed_url: preset.embed_url
    });
    handleSearch({
      title: preset.title,
      artist: preset.artist,
      spotify_url: preset.spotify_url
    });
  };

  // Saut de ligne interactif (au clic sur n'importe quel vers)
  const jumpToLine = (line) => {
    setActiveLineId(line.id);
    const targetTime = line.time || 0;
    setKaraokeTime(targetTime);
    seekSpotify(targetTime);
    if (karaokeMode && isKaraokePlaying) {
      playSpotify();
    }
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
            Recherchez une chanson par son titre et artiste, ou collez un lien Spotify pour écouter le morceau,
            afficher les paroles officielles synchronisées en kanji et romaji et mémoriser le vocabulaire dans vos fiches Anki.
          </p>
        </section>

        {/* Search & Input Card */}
        <section className="music-input-card" aria-label="Recherche et saisie musicale">
          {/* Onglets de sélection du mode de recherche */}
          <div className="music-search-modes" role="tablist" aria-label="Modes de recherche">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'manual'}
              className={`music-mode-tab ${searchMode === 'manual' ? 'active' : ''}`}
              onClick={() => setSearchMode('manual')}
            >
              ✍️ Titre & Artiste (Option Principale)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'spotify'}
              className={`music-mode-tab ${searchMode === 'spotify' ? 'active' : ''}`}
              onClick={() => setSearchMode('spotify')}
            >
              🔗 Lien Spotify
            </button>
            <button
              type="button"
              className={`music-mode-tab ${showCustomLyrics ? 'active' : ''}`}
              onClick={() => setShowCustomLyrics(!showCustomLyrics)}
              aria-label="Afficher ou masquer la zone de paroles personnalisées"
            >
              {showCustomLyrics ? '▲ Masquer mes paroles' : '📝 Coller mes paroles'}
            </button>
          </div>

          <div className="music-search-bar">
            {searchMode === 'manual' ? (
              <div className="music-manual-fields">
                <input
                  type="text"
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nom de la musique (ex: KIRA, Idol, Gurenge...)"
                  className="music-input"
                  aria-label="Titre de la chanson"
                />
                <input
                  type="text"
                  value={songArtist}
                  onChange={(e) => setSongArtist(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Nom de l'artiste (ex: Ado, YOASOBI, LiSA...)"
                  className="music-input"
                  aria-label="Nom de l'artiste"
                />
              </div>
            ) : (
              <input
                type="text"
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Collez un lien Spotify (ex: https://open.spotify.com/track/...)"
                className="music-input"
                aria-label="Lien Spotify"
              />
            )}

            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="music-btn-analyze"
              aria-label="Analyser les paroles de la chanson"
            >
              {loading ? '⏳ Analyse...' : '✨ Analyser Paroles'}
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
                {track?.embed_url || track?.track_id ? (
                  <div
                    ref={embedContainerRef}
                    className="music-spotify-embed-container"
                    data-testid="spotify-embed-container"
                    style={{ minHeight: '152px', borderRadius: '12px', overflow: 'hidden' }}
                  >
                    <iframe
                      src={track.embed_url || `https://open.spotify.com/embed/track/${track.track_id}`}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      title={`Lecteur Spotify pour ${track.title}`}
                      style={{ borderRadius: '12px', border: 'none', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🎧</div>
                    <strong style={{ fontSize: '1.2rem', color: 'white', display: 'block' }}>
                      {lyricsData.title}
                    </strong>
                    {lyricsData.artist && (
                      <span style={{ color: '#1db954', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                        {lyricsData.artist}
                      </span>
                    )}
                    <a
                      href={`https://open.spotify.com/search/${encodeURIComponent((lyricsData.artist || '') + ' ' + lyricsData.title)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="music-spotify-link-btn"
                    >
                      Écouter sur Spotify ↗
                    </a>
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
                    playSpotify(karaokeTime > 0 ? karaokeTime : 0);
                  } else {
                    setIsKaraokePlaying(false);
                    pauseSpotify();
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
                      onClick={() => {
                        const nextPlaying = !isKaraokePlaying;
                        setIsKaraokePlaying(nextPlaying);
                        if (nextPlaying) {
                          playSpotify(karaokeTime > 0 ? karaokeTime : null);
                        } else {
                          pauseSpotify();
                        }
                      }}
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
                    seekSpotify(newTime);
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
