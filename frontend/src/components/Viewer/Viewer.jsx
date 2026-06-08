import React from 'react';
import ReactCrop from 'react-image-crop';
import "react-image-crop/dist/ReactCrop.css";

export function Viewer({ pageSrc, crop, setCrop, setCompletedCrop, imgRef, onAnalyze, loading, hasSelection }) {
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
        }}
      >
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
              maxHeight: "calc(100vh - 150px)",
              maxWidth: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </ReactCrop>
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
