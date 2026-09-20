import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe, createCheckoutSession } from '../../api/client';
import { toast } from 'react-hot-toast';
import { promptInstall, isInstallPromptAvailable, isStandaloneMode } from '../../pwa';

export function Navbar({ onImportClick, importing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    async function checkUserStatus() {
      try {
        const userData = await getMe();
        setIsPremium(userData.is_premium);
        setIsAdmin(!!userData.is_admin);
      } catch (err) {
        console.error("Erreur statut navbar:", err);
      }
    }
    checkUserStatus();
  }, [currentPath]);

  useEffect(() => {
    const handleInstallable = () => {
      if (!isStandaloneMode()) {
        setCanInstall(true);
      }
    };
    const handleInstalled = () => {
      setCanInstall(false);
      toast.success("SensAI installé avec succès !");
    };

    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);

    if (isInstallPromptAvailable() && !isStandaloneMode()) {
      setCanInstall(true);
    }

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const installed = await promptInstall();
    if (installed) {
      setCanInstall(false);
      toast.success("SensAI installé avec succès !");
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const data = await createCheckoutSession(currentPath || '/stats');
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
          onClick={() => navigate('/lens')} 
          aria-label="Accéder au mode Scan Photo SensAI Lens"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/lens' ? '#06b6d4' : 'transparent',
            border: currentPath === '/lens' ? 'none' : '1px solid #444',
            color: currentPath === '/lens' ? 'white' : '#cbd5e1'
          }}
        >
          📸 Lens
        </button>
        <button 
          onClick={() => navigate('/music')} 
          aria-label="Accéder à la musique et au karaoké SensAI Music"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/music' ? '#1db954' : 'transparent',
            border: currentPath === '/music' ? 'none' : '1px solid #444',
            color: currentPath === '/music' ? 'white' : '#cbd5e1'
          }}
        >
          🎵 Musique
        </button>
        <button 
          onClick={() => navigate('/alphabets')} 
          aria-label="Apprendre les alphabets japonais"
          style={{
            ...styles.navBtn, 
            background: currentPath === '/alphabets' ? '#8b5cf6' : 'transparent',
            border: currentPath === '/alphabets' ? 'none' : '1px solid #444',
            color: currentPath === '/alphabets' ? 'white' : '#cbd5e1'
          }}
        >
          🇯🇵 Alphabets
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

        {isAdmin && (
          <button 
            onClick={() => navigate('/admin')} 
            aria-label="Accéder au panneau d'administration"
            style={{
              ...styles.navBtn, 
              background: currentPath === '/admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
              border: currentPath === '/admin' ? 'none' : '1px solid #f59e0b',
              color: currentPath === '/admin' ? 'white' : '#f59e0b',
              boxShadow: currentPath === '/admin' ? '0 2px 8px rgba(245, 158, 11, 0.4)' : 'none'
            }}
          >
            🛡️ Admin
          </button>
        )}

        {currentPath === '/' && onImportClick && (
          <button 
            onClick={onImportClick} 
            aria-label="Importer une œuvre"
            style={{...styles.navBtn, background: '#3498db', border: 'none', color: 'white'}}
          >
            {importing ? '⏳ Importation...' : '📥 Importer'}
          </button>
        )}

        {/* Stripe Premium subscribe */}
        {!isPremium && (
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
        )}

        {/* PWA Install Button */}
        {canInstall && (
          <button 
            onClick={handleInstallApp}
            aria-label="Installer l'application SensAI"
            style={{
              ...styles.navBtn, 
              background: 'linear-gradient(135deg, #06b6d4, #2563eb)', 
              border: 'none', 
              color: 'white',
              boxShadow: '0 2px 8px rgba(6, 182, 212, 0.3)'
            }}
          >
            📲 Installer l'App
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
    outline: 'none',
    height: '34px',
    boxSizing: 'border-box'
  }
};
