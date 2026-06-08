import { useState } from 'react';
import { analyzeImage } from '../api/client';

export function useTranslation() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const translateSelection = async (imgRef, completedCrop) => {
    if (!completedCrop || !imgRef) return;

    setLoading(true);
    setAnalysis(null);

    try {
      const blob = await getCroppedImg(imgRef, completedCrop);
      const data = await analyzeImage(blob);
      setAnalysis(data);
    } catch (error) {
      console.error(error);
      alert('Erreur analyse');
    } finally {
      setLoading(false);
    }
  };

  async function getCroppedImg(image, crop) {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg')
    );
  }

  return {
    analysis,
    setAnalysis,
    loading,
    translateSelection,
  };
}
