import React, { useState, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import "react-image-crop/dist/ReactCrop.css";
import { detectBubbles } from '../../api/client';

export function Viewer({ pageSrc, crop, setCrop, setCompletedCrop, imgRef, onAnalyze, loading, hasSelection, gazeData }) {
  const [bubbles, setBubbles] = useState([]);
  const [detecting, setDetecting] = useState(false);
  
  const handleAutoDetect = async (src) => {
    if (!src) return;
    setDetecting(true);
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const data = await detectBubbles(blob);
      if (data.boxes) {
        setBubbles(data.boxes);
      }
    } catch (e) {
      console.error("Erreur de détection YOLO: ", e);
    } finally {
      setDetecting(false);
    }
  };

  // Reset bubbles et lance l'auto-détection quand on change de page
  useEffect(() => {
    setBubbles([]);
    setCrop(undefined);
    setCompletedCrop(null);
    if (pageSrc) {
      handleAutoDetect(pageSrc);
    }
  }, [pageSrc]);

  const handleBubbleClick = (box) => {
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

    const newCrop = {
      unit: 'px',
      x: scaledBox.x,
      y: scaledBox.y,
      width: scaledBox.width,
      height: scaledBox.height
    };
    
    setCrop(newCrop);
    
    const manualCompletedCrop = {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      unit: 'px'
    };
    
    setCompletedCrop(manualCompletedCrop);
    
    // Déclenche l'analyse immédiatement sans attendre le clic sur un bouton
    onAnalyze(manualCompletedCrop);
  };

  return (
    <section aria-label="Visionneuse de document" className="viewer-section">
      {detecting && (
        <div 
          role="status"
          aria-live="polite"
          style={{ 
            position: 'absolute', top: '15px', right: '25px', 
            background: 'rgba(139, 92, 246, 0.9)', color: 'white', 
            padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', zIndex: 100,
            display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            fontWeight: 600
          }}
        >
          <span className="spinner" aria-hidden="true">↻</span> Détection automatique...
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spinner { display: inline-block; animation: spin 1s linear infinite; }`}</style>
        </div>
      )}

      <div className="viewer-container">
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '100%' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => {
              const img = imgRef.current;
              if (img && c.width && c.height) {
                const scaleX = img.naturalWidth / img.width;
                const scaleY = img.naturalHeight / img.height;
                setCompletedCrop({
                  x: c.x * scaleX,
                  y: c.y * scaleY,
                  width: c.width * scaleX,
                  height: c.height * scaleY,
                  unit: 'px'
                });
              } else {
                setCompletedCrop(null);
              }
            }}
            style={{ maxHeight: "100%", maxWidth: "100%" }}
          >
            <img
              ref={imgRef}
              src={pageSrc}
              alt="Page du document à analyser"
              style={{
                maxHeight: "calc(100vh - 180px)",
                maxWidth: "100%",
                objectFit: "contain",
                display: "block",
                borderRadius: '4px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
              }}
            />
          </ReactCrop>
          
          {/* Overlays des bulles détectées */}
          {bubbles.map((box, index) => {
            const img = imgRef.current;
            if (!img) return null;
            const scaleX = img.width / img.naturalWidth;
            const scaleY = img.height / img.naturalHeight;

            // Calcul de la position absolue de la bulle à l'écran
            const rect = img.getBoundingClientRect();
            const absLeft = rect.left + (box.x * scaleX);
            const absRight = absLeft + (box.width * scaleX);
            const absTop = rect.top + (box.y * scaleY);
            const absBottom = absTop + (box.height * scaleY);

            // Vérifier si le regard (gazeData) est dans cette zone
            const isGazedAt = gazeData && 
                              gazeData.x >= absLeft && gazeData.x <= absRight &&
                              gazeData.y >= absTop && gazeData.y <= absBottom;
            
            return (
              <button
                key={index}
                onClick={() => handleBubbleClick(box)}
                aria-label={`Zone de texte détectée ${index + 1}`}
                className="detected-bubble-btn"
                style={{
                  left: `${box.x * scaleX}px`,
                  top: `${box.y * scaleY}px`,
                  width: `${box.width * scaleX}px`,
                  height: `${box.height * scaleY}px`,
                  border: isGazedAt ? '3px solid #ef4444' : undefined,
                  backgroundColor: isGazedAt ? 'rgba(239, 68, 68, 0.35)' : undefined,
                  boxShadow: isGazedAt ? '0 0 15px rgba(239, 68, 68, 0.7)' : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {hasSelection && (
        <button
          onClick={onAnalyze}
          disabled={loading}
          aria-label={loading ? "Analyse en cours" : "Lancer la traduction de la zone sélectionnée"}
          className="translate-btn-overlay"
        >
          {loading ? "Analyse en cours..." : "Traduire la sélection"}
        </button>
      )}
    </section>
  );
}
