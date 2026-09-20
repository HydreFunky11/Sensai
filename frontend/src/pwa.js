let deferredPrompt = null;

/**
 * Initialise l'écoute de l'événement d'installation PWA
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique par défaut sur certains navigateurs
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable', { detail: { available: true } }));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
}

/**
 * Enregistre le Service Worker en environnement supporté
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // En environnement de développement (Vite / tunnels dev hors tests), ne pas activer le Service Worker
  // et désinscrire tout worker existant afin de ne pas perturber Vite HMR ni intercepter les requêtes.
  if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    if (typeof navigator.serviceWorker.getRegistrations === 'function') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Détecter les mises à jour en attente
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent('pwa-update-available'));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn('SensAI PWA Service Worker non enregistré:', error);
      });
  });
}

/**
 * Déclenche la modale native d'installation de la PWA
 * @returns {Promise<boolean>} Vrai si l'utilisateur a accepté l'installation
 */
export async function promptInstall() {
  if (!deferredPrompt) {
    return false;
  }
  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choiceResult.outcome === 'accepted';
}

/**
 * Vérifie si l'application peut être installée actuellement
 */
export function isInstallPromptAvailable() {
  return !!deferredPrompt;
}

/**
 * Vérifie si l'application s'exécute déjà en mode autonome (PWA installée)
 */
export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true;
}
