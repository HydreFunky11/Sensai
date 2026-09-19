import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Lens from './Lens';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/lens' }),
}));

// Mocker Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar">Navbar SensAI</nav>,
}));

// Mocker client API
vi.mock('../../api/client', () => ({
  detectBubbles: vi.fn(() => Promise.resolve({
    boxes: [
      { x: 10, y: 20, width: 80, height: 100 },
      { x: 120, y: 50, width: 90, height: 110 }
    ]
  })),
  analyzeImage: vi.fn(() => Promise.resolve({
    original: 'こんにちは世界',
    translation: 'Bonjour le monde',
    romaji: 'Konnichiwa sekai',
    breakdown: [
      { word: 'こんにちは', type: 'expression', meaning: 'Bonjour', romanji: 'konnichiwa' },
      { word: '世界', type: 'nom', meaning: 'monde', romanji: 'sekai' }
    ]
  })),
  getDecks: vi.fn(() => Promise.resolve([{ id: 1, title: 'Vocabulaire Manga' }])),
  createDeck: vi.fn((title) => Promise.resolve({ id: 2, title })),
  createFlashcard: vi.fn(() => Promise.resolve({ id: 10, text_source: 'こんにちは世界' })),
  getAudioUrl: vi.fn((text) => `http://testserver/tts?text=${encodeURIComponent(text)}`),
}));

import { detectBubbles, analyzeImage } from '../../api/client';

describe('Page SensAI Lens (Mode Scan Photo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-photo-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('devrait afficher l\'écran d\'accueil Lens avec les options de capture', () => {
    render(<Lens />);

    expect(screen.getByText('SensAI Lens')).toBeInTheDocument();
    expect(screen.getByText('Scanner un Manga Papier')).toBeInTheDocument();
    expect(screen.getByText(/Ouvrir l'appareil photo/i)).toBeInTheDocument();
    expect(screen.getByText(/Importer depuis mes fichiers/i)).toBeInTheDocument();
    expect(screen.getByText(/Tester immédiatement avec un exemple/i)).toBeInTheDocument();
  });

  it('devrait charger une photo depuis l\'input caméra et lancer la détection des bulles', async () => {
    render(<Lens />);

    const cameraInput = screen.getByTestId('lens-camera-input');
    const file = new File(['fake-manga-photo'], 'manga_page.jpg', { type: 'image/jpeg' });

    fireEvent.change(cameraInput, { target: { files: [file] } });

    // L'aperçu de l'image doit s'afficher
    const img = screen.getByAltText('Page de manga photographiée');
    expect(img).toBeInTheDocument();

    // La détection des bulles doit avoir été appelée
    await waitFor(() => {
      expect(detectBubbles).toHaveBeenCalled();
    });

    // Les boutons d'action doivent être présents
    expect(screen.getByText(/Pivoter 90°/i)).toBeInTheDocument();
    expect(screen.getByText(/Re-détecter/i)).toBeInTheDocument();
    expect(screen.getByText(/Fermer/i)).toBeInTheDocument();
  });

  it('devrait afficher les bulles détectées et permettre de lancer la traduction au clic', async () => {
    render(<Lens />);

    const galleryInput = screen.getByTestId('lens-gallery-input');
    const file = new File(['fake-manga-photo'], 'manga_page.jpg', { type: 'image/jpeg' });

    fireEvent.change(galleryInput, { target: { files: [file] } });

    // Attendre la détection
    await waitFor(() => {
      expect(screen.getByLabelText('Bulle de texte détectée 1')).toBeInTheDocument();
    });

    const bubble1 = screen.getByLabelText('Bulle de texte détectée 1');
    expect(bubble1).toBeInTheDocument();

    // Mocker les propriétés naturelles de l'image
    const img = screen.getByAltText('Page de manga photographiée');
    Object.defineProperty(img, 'naturalWidth', { value: 800 });
    Object.defineProperty(img, 'naturalHeight', { value: 1200 });
    Object.defineProperty(img, 'width', { value: 400 });
    Object.defineProperty(img, 'height', { value: 600 });

    // Mocker HTMLCanvasElement.toBlob
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
      callback(new Blob(['cropped-data'], { type: 'image/jpeg' }));
    });

    // Clic sur la bulle 1
    fireEvent.click(bubble1);

    // L'analyse doit être déclenchée
    await waitFor(() => {
      expect(analyzeImage).toHaveBeenCalled();
    });

    // Le résultat d'analyse doit être affiché dans le panneau
    await waitFor(() => {
      expect(screen.getByText('Bonjour le monde')).toBeInTheDocument();
      expect(screen.getByText('Konnichiwa sekai')).toBeInTheDocument();
      expect(screen.getByText('こんにちは')).toBeInTheDocument();
    });
  });

  it('devrait permettre de fermer l\'image et revenir à l\'écran de capture', async () => {
    render(<Lens />);

    const galleryInput = screen.getByTestId('lens-gallery-input');
    const file = new File(['fake-manga-photo'], 'manga_page.jpg', { type: 'image/jpeg' });
    fireEvent.change(galleryInput, { target: { files: [file] } });

    expect(screen.getByAltText('Page de manga photographiée')).toBeInTheDocument();

    const closeBtn = screen.getByText(/Fermer/i);
    fireEvent.click(closeBtn);

    // L'écran d'accueil doit réapparaître
    expect(screen.getByText('Scanner un Manga Papier')).toBeInTheDocument();
    expect(screen.queryByAltText('Page de manga photographiée')).not.toBeInTheDocument();
  });
});
