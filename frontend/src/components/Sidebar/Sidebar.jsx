import React from "react";
import { useNavigate } from "react-router-dom";

export function Sidebar({ pages, currentIndex, onSelectFiles, onPageChange }) {
  const navigate = useNavigate();
  return (
    <nav aria-label="Navigation des pages" className="reader-sidebar">
      <h3>Pages</h3>

      <button
        onClick={() => navigate("/home")}
        className="reader-sidebar-add-btn"
        aria-label="Retourner à la bibliothèque"
      >
        Bibliothèque
      </button>

      <ul className="reader-sidebar-list">
        {pages.map((pageSrc, index) => {
          const isActive = currentIndex === index;
          return (
            <li
              key={index}
              onClick={() => onPageChange(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPageChange(index);
              }}
              tabIndex="0"
              role="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={`Aller à la page ${index + 1}`}
              className={`reader-sidebar-item ${isActive ? "active" : ""}`}
            >
              <img
                src={pageSrc}
                alt="" // Alt vide car l'aria-label du li décrit déjà l'action
                aria-hidden="true"
                className="reader-sidebar-thumb"
              />
              <div className="reader-sidebar-page-label">Page {index + 1}</div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
