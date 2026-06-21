import React from 'react';

export function Sidebar({ pages, currentIndex, onSelectFiles, onPageChange }) {
  return (
    <nav
      aria-label="Navigation des pages"
      style={{
        width: "200px",
        background: "#2c3e50",
        color: "white",
        padding: "10px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flexShrink: 0,
      }}
    >
      <h3 style={{ margin: "10px 0", textAlign: "center" }}>Bibliothèque</h3>
      <label
        style={{
          background: "#3498db",
          padding: "10px",
          textAlign: "center",
          cursor: "pointer",
          borderRadius: "5px",
        }}
      >
        + Ajouter
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={onSelectFiles}
          aria-label="Ajouter des fichiers"
          style={{ display: "none" }}
        />
      </label>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        {pages.map((pageSrc, index) => (
          <li
            key={index}
            onClick={() => onPageChange(index)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPageChange(index); }}
            tabIndex="0"
            role="button"
            aria-current={currentIndex === index ? "page" : undefined}
            aria-label={`Aller à la page ${index + 1}`}
            style={{
              border:
                currentIndex === index
                  ? "3px solid #3498db"
                  : "1px solid #7f8c8d",
              cursor: "pointer",
              opacity: currentIndex === index ? 1 : 0.6,
            }}
          >
            <img
              src={pageSrc}
              alt="" // Alt vide car l'aria-label du li décrit déjà l'action
              aria-hidden="true"
              style={{ width: "100%", display: "block" }}
            />
            <div
              style={{ textAlign: "center", fontSize: "12px", padding: "2px" }}
            >
              Page {index + 1}
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
