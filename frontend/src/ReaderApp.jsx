import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMangaLoader } from "./hooks/useMangaLoader";
import { useTranslation } from "./hooks/useTranslation";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Viewer } from "./components/Viewer/Viewer";
import { AnalysisPanel } from "./components/Analysis/AnalysisPanel";
import { getMangaFileBlob } from "./api/client";

function ReaderApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pages, currentIndex, setCurrentIndex, loading: loadingFiles, onSelectFiles, loadFromFile } = useMangaLoader();
  const { analysis, setAnalysis, loading: translating, translateSelection } = useTranslation();
  
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

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

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#ecf0f1",
          overflow: "hidden",
        }}
      >
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
              onAnalyze={() => translateSelection(imgRef.current, completedCrop)}
              loading={translating}
              hasSelection={!!completedCrop}
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
      </div>
    </div>
  );
}

export default ReaderApp;
