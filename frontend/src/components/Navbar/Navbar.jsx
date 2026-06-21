import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe, createCheckoutSession } from '../../api/client';
import { toast } from 'react-hot-toast';

export function Navbar({ onImportClick, importing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isPremium, setIsPremium] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    async function checkPremiumStatus() {
      try {
        const userData = await getMe();
        setIsPremium(userData.is_premium);
      } catch (err) {
        console.error("Erreur statut premium navbar:", err);
      }
    }
    checkPremiumStatus();
  }, [currentPath]);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const data = await createCheckoutSession();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message || "Erreur de connexion avec Stripe");
    } finally {
      setSubscribing(false);
    }
  };

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
        <button 
          onClick={() => navigate('/profile')} 
          aria-label="Accéder au profil"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/profile' ? '#e67e22' : 'transparent',
            border: currentPath === '/profile' ? 'none' : '1px solid #444',
            color: currentPath === '/profile' ? 'white' : '#cbd5e1'
          }}
        >
          👤 Profil
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

        {/* Stripe Premium subscribe or active indicator */}
        {!isPremium ? (
          <button 
            onClick={handleSubscribe} 
            disabled={subscribing}
            aria-label="Devenir Premium"
            style={{
              ...styles.navBtn, 
              background: 'linear-gradient(135deg, #a855f7, #ec4899)', 
              border: 'none', 
              color: 'white',
              boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
            }}
          >
            {subscribing ? '⏳...' : '👑 S\'abonner'}
          </button>
        ) : (
          <span 
            title="Votre abonnement SensAI Premium est actif !"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(192, 132, 252, 0.1)',
              border: '1px solid #c084fc',
              color: '#e9d5ff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              height: '34px',
              boxSizing: 'border-box'
            }}
          >
            👑 Premium
          </span>
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
    outline: 'none',
    height: '34px',
    boxSizing: 'border-box'
  }
};
