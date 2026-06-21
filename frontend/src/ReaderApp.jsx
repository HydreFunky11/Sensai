import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMangaLoader } from "./hooks/useMangaLoader";
import { useTranslation } from "./hooks/useTranslation";
import { useEyeTracking } from "./hooks/useEyeTracking";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Viewer } from "./components/Viewer/Viewer";
import { AnalysisPanel } from "./components/Analysis/AnalysisPanel";
import { CalibrationOverlay } from "./components/Calibration/CalibrationOverlay";
import { getMangaFileBlob } from "./api/client";

function ReaderApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pages, currentIndex, setCurrentIndex, loading: loadingFiles, onSelectFiles, loadFromFile } = useMangaLoader();
  const { analysis, setAnalysis, loading: translating, translateSelection } = useTranslation();
  
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Eye Tracking
  const [eyeTrackingActive, setEyeTrackingActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const { gazeData, isLoaded, calibratePoint } = useEyeTracking(eyeTrackingActive);

  // Écouter le clignement pour traduire
  useEffect(() => {
    const handleBlink = () => {
      console.log("😉 Clignement détecté !");
      // On cherche l'élément sous le regard au moment du clignement
      const element = document.elementFromPoint(gazeData.x, gazeData.y);
      // Si c'est une bulle (bouton dans Viewer), on simule un clic
      if (element && element.tagName === 'BUTTON' && element.getAttribute('aria-label')?.includes('Zone de texte')) {
        console.log("🎯 Cible trouvée sous le regard, lancement de la traduction...");
        element.click();
      }
    };

    window.addEventListener('eye-blink', handleBlink);
    return () => window.removeEventListener('eye-blink', handleBlink);
  }, [gazeData, eyeTrackingActive]);

  // Charger le manga si passé depuis la bibliothèque
  useEffect(() => {
    const manga = location.state?.manga;
    if (manga) {
      getMangaFileBlob(manga.id)
        .then(blob => {
          // On ajoute le nom pour aider la détection de type PDF
          const file = new File([blob], manga.title + (manga.file_path.endsWith('.pdf') ? '.pdf' : '.jpg'), { type: blob.type });
          loadFromFile(file);
        })
        .catch(err => alert("Impossible de charger le document: " + err.message));
    }
  }, [location.state]);

  const handlePageChange = (index) => {
    setCurrentIndex(index);
    setCrop(undefined);
    setCompletedCrop(null);
    setAnalysis(null);
  };

  const isLoading = loadingFiles || translating;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        fontFamily: "sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <button 
        onClick={() => navigate('/home')} 
        aria-label="Retourner à la bibliothèque"
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 100,
          background: '#e74c3c', color: 'white', border: 'none', 
          padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
        }}
      >
        Retour Bibliothèque
      </button>

      {/* Overlay de Chargement */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            color: "white",
          }}
        >
          <div className="loader" style={{
            border: "8px solid #f3f3f3",
            borderTop: "8px solid #3498db",
            borderRadius: "50%",
            width: "60px",
            height: "60px",
            animation: "spin 2s linear infinite",
            marginBottom: "20px"
          }}></div>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <h2 style={{ margin: 0 }}>
            {loadingFiles ? "Chargement du document..." : "Analyse SensAI en cours..."}
          </h2>
          <p>Veuillez patienter quelques instants</p>
        </div>
      )}

      <Sidebar 
        pages={pages} 
        currentIndex={currentIndex} 
        onSelectFiles={onSelectFiles} 
        onPageChange={handlePageChange}
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#ecf0f1",
          overflow: "hidden",
          position: "relative"
        }}
      >
        {isCalibrating && (
          <CalibrationOverlay 
            onComplete={() => setIsCalibrating(false)} 
            calibratePoint={calibratePoint} 
            gazeData={gazeData}
          />
        )}

        {/* Custom Gaze Cursor (Optimisé GPU - MediaPipe) */}
        {eyeTrackingActive && !isCalibrating && (
          <div
            id="custom-gaze-dot"
            style={{
              display: 'none', // Sera affiché par useEyeTracking
              position: 'fixed',
              left: '-7.5px', // Centré (15px / 2)
              top: '-7.5px',
              width: '15px',
              height: '15px',
              backgroundColor: 'red',
              borderRadius: '50%',
              pointerEvents: 'none', // Ne bloque pas les clics
              zIndex: 99999,
              boxShadow: '0 0 10px rgba(255, 0, 0, 0.8)',
              willChange: 'transform' // Prévient le navigateur pour l'accélération matérielle
            }}
          />
        )}

        {/* Toggle Eye Tracking */}
        <div style={{ 
          position: 'absolute', top: '10px', right: '10px', zIndex: 100,
          display: 'flex', gap: '10px'
        }}>
           <button 
            onClick={() => {
              if (!eyeTrackingActive) {
                setEyeTrackingActive(true);
                setIsCalibrating(true);
              } else {
                setEyeTrackingActive(false);
                setIsCalibrating(false);
              }
            }}
            style={{
              padding: '8px 12px', borderRadius: '20px', border: 'none',
              background: eyeTrackingActive ? '#27ae60' : '#95a5a6',
              color: 'white', cursor: 'pointer', fontWeight: 'bold',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
            }}
          >
            {eyeTrackingActive ? '👁️ Eye-Tracking ON' : '👁️ Activer Eye-Tracking'}
          </button>
          {eyeTrackingActive && !isCalibrating && (
             <button 
             onClick={() => setIsCalibrating(true)}
             style={{
               padding: '8px 12px', borderRadius: '20px', border: 'none',
               background: '#3498db', color: 'white', cursor: 'pointer', fontWeight: 'bold',
               boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
             }}
           >
             Recalibrer
           </button>
          )}
        </div>

        {pages.length > 0 ? (
          <div
            style={{
              display: "flex",
              height: "100%",
              gap: "20px",
              padding: "20px",
            }}
          >
            <Viewer 
              pageSrc={pages[currentIndex]}
              crop={crop}
              setCrop={setCrop}
              setCompletedCrop={setCompletedCrop}
              imgRef={imgRef}
              onAnalyze={(specificCrop) => {
                const finalCrop = (specificCrop && specificCrop.width) ? specificCrop : completedCrop;
                const docName = location.state?.manga?.title || "Fichier local";
                translateSelection(imgRef.current, finalCrop, docName, currentIndex + 1);
              }}
              loading={translating}
              hasSelection={!!completedCrop}
              gazeData={gazeData}
            />

            <AnalysisPanel analysis={analysis} />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              color: "#7f8c8d",
            }}
          >
            <h1>📚 SensAI Reader</h1>
            <p>Ouvrez un document depuis la bibliothèque ou importez-en un avec le panneau de gauche</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default ReaderApp;
