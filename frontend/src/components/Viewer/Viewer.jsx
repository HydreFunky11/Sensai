import React, { useState, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import "react-image-crop/dist/ReactCrop.css";
import { detectBubbles } from '../../api/client';

export function Viewer({ pageSrc, crop, setCrop, setCompletedCrop, imgRef, onAnalyze, loading, hasSelection }) {
  const [bubbles, setBubbles] = useState([]);
  const [detecting, setDetecting] = useState(false);
  
  // Reset bubbles quand on change de page
  useEffect(() => {
    setBubbles([]);
    setCrop(undefined);
    setCompletedCrop(null);
  }, [pageSrc]);

  const handleAutoDetect = async () => {
    if (!imgRef.current || !pageSrc) return;
    setDetecting(true);
    try {
      // Pour envoyer au backend, on a besoin du blob de l'image affichée
      const response = await fetch(pageSrc);
      const blob = await response.blob();
      
      const data = await detectBubbles(blob);
      if (data.boxes) {
        // YOLO renvoie les coordonnées par rapport à la taille originale de l'image.
        // Il faut s'assurer que l'image CSS n'écrase pas trop le ratio pour que l'overlay soit correct,
        // ReactCrop avec un img en max-height/max-width s'en charge généralement bien grâce aux dimensions affichées.
        setBubbles(data.boxes);
      }
    } catch (e) {
      alert("Erreur de détection: " + e.message);
    } finally {
      setDetecting(false);
    }
  };

  const handleBubbleClick = (box) => {
    // Calculer les pourcentages par rapport à la taille de l'image originale
    const img = imgRef.current;
    if (!img) return;

    const scaleX = img.width / img.naturalWidth;
    const scaleY = img.height / img.naturalHeight;

    const scaledBox = {
      x: box.x * scaleX,
      y: box.y * scaleY,
      width: box.width * scaleX,
      height: box.height * scaleY
    };

    // On crée un Crop au format "pixel" (unit: 'px') compatible avec ReactCrop
    const newCrop = {
      unit: 'px',
      x: scaledBox.x,
      y: scaledBox.y,
      width: scaledBox.width,
      height: scaledBox.height
    };
    
    setCrop(newCrop);
    
    // On doit passer le crop original (en pixels de l'image source) au translateSelection pour un meilleur OCR.
    // L'astuce est de déclencher onAnalyze avec une légère attente pour que ReactCrop mette à jour completedCrop.
    // Pour simplifier l'intégration immédiate: on génère un completedCrop manuel au format attendu par onAnalyze.
    const manualCompletedCrop = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      unit: 'px'
    };
    setCompletedCrop(manualCompletedCrop);
  };

  return (
    <div
      style={{
        flex: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button 
          onClick={handleAutoDetect} 
          disabled={detecting || loading}
          style={{
            padding: '10px 15px',
            background: '#8e44ad',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: (detecting || loading) ? 'default' : 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {detecting ? '🔍 Détection en cours...' : '✨ Auto-Détection YOLO'}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
          position: "relative" // Important pour les overlays
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            style={{ maxHeight: "100%", maxWidth: "100%" }}
          >
            <img
              ref={imgRef}
              src={pageSrc}
              alt="Scan actuel"
              style={{
                maxHeight: "calc(100vh - 200px)",
                maxWidth: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </ReactCrop>
          
          {/* Overlays des bulles détectées */}
          {bubbles.map((box, index) => {
            const img = imgRef.current;
            if (!img) return null;
            const scaleX = img.width / img.naturalWidth;
            const scaleY = img.height / img.naturalHeight;
            
            return (
              <div
                key={index}
                onClick={() => handleBubbleClick(box)}
                style={{
                  position: 'absolute',
                  left: `${box.x * scaleX}px`,
                  top: `${box.y * scaleY}px`,
                  width: `${box.width * scaleX}px`,
                  height: `${box.height * scaleY}px`,
                  border: '2px solid #3498db',
                  backgroundColor: 'rgba(52, 152, 219, 0.2)',
                  cursor: 'pointer',
                  zIndex: 10, // Au-dessus de l'image, en dessous du crop actif si possible
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(52, 152, 219, 0.5)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(52, 152, 219, 0.2)'}
              />
            );
          })}
        </div>
      </div>

      {hasSelection && (
        <button
          onClick={onAnalyze}
          disabled={loading}
          style={{
            marginTop: "10px",
            padding: "15px",
            width: "100%",
            fontSize: "18px",
            background: "#e74c3c",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "5px",
            flexShrink: 0,
          }}
        >
          {loading ? "Analyse en cours..." : "Traduire la sélection"}
        </button>
      )}
    </div>
  );
}
