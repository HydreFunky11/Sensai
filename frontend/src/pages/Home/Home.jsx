import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLibrary, importToLibrary } from '../../api/client';

export default function Home() {
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadLibrary();
  }, []);

  async function loadLibrary() {
    try {
      const data = await getLibrary();
      setLibrary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    try {
      await importToLibrary(file);
      await loadLibrary(); // Recharger la bibliothèque après l'import
    } catch (err) {
      alert("Erreur lors de l'import: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openReader = (manga) => {
    // Naviguer vers le lecteur en passant l'ID ou le chemin du manga
    navigate('/reader', { state: { manga } });
  };

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <h1 style={styles.logo}>SensAI Library</h1>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => navigate('/study')} style={{...styles.navBtn, background: '#27ae60'}}>
            🧠 Révisions (Anki)
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{...styles.navBtn, background: '#3498db'}}>
            {importing ? '⏳ Importation...' : '📥 Importer'}
          </button>
          <button onClick={handleLogout} style={{...styles.navBtn, background: '#e74c3c'}}>
            Déconnexion
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*,.pdf" 
          />
        </div>
      </nav>
      
      <main style={styles.main}>
        {loading ? (
          <div style={styles.center}>Chargement de la bibliothèque...</div>
        ) : library.length === 0 ? (
          <div style={styles.center}>
            <h2>Votre bibliothèque est vide</h2>
            <p>Cliquez sur "Importer" pour ajouter votre premier manga ou document PDF.</p>
          </div>
        ) : (
          <div style={styles.grid}>
            {library.map(manga => (
              <div key={manga.id} style={styles.mangaCard} onClick={() => openReader(manga)}>
                {/* Fallback de cover si aucune image (pour Tachiyomi style) */}
                <div style={styles.coverPlaceholder}>
                  {manga.cover_image ? (
                    <img src={manga.cover_image} alt={manga.title} style={styles.coverImg} loading="lazy" />
                  ) : (
                    <span style={styles.coverText}>{manga.title[0].toUpperCase()}</span>
                  )}
                </div>
                <div style={styles.mangaTitleWrapper}>
                  <h3 style={styles.mangaTitle}>{manga.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#121212', fontFamily: 'sans-serif', color: 'white' },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    background: '#1e1e1e',
    height: '64px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  logo: { fontSize: '20px', margin: 0, fontWeight: 'bold' },
  navBtn: {
    color: 'white',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem'
  },
  main: { padding: '20px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', color: '#aaaaaa' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    // Optimisation pour beaucoup d'items: CSS grid est natif et très rapide. 
    // `content-visibility: auto` peut aider au scroll sur les grosses bibliothèques
    contentVisibility: 'auto'
  },
  mangaCard: {
    background: '#1e1e1e',
    borderRadius: '6px',
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    aspectRatio: '2 / 3', // Ratio typique d'une couverture de manga
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
    transition: 'transform 0.1s ease-in-out',
    '&:hover': { transform: 'scale(1.02)' }
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #2c3e50, #34495e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  coverText: {
    fontSize: '4rem',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold'
  },
  mangaTitleWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
    padding: '20px 8px 8px 8px',
  },
  mangaTitle: {
    margin: 0,
    fontSize: '0.85rem',
    color: 'white',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textShadow: '1px 1px 2px black'
  }
};
