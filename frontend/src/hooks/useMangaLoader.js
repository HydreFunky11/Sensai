import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configuration indispensable pour que PDF.js puisse lire les fichiers
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function useMangaLoader() {
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  async function renderPdfPageToImg(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/jpeg');
    });
  }

  async function processFile(file) {
    const newPages = [];
    if (file.type && file.type.startsWith('image/')) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = (evt) => {
          newPages.push(evt.target.result);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } else if (file.type === 'application/pdf' || file.name?.endsWith('.pdf')) {
      try {
        console.log("Lecture du PDF :", file.name || "fichier distant");
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        console.log("PDF chargé, pages :", pdf.numPages);
        
        for (let i = 1; i <= pdf.numPages; i++) {
          console.log("Rendu page :", i);
          const imgUrl = await renderPdfPageToImg(pdf, i);
          newPages.push(imgUrl);
        }
      } catch (err) {
        console.error('Erreur lecture PDF détaillée:', err);
        alert('Impossible de lire ce PDF.');
      }
    } else {
        // Fallback for unknown blob types, assume image
        const url = URL.createObjectURL(file);
        newPages.push(url);
    }
    return newPages;
  }

  async function loadFromFile(file) {
    setLoading(true);
    setPages([]);
    setCurrentIndex(0);
    const newPages = await processFile(file);
    setPages(newPages);
    setLoading(false);
  }

  async function onSelectFiles(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    setLoading(true);
    let allNewPages = [];
    for (const file of Array.from(e.target.files)) {
      const p = await processFile(file);
      allNewPages = [...allNewPages, ...p];
    }
    setPages((prev) => [...prev, ...allNewPages]);
    setLoading(false);
  }

  return {
    pages,
    currentIndex,
    setCurrentIndex,
    loading,
    onSelectFiles,
    loadFromFile,
  };
}
