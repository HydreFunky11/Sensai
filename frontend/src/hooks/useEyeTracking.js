import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export function useEyeTracking(isActive) {
  const [gazeData, setGazeData] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger WebGazer.js dynamiquement depuis le dossier public local
  useEffect(() => {
    if (window.webgazer) {
      setIsLoaded(true);
      return;
    }

    console.log("📥 Chargement de WebGazer.js...");
    const script = document.createElement('script');
    script.src = '/webgazer.js';
    script.async = true;
    script.onload = () => {
      console.log("✅ WebGazer.js chargé avec succès !");
      setIsLoaded(true);
    };
    script.onerror = (err) => {
      console.error("❌ Erreur lors du chargement de WebGazer.js:", err);
      toast.error("Impossible de charger le tracker oculaire. Veuillez recharger la page.");
    };
    document.body.appendChild(script);
  }, []);

  // Gérer le cycle de vie de WebGazer (démarrage, arrêt, masquage UI)
  useEffect(() => {
    if (!isLoaded || !window.webgazer) return;

    const wg = window.webgazer;

    if (isActive) {
      console.log("👁️ Démarrage de WebGazer...");

      wg.setGazeListener((data, elapsedTime) => {
        if (!data) return;

        // Mise à jour des coordonnées à l'écran
        setGazeData({ x: data.x, y: data.y });

        // Déplacement du point rouge (Gaze Cursor) en temps réel pour une fluidité maximale
        const dot = document.getElementById('custom-gaze-dot');
        if (dot) {
          dot.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
          dot.style.display = 'block';
        }
      });

      // TOUJOURS masquer la surcouche graphique de WebGazer (Pas de retour webcam)
      wg.showVideo(false);
      wg.showFaceFeedbackBox(false);
      wg.showFaceOverlay(false);
      wg.showPredictionPoints(false);

      // Lancement du tracker
      wg.begin();

      // Masquer de manière continue et agressive les éléments injectés par WebGazer dans le DOM (aucun affichage webcam)
      const hideWebgazerUI = () => {
        const video = document.getElementById('webgazerVideoFeed');
        const canvas = document.getElementById('webgazerVideoCanvas');
        const faceFeedback = document.getElementById('webgazerFaceFeedbackBox');
        if (video) video.style.display = 'none';
        if (canvas) canvas.style.display = 'none';
        if (faceFeedback) faceFeedback.style.display = 'none';
      };

      hideWebgazerUI();
      const interval = setInterval(hideWebgazerUI, 300);

      return () => {
        clearInterval(interval);
        console.log("🛑 Pause de WebGazer");
        wg.pause();

        // Libérer la webcam
        const videoElement = document.getElementById('webgazerVideoFeed');
        if (videoElement && videoElement.srcObject) {
          const tracks = videoElement.srcObject.getTracks();
          tracks.forEach(track => track.stop());
          videoElement.srcObject = null;
        }

        // Cacher le pointeur rouge
        const dot = document.getElementById('custom-gaze-dot');
        if (dot) {
          dot.style.display = 'none';
        }
      };
    }
  }, [isActive, isLoaded]);

  // Nettoyage complet à la destruction du hook
  useEffect(() => {
    return () => {
      if (window.webgazer) {
        console.log("🗑️ Nettoyage final de WebGazer");
        try {
          window.webgazer.end();
        } catch (e) {
          console.warn("Erreur lors de l'appel à webgazer.end():", e);
        }

        const video = document.getElementById('webgazerVideoFeed');
        const canvas = document.getElementById('webgazerVideoCanvas');
        const faceFeedback = document.getElementById('webgazerFaceFeedbackBox');
        if (video) video.remove();
        if (canvas) canvas.remove();
        if (faceFeedback) faceFeedback.remove();
      }
    };
  }, []);

  // Écouter la touche Espace pour simuler un clignement
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        console.log("⌨️ Clignement simulé via touche Espace");
        window.dispatchEvent(new CustomEvent('eye-blink'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Enregistrer un point de calibration lors d'un clic
  const calibratePoint = useCallback((screenX, screenY) => {
    if (window.webgazer) {
      console.log(`🎯 Enregistrement point de calibration : (${screenX}, ${screenY})`);
      window.webgazer.recordScreenPosition(screenX, screenY, 'click');
    }
  }, []);

  return { gazeData, isLoaded, calibratePoint };
}
