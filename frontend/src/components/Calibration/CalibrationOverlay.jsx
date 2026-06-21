import React, { useState } from 'react';

const INITIAL_POINTS = [
  { id: 1, top: '10%', left: '10%', clicks: 0 },
  { id: 2, top: '10%', left: '50%', clicks: 0 },
  { id: 3, top: '10%', left: '90%', clicks: 0 },
  { id: 4, top: '50%', left: '10%', clicks: 0 },
  { id: 5, top: '50%', left: '50%', clicks: 0 },
  { id: 6, top: '50%', left: '90%', clicks: 0 },
  { id: 7, top: '90%', left: '10%', clicks: 0 },
  { id: 8, top: '90%', left: '50%', clicks: 0 },
  { id: 9, top: '90%', left: '90%', clicks: 0 },
];

export function CalibrationOverlay({ onComplete, calibratePoint, gazeData }) {
  const [points, setPoints] = useState(INITIAL_POINTS);
  const [isValidationMode, setIsValidationMode] = useState(false);
  const [validationAccuracy, setValidationAccuracy] = useState(null);
  const [showRetryMessage, setShowRetryMessage] = useState(false);

  const maxClicks = 5;

  const resetCalibration = () => {
    setPoints(INITIAL_POINTS.map(p => ({ ...p, clicks: 0 })));
    setIsValidationMode(false);
    setValidationAccuracy(null);
    setShowRetryMessage(true);
    setTimeout(() => setShowRetryMessage(false), 3000);
  };

  const handlePointClick = (e, p) => {
    const rect = e.target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    calibratePoint(centerX, centerY);

    setPoints((prevPoints) => {
      const newPoints = prevPoints.map(point => {
        if (point.id === p.id && point.clicks < maxClicks) {
          return { ...point, clicks: point.clicks + 1 };
        }
        return point;
      });

      const allDone = newPoints.every(point => point.clicks >= maxClicks);
      if (allDone) {
        setIsValidationMode(true);
      }

      return newPoints;
    });
  };

  const handleValidationClick = () => {
    if (gazeData) {
      const targetX = window.innerWidth / 2;
      const targetY = window.innerHeight / 2;
      
      const distance = Math.sqrt(
        Math.pow(gazeData.x - targetX, 2) + 
        Math.pow(gazeData.y - targetY, 2)
      );

      // Seuil ajusté à 180px pour WebGazer (caméra cachée en arrière-plan)
      if (distance < 180) {
        setValidationAccuracy("Excellente !");
        setTimeout(onComplete, 1500);
      } else {
        setValidationAccuracy("Insuffisante (" + Math.round(distance) + "px). Réessayez.");
        setTimeout(resetCalibration, 2000);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(12, 12, 14, 0.98)', // Dark premium background
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <h2 style={{ position: 'absolute', top: '40px', color: '#f8fafc', textAlign: 'center', width: '100%', margin: 0, fontWeight: 700 }}>
        {isValidationMode ? "Test de précision" : "Calibration oculaire WIP"}
      </h2>
      
      <p style={{ position: 'absolute', top: '80px', color: '#94a3b8', textAlign: 'center', width: '100%', padding: '0 20px', fontSize: '0.95rem' }}>
        {isValidationMode 
          ? "Fixez le point bleu au centre et cliquez dessus une fois."
          : "Regardez le point rouge et cliquez " + maxClicks + " fois. Gardez la tête BIEN FIXE."}
      </p>

      {showRetryMessage && (
        <div style={{ position: 'absolute', top: '130px', color: '#f87171', fontWeight: 'bold', fontSize: '0.9rem' }}>
          Précision trop faible. Ne bougez pas la tête durant les clics.
        </div>
      )}

      {isValidationMode ? (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleValidationClick}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              border: '3px solid white',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)',
              cursor: 'pointer'
            }}
          />
          {validationAccuracy && (
            <div style={{ marginTop: '20px', fontSize: '1.2rem', color: '#f8fafc', fontWeight: 600 }}>
              Précision : {validationAccuracy}
            </div>
          )}
        </div>
      ) : (
        points.map((p) => {
          const isDone = p.clicks >= maxClicks;
          const size = isDone ? 20 : 30 - (p.clicks * 2);
          
          return (
            <button
              key={p.id}
              onClick={(e) => handlePointClick(e, p)}
              disabled={isDone}
              style={{
                position: 'absolute',
                top: p.top,
                left: p.left,
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                backgroundColor: isDone ? '#10b981' : '#ef4444',
                border: '2px solid white',
                boxShadow: isDone ? '0 0 10px rgba(16, 185, 129, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.4)',
                cursor: isDone ? 'default' : 'pointer',
                transition: 'all 0.2s',
                opacity: isDone ? 0.3 : 1
              }}
            />
          );
        })
      )}
    </div>
  );
}
