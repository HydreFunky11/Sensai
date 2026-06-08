import React from 'react';

export function Sidebar({ pages, currentIndex, onSelectFiles, onPageChange }) {
  return (
    <div
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
          style={{ display: "none" }}
        />
      </label>

      {pages.map((pageSrc, index) => (
        <div
          key={index}
          onClick={() => onPageChange(index)}
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
            alt={`Page ${index + 1}`}
            style={{ width: "100%", display: "block" }}
          />
          <div
            style={{ textAlign: "center", fontSize: "12px", padding: "2px" }}
          >
            Page {index + 1}
          </div>
        </div>
      ))}
    </div>
  );
}
