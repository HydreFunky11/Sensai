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
    <section
      aria-label="Visionneuse de document"
      style={{
        flex: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {detecting && (
        <div 
          role="status"
          aria-live="polite"
          style={{ 
            position: 'absolute', top: '10px', right: '10px', 
            background: 'rgba(142, 68, 173, 0.9)', color: 'white', 
            padding: '5px 10px', borderRadius: '20px', fontSize: '0.85rem', zIndex: 100,
            display: 'flex', alignItems: 'center', gap: '5px'
          }}
        >
          <span className="spinner" aria-hidden="true">↻</span> Détection auto...
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spinner { display: inline-block; animation: spin 1s linear infinite; }`}</style>
        </div>
      )}

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
                style={{
                  position: 'absolute',
                  left: `${box.x * scaleX}px`,
                  top: `${box.y * scaleY}px`,
                  width: `${box.width * scaleX}px`,
                  height: `${box.height * scaleY}px`,
                  border: isGazedAt ? '3px solid #f1c40f' : '2px solid #3498db',
                  backgroundColor: isGazedAt ? 'rgba(241, 196, 15, 0.4)' : 'rgba(52, 152, 219, 0.2)',
                  boxShadow: isGazedAt ? '0 0 15px #f1c40f' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  zIndex: 10,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(52, 152, 219, 0.5)'}
                onMouseLeave={(e) => {
                   if (!isGazedAt) e.target.style.backgroundColor = 'rgba(52, 152, 219, 0.2)';
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
    </section>
  );
}
