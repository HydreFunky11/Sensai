import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe, createCheckoutSession } from '../../api/client';
import { toast } from 'react-hot-toast';
import { promptInstall, isInstallPromptAvailable, isStandaloneMode } from '../../pwa';
import './Navbar.css';

export function Navbar({ onImportClick, importing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const handleNavigate = (path) => {
    navigate(path);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header role="banner" className="sensai-header">
        <h1 className="sensai-logo" onClick={() => handleNavigate('/')}>
          SensAI
        </h1>

        {/* Desktop Navigation Links */}
        <nav aria-label="Actions globales" className="sensai-desktop-nav">
          <button 
            onClick={() => handleNavigate('/')} 
            aria-label="Accéder à la bibliothèque"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/' ? '#2563eb' : 'transparent',
              border: currentPath === '/' ? 'none' : '1px solid #444',
              color: currentPath === '/' ? 'white' : '#cbd5e1'
            }}
          >
            📚 Bibliothèque
          </button>
          
          <button 
            onClick={() => handleNavigate('/lens')} 
            aria-label="Accéder au mode Scan Photo SensAI Lens"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/lens' ? '#06b6d4' : 'transparent',
              border: currentPath === '/lens' ? 'none' : '1px solid #444',
              color: currentPath === '/lens' ? 'white' : '#cbd5e1'
            }}
          >
            📸 Lens
          </button>
          
          <button 
            onClick={() => handleNavigate('/music')} 
            aria-label="Accéder à la musique et au karaoké SensAI Music"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/music' ? '#1db954' : 'transparent',
              border: currentPath === '/music' ? 'none' : '1px solid #444',
              color: currentPath === '/music' ? 'white' : '#cbd5e1'
            }}
          >
            🎵 Musique
          </button>
          
          <button 
            onClick={() => handleNavigate('/alphabets')} 
            aria-label="Apprendre les alphabets japonais"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/alphabets' ? '#8b5cf6' : 'transparent',
              border: currentPath === '/alphabets' ? 'none' : '1px solid #444',
              color: currentPath === '/alphabets' ? 'white' : '#cbd5e1'
            }}
          >
            🇯🇵 Alphabets
          </button>
          
          <button 
            onClick={() => handleNavigate('/study')} 
            aria-label="Accéder aux révisions"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/study' ? '#27ae60' : 'transparent',
              border: currentPath === '/study' ? 'none' : '1px solid #444',
              color: currentPath === '/study' ? 'white' : '#cbd5e1'
            }}
          >
            🧠 Révisions
          </button>
          
          <button 
            onClick={() => handleNavigate('/stats')} 
            aria-label="Accéder aux statistiques"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/stats' ? '#9b59b6' : 'transparent',
              border: currentPath === '/stats' ? 'none' : '1px solid #444',
              color: currentPath === '/stats' ? 'white' : '#cbd5e1'
            }}
          >
            📊 Stats
          </button>
          
          <button 
            onClick={() => handleNavigate('/profile')} 
            aria-label="Accéder au profil"
            className="sensai-nav-btn"
            style={{
              background: currentPath === '/profile' ? '#e67e22' : 'transparent',
              border: currentPath === '/profile' ? 'none' : '1px solid #444',
              color: currentPath === '/profile' ? 'white' : '#cbd5e1'
            }}
          >
            👤 Profil
          </button>

          {isAdmin && (
            <button 
              onClick={() => handleNavigate('/admin')} 
              aria-label="Accéder au panneau d'administration"
              className="sensai-nav-btn"
              style={{
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
              className="sensai-nav-btn"
              style={{ background: '#3498db', border: 'none', color: 'white' }}
            >
              {importing ? '⏳ Importation...' : '📥 Importer'}
            </button>
          )}

          {!isPremium && (
            <button 
              onClick={handleSubscribe} 
              disabled={subscribing}
              aria-label="Devenir Premium"
              className="sensai-nav-btn"
              style={{
                background: 'linear-gradient(135deg, #a855f7, #ec4899)', 
                border: 'none', 
                color: 'white',
                boxShadow: '0 2px 8px rgba(168, 85, 247, 0.3)'
              }}
            >
              {subscribing ? '⏳...' : '👑 S\'abonner'}
            </button>
          )}

          {canInstall && (
            <button 
              onClick={handleInstallApp}
              aria-label="Installer l'application SensAI"
              className="sensai-nav-btn"
              style={{
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
            className="sensai-nav-btn"
            style={{ background: '#e74c3c', border: 'none', color: 'white' }}
          >
            Déconnexion
          </button>
        </nav>

        {/* Mobile Header Quick Actions */}
        <div className="sensai-mobile-header-actions">
          {currentPath === '/' && onImportClick && (
            <button 
              onClick={onImportClick}
              aria-label="Importer un document"
              className="sensai-nav-btn"
              style={{ background: '#2563eb', padding: '6px 10px', fontSize: '0.8rem', color: 'white' }}
            >
              {importing ? '⏳...' : '📥 Importer'}
            </button>
          )}

          {canInstall && (
            <button 
              onClick={handleInstallApp}
              aria-label="Installer l'application SensAI"
              className="sensai-nav-btn"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #2563eb)', padding: '6px 10px', fontSize: '0.8rem', color: 'white' }}
            >
              📲 Installer
            </button>
          )}

          <button 
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="sensai-burger-btn"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Mobile Bottom Dock Bar */}
      <nav aria-label="Navigation mobile principale" className="sensai-bottom-dock">
        <ul className="sensai-dock-items">
          <li>
            <button 
              onClick={() => handleNavigate('/')} 
              aria-label="Bibliothèque"
              className={`sensai-dock-btn ${currentPath === '/' ? 'active' : ''}`}
            >
              <span className="sensai-dock-icon">📚</span>
              <span>Bibliothèque</span>
            </button>
          </li>
          
          <li>
            <button 
              onClick={() => handleNavigate('/lens')} 
              aria-label="SensAI Lens"
              className={`sensai-dock-btn ${currentPath === '/lens' ? 'active' : ''}`}
            >
              <span className="sensai-dock-icon">📸</span>
              <span>Lens</span>
            </button>
          </li>
          
          <li>
            <button 
              onClick={() => handleNavigate('/study')} 
              aria-label="Flashcards et révisions"
              className={`sensai-dock-btn ${currentPath === '/study' ? 'active' : ''}`}
            >
              <span className="sensai-dock-icon">🧠</span>
              <span>Révisions</span>
            </button>
          </li>
          
          <li>
            <button 
              onClick={() => handleNavigate('/music')} 
              aria-label="Musique et karaoké"
              className={`sensai-dock-btn ${currentPath === '/music' ? 'active' : ''}`}
            >
              <span className="sensai-dock-icon">🎵</span>
              <span>Musique</span>
            </button>
          </li>
          
          <li>
            <button 
              onClick={() => setIsDrawerOpen(true)} 
              aria-label="Ouvrir plus d'options"
              className="sensai-dock-btn"
            >
              <span className="sensai-dock-icon">☰</span>
              <span>Plus</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile Slide-in Drawer */}
      {isDrawerOpen && (
        <div 
          className="sensai-drawer-overlay" 
          onClick={() => setIsDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <div className="sensai-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sensai-drawer-header">
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', fontWeight: 800 }}>
                Menu SensAI
              </h2>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="sensai-drawer-close"
              >
                ✕
              </button>
            </div>

            <div className="sensai-drawer-list">
              <button 
                onClick={() => handleNavigate('/alphabets')} 
                className={`sensai-drawer-item ${currentPath === '/alphabets' ? 'active' : ''}`}
              >
                <span>🇯🇵</span>
                <span>Alphabets & Kanji</span>
              </button>

              <button 
                onClick={() => handleNavigate('/stats')} 
                className={`sensai-drawer-item ${currentPath === '/stats' ? 'active' : ''}`}
              >
                <span>📊</span>
                <span>Statistiques & Progression</span>
              </button>

              <button 
                onClick={() => handleNavigate('/profile')} 
                className={`sensai-drawer-item ${currentPath === '/profile' ? 'active' : ''}`}
              >
                <span>👤</span>
                <span>Mon Profil</span>
              </button>

              {isAdmin && (
                <button 
                  onClick={() => handleNavigate('/admin')} 
                  className={`sensai-drawer-item ${currentPath === '/admin' ? 'active' : ''}`}
                  style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}
                >
                  <span>🛡️</span>
                  <span style={{ color: '#fbbf24' }}>Administration</span>
                </button>
              )}

              {currentPath === '/' && onImportClick && (
                <button 
                  onClick={() => { setIsDrawerOpen(false); onImportClick(); }} 
                  className="sensai-drawer-item"
                  style={{ background: 'rgba(37, 99, 235, 0.15)', borderColor: '#2563eb' }}
                >
                  <span>📥</span>
                  <span>{importing ? 'Importation...' : 'Importer une œuvre'}</span>
                </button>
              )}

              {!isPremium && (
                <button 
                  onClick={() => { setIsDrawerOpen(false); handleSubscribe(); }} 
                  disabled={subscribing}
                  className="sensai-drawer-item"
                  style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))', borderColor: '#a855f7' }}
                >
                  <span>👑</span>
                  <span>{subscribing ? 'Chargement...' : 'Passer à Premium'}</span>
                </button>
              )}

              {canInstall && (
                <button 
                  onClick={() => { setIsDrawerOpen(false); handleInstallApp(); }} 
                  className="sensai-drawer-item"
                  style={{ background: 'rgba(6, 182, 212, 0.15)', borderColor: '#06b6d4' }}
                >
                  <span>📲</span>
                  <span>Installer sur l'écran d'accueil</span>
                </button>
              )}

              <button 
                onClick={handleLogout} 
                className="sensai-drawer-item sensai-drawer-item-danger"
              >
                <span>🚪</span>
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
