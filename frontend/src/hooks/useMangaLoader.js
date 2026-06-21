import { useState, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export function useMangaLoader() {
  const [pages, setPages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Cette ref va stocker un ID unique pour chaque session de chargement
  const lastLoadId = useRef(0);

  async function renderPdfPageToImg(pdf, pageNumber) {
    const page = await pdf.getPage(pageNumber);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), "image/jpeg");
    });
  }

  async function processFile(file, onPageReady, currentLoadId) {
    if (file.type && file.type.startsWith("image/")) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = (evt) => {
          if (currentLoadId === lastLoadId.current)
            onPageReady(evt.target.result);
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } else if (file.type === "application/pdf" || file.name?.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          // Si un nouveau chargement a commencé entre temps, on arrête celui-ci
          if (currentLoadId !== lastLoadId.current) break;

          const imgUrl = await renderPdfPageToImg(pdf, i);
          if (currentLoadId === lastLoadId.current) onPageReady(imgUrl);
        }
      } catch (err) {
        console.error("Erreur PDF:", err);
      }
    } else {
      const url = URL.createObjectURL(file);
      if (currentLoadId === lastLoadId.current) onPageReady(url);
    }
  }

  async function loadFromFile(file) {
    const currentId = ++lastLoadId.current; // On incrémente l'ID
    setLoading(true);
    setPages([]);
    setCurrentIndex(0);

    await processFile(
      file,
      (imgUrl) => {
        setPages((prev) => [...prev, imgUrl]);
        setLoading(false);
      },
      currentId,
    );
  }

  async function onSelectFiles(e) {
    if (!e.target.files || e.target.files.length === 0) return;
    const currentId = ++lastLoadId.current;
    setLoading(true);
    setPages([]); // On vide pour repartir sur une nouvelle sélection

    const files = Array.from(e.target.files);
    for (const file of files) {
      if (currentId !== lastLoadId.current) break;
      await processFile(
        file,
        (imgUrl) => {
          setPages((prev) => [...prev, imgUrl]);
          setLoading(false);
        },
        currentId,
      );
    }
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
