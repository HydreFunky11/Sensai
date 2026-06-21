import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMangaLoader } from "./hooks/useMangaLoader";
import { useTranslation } from "./hooks/useTranslation";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { Viewer } from "./components/Viewer/Viewer";
import { AnalysisPanel } from "./components/Analysis/AnalysisPanel";
import { CalibrationOverlay } from "./components/Calibration/CalibrationOverlay";
import { useEyeTracking } from "./hooks/useEyeTracking";
import { getMangaFileBlob } from "./api/client";
import { toast } from "react-hot-toast";

function ReaderApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    pages,
    currentIndex,
    setCurrentIndex,
    loading: loadingFiles,
    onSelectFiles,
    loadFromFile,
  } = useMangaLoader();
  const {
    analysis,
    setAnalysis,
    loading: translating,
    translateSelection,
  } = useTranslation();

  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  // Eye Tracking (WIP)
  const [eyeTrackingActive, setEyeTrackingActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const { gazeData, isLoaded, calibratePoint } =
    useEyeTracking(eyeTrackingActive);

  // Écouter le clignement pour traduire
  useEffect(() => {
    const handleBlink = () => {
      console.log("😉 Clignement détecté !");
      // On cherche l'élément sous le regard au moment du clignement
      const element = document.elementFromPoint(gazeData.x, gazeData.y);
      // Si c'est une bulle (bouton dans Viewer), on simule un clic
      if (
        element &&
        element.tagName === "BUTTON" &&
        element.getAttribute("aria-label")?.includes("Zone de texte")
      ) {
        console.log(
          "🎯 Cible trouvée sous le regard, lancement de la traduction...",
        );
        element.click();
      }
    };

    window.addEventListener("eye-blink", handleBlink);
    return () => window.removeEventListener("eye-blink", handleBlink);
  }, [gazeData, eyeTrackingActive]);

  // Charger le manga si passé depuis la bibliothèque
  useEffect(() => {
    const manga = location.state?.manga;
    if (manga) {
      getMangaFileBlob(manga.id)
        .then((blob) => {
          const file = new File(
            [blob],
            manga.title + (manga.file_path.endsWith(".pdf") ? ".pdf" : ".jpg"),
            { type: blob.type },
          );
          loadFromFile(file);
        })
        .catch((err) =>
          toast.error("Impossible de charger le document: " + err.message),
        );
    }
  }, [location.state]);

  const handlePageChange = (index) => {
    setCurrentIndex(index);
    setCrop(undefined);
    setCompletedCrop(null);
    setAnalysis(null);
  };

  const handlePrevPage = () => {
    if (currentIndex > 0) {
      handlePageChange(currentIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentIndex < pages.length - 1) {
      handlePageChange(currentIndex + 1);
    }
  };

  const isLoading = loadingFiles || translating;

  return (
    <div className="reader-container">
      {/* Overlay de Calibration */}
      {isCalibrating && (
        <CalibrationOverlay
          onComplete={() => setIsCalibrating(false)}
          calibratePoint={calibratePoint}
          gazeData={gazeData}
        />
      )}

      {/* Réticule de suivi oculaire (Optimisé GPU) */}
      {eyeTrackingActive && !isCalibrating && (
        <div
          id="custom-gaze-dot"
          style={{
            display: "none", // Géré par useEyeTracking.js
            position: "fixed",
            left: "-7.5px", // Centré (15px / 2)
            top: "-7.5px",
            width: "15px",
            height: "15px",
            backgroundColor: "#ef4444",
            borderRadius: "50%",
            pointerEvents: "none", // Ne bloque pas les clics
            zIndex: 99999,
            boxShadow: "0 0 12px rgba(239, 68, 68, 0.8)",
            willChange: "transform",
          }}
        />
      )}

      {/* Overlay de Chargement Premium */}
      {isLoading && (
        <div className="glass-loader-overlay" role="status" aria-live="polite">
          <div className="glass-loader-spinner"></div>
          <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: "0.5px" }}>
            {loadingFiles
              ? "Chargement du document..."
              : "Analyse SensAI en cours..."}
          </h2>
          <p style={{ opacity: 0.6, fontSize: "0.9rem", marginTop: "8px" }}>
            Veuillez patienter quelques instants
          </p>
        </div>
      )}

      <Sidebar
        pages={pages}
        currentIndex={currentIndex}
        onSelectFiles={onSelectFiles}
        onPageChange={handlePageChange}
      />

      <main className="reader-main">
        {/* Barre de contrôle supérieure (Pagination & Infos & Eye Tracking) */}
        {pages.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 24px",
              background: "#111113",
              borderBottom: "1px solid #1f1f23",
              zIndex: 10,
              height: "56px",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                fontSize: "0.95rem",
                margin: 0,
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              📖 {location.state?.manga?.title || "Fichier importé"}
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {/* Contrôles Eye Tracking WIP */}
              <div style={{ display: "flex", gap: "10px" }}>
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
                    padding: "6px 14px",
                    borderRadius: "20px",
                    background: eyeTrackingActive
                      ? "#10b981"
                      : "rgba(255,255,255,0.08)",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "0.75rem",
                    transition: "all 0.2s",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    border:
                      "1px solid " +
                      (eyeTrackingActive ? "#10b981" : "#3f3f46"),
                  }}
                >
                  {eyeTrackingActive
                    ? "👁️ Eye-Tracking Activé"
                    : "👁️ Activer Eye-Tracking (WIP)"}
                </button>
                {eyeTrackingActive && !isCalibrating && (
                  <button
                    onClick={() => setIsCalibrating(true)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      border: "none",
                      background: "#3b82f6",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "0.75rem",
                      transition: "all 0.2s",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    }}
                  >
                    Recalibrer
                  </button>
                )}
              </div>

              {/* Séparateur vertical */}
              <div
                style={{ width: "1px", height: "20px", background: "#27272a" }}
              />

              {/* Pagination */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                <button
                  onClick={handlePrevPage}
                  disabled={currentIndex === 0}
                  style={{
                    background:
                      currentIndex === 0
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.05)",
                    color: currentIndex === 0 ? "#4b5563" : "#f8fafc",
                    border:
                      "1px solid " +
                      (currentIndex === 0 ? "#27272a" : "#3f3f46"),
                    borderRadius: "6px",
                    padding: "6px 12px",
                    cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    transition: "all 0.2s",
                  }}
                >
                  Page précédente
                </button>

                <span
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: "#f1f5f9",
                  }}
                >
                  {currentIndex + 1} / {pages.length}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={currentIndex === pages.length - 1}
                  style={{
                    background:
                      currentIndex === pages.length - 1
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(255,255,255,0.05)",
                    color:
                      currentIndex === pages.length - 1 ? "#4b5563" : "#f8fafc",
                    border:
                      "1px solid " +
                      (currentIndex === pages.length - 1
                        ? "#27272a"
                        : "#3f3f46"),
                    borderRadius: "6px",
                    padding: "6px 12px",
                    cursor:
                      currentIndex === pages.length - 1
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    transition: "all 0.2s",
                  }}
                >
                  Page suivante
                </button>
              </div>
            </div>
          </div>
        )}

        {pages.length > 0 ? (
          <div
            style={{
              display: "flex",
              height: "calc(100% - 56px)",
              gap: "0",
              padding: "0",
            }}
          >
            <Viewer
              pageSrc={pages[currentIndex]}
              crop={crop}
              setCrop={setCrop}
              setCompletedCrop={setCompletedCrop}
              imgRef={imgRef}
              onAnalyze={(specificCrop) => {
                const finalCrop =
                  specificCrop && specificCrop.width
                    ? specificCrop
                    : completedCrop;
                const docName = location.state?.manga?.title || "Fichier local";
                translateSelection(
                  imgRef.current,
                  finalCrop,
                  docName,
                  currentIndex + 1,
                );
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
              color: "#64748b",
              background: "#09090b",
              textAlign: "center",
              padding: "20px",
            }}
          >
            <h1
              style={{
                color: "#f1f5f9",
                fontWeight: 800,
                fontSize: "2.2rem",
                margin: "0 0 10px 0",
              }}
            >
              📚 SensAI Reader
            </h1>
            <p
              style={{
                maxWidth: "400px",
                margin: 0,
                fontSize: "1rem",
                lineHeight: "1.5",
              }}
            >
              Ouvrez un document depuis la bibliothèque ou importez-en un avec
              le panneau de gauche
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default ReaderApp;
