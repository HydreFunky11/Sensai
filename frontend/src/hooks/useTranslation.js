import { useState } from 'react';
import { analyzeImage } from '../api/client';

export function useTranslation() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const translateSelection = async (imgRef, completedCrop, documentName = "", page = 0) => {
    if (!completedCrop || !imgRef) return;

    setLoading(true);
    setAnalysis(null);

    try {
      const blob = await getCroppedImg(imgRef, completedCrop);
      if (!blob) {
        throw new Error("Impossible de générer l'image de la sélection (recadrage vide ou invalide)");
      }
      
      const coords = {
        x: Math.round(completedCrop.x),
        y: Math.round(completedCrop.y),
        width: Math.round(completedCrop.width),
        height: Math.round(completedCrop.height)
      };

      const data = await analyzeImage(blob, documentName, page, coords);
      setAnalysis(data);
    } catch (error) {
      console.error("Erreur lors de la traduction :", error);
      alert(error.message || 'Erreur analyse');
    } finally {
      setLoading(false);
    }
  };

  async function getCroppedImg(image, crop) {
    if (!crop.width || !crop.height) return null;

    const canvas = document.createElement('canvas');
    // On utilise directement les coordonnées (supposées naturelles)
    canvas.width = crop.width;
    canvas.height = crop.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95)
    );
  }

  return {
    analysis,
    setAnalysis,
    loading,
    translateSelection,
  };
}
