import React, { useState, useRef, useEffect } from "react";
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
    loadFromLibraryManga,
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
      loadFromLibraryManga(manga).catch((err) =>
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

      {/* Overlay de Chargement initial pour les fichiers / PDF */}
      {loadingFiles && (
        <div className="glass-loader-overlay" role="status" aria-live="polite">
          <div className="glass-loader-spinner"></div>
          <h2 style={{ margin: 0, fontWeight: 700, letterSpacing: "0.5px" }}>
            Chargement de {location.state?.manga?.title || "votre document"}...
          </h2>
          <p style={{ opacity: 0.6, fontSize: "0.9rem", marginTop: "8px" }}>
            Préparation des pages en cours
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
          <div className="reader-topbar">
            <div className="reader-topbar-left">
              <button
                onClick={() => navigate("/")}
                className="reader-back-nav-btn"
                title="Retour à la bibliothèque"
                aria-label="Retour à la bibliothèque"
              >
                <span className="reader-back-icon">←</span>
                <span className="reader-back-text">Retour</span>
              </button>

              <h2 className="reader-doc-title">
                📖 {location.state?.manga?.title || "Fichier importé"}
              </h2>
            </div>

            <div className="reader-topbar-right">
              {/* Contrôles Eye Tracking WIP */}
              <div className="reader-eyetracking-controls">
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
                  className="reader-eyetracking-btn"
                  style={{
                    background: eyeTrackingActive
                      ? "#10b981"
                      : "rgba(255,255,255,0.08)",
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
                    className="reader-recalibrate-btn"
                  >
                    Recalibrer
                  </button>
                )}
              </div>

              {/* Séparateur vertical */}
              <div className="reader-separator" />

              {/* Pagination */}
              <div className="reader-pagination-controls">
                <button
                  onClick={handlePrevPage}
                  disabled={currentIndex === 0}
                  className="reader-page-nav-btn"
                  aria-label="Page précédente"
                >
                  <span className="reader-nav-full-label">Page précédente</span>
                  <span className="reader-nav-short-label">◀</span>
                </button>

                <span className="reader-page-counter">
                  {currentIndex + 1} / {pages.length}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={currentIndex === pages.length - 1}
                  className="reader-page-nav-btn"
                  aria-label="Page suivante"
                >
                  <span className="reader-nav-full-label">Page suivante</span>
                  <span className="reader-nav-short-label">▶</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {pages.length > 0 ? (
          <div className="reader-workspace">
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

            <AnalysisPanel analysis={analysis} loading={translating} />
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
                margin: "0 0 20px 0",
                fontSize: "1rem",
                lineHeight: "1.5",
              }}
            >
              Ouvrez un document depuis la bibliothèque ou importez-en un avec
              le panneau de gauche
            </p>
            <button
              onClick={() => navigate("/")}
              className="reader-empty-back-btn"
            >
              ← Retour à la bibliothèque
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default ReaderApp;
