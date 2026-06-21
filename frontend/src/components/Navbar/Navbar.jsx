import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function Navbar({ onImportClick, importing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <header role="banner" style={styles.nav}>
      <h1 style={styles.logo} onClick={() => navigate('/')}>SensAI</h1>
      <nav aria-label="Actions globales" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button 
          onClick={() => navigate('/')} 
          aria-label="Accéder à la bibliothèque"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/' ? '#2563eb' : 'transparent',
            border: currentPath === '/' ? 'none' : '1px solid #444',
            color: currentPath === '/' ? 'white' : '#cbd5e1'
          }}
        >
          📚 Bibliothèque
        </button>
        <button 
          onClick={() => navigate('/study')} 
          aria-label="Accéder aux révisions"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/study' ? '#27ae60' : 'transparent',
            border: currentPath === '/study' ? 'none' : '1px solid #444',
            color: currentPath === '/study' ? 'white' : '#cbd5e1'
          }}
        >
          🧠 Révisions
        </button>
        <button 
          onClick={() => navigate('/stats')} 
          aria-label="Accéder aux statistiques"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/stats' ? '#9b59b6' : 'transparent',
            border: currentPath === '/stats' ? 'none' : '1px solid #444',
            color: currentPath === '/stats' ? 'white' : '#cbd5e1'
          }}
        >
          📊 Stats
        </button>

        {currentPath === '/' && onImportClick && (
          <button 
            onClick={onImportClick} 
            aria-label="Importer une œuvre"
            style={{...styles.navBtn, background: '#3498db', border: 'none', color: 'white'}}
          >
            {importing ? '⏳ Importation...' : '📥 Importer'}
          </button>
        )}

        <button 
          onClick={handleLogout} 
          aria-label="Se déconnecter"
          style={{...styles.navBtn, background: '#e74c3c', border: 'none', color: 'white'}}
        >
          Déconnexion
        </button>
      </nav>
    </header>
  );
}

const styles = {
  nav: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: '0 24px', 
    background: '#1e1e1e', 
    height: '64px', 
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)', 
    zIndex: 100,
    boxSizing: 'border-box',
    width: '100%',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'white',
    borderBottom: '1px solid #2d2d2d'
  },
  logo: { 
    fontSize: '22px', 
    margin: 0, 
    fontWeight: '800', 
    cursor: 'pointer',
    letterSpacing: '1px',
    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navBtn: { 
    border: '1px solid transparent', 
    padding: '8px 16px', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontWeight: '700', 
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    outline: 'none'
  }
};
