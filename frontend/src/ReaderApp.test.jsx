import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReaderApp from './ReaderApp';

const mockNavigate = vi.fn();
let mockLocation = { state: null };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock('./hooks/useEyeTracking', () => ({
  useEyeTracking: () => ({
    gazeData: { x: 0, y: 0 },
    isLoaded: true,
    calibratePoint: vi.fn(),
  }),
}));

vi.mock('./hooks/useTranslation', () => ({
  useTranslation: () => ({
    analysis: null,
    setAnalysis: vi.fn(),
    loading: false,
    translateSelection: vi.fn(),
  }),
}));

let mockMangaLoader = {
  pages: [],
  currentIndex: 0,
  setCurrentIndex: vi.fn(),
  loading: false,
  onSelectFiles: vi.fn(),
  loadFromFile: vi.fn(),
};

vi.mock('./hooks/useMangaLoader', () => ({
  useMangaLoader: () => mockMangaLoader,
}));

vi.mock('./components/Sidebar/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('./components/Viewer/Viewer', () => ({
  Viewer: () => <div data-testid="viewer">Viewer</div>,
}));

vi.mock('./components/Analysis/AnalysisPanel', () => ({
  AnalysisPanel: () => <div data-testid="analysis-panel">Analysis</div>,
}));

vi.mock('./components/Calibration/CalibrationOverlay', () => ({
  CalibrationOverlay: () => <div data-testid="calibration">Calibration</div>,
}));

describe('Composant ReaderApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation = { state: null };
    mockMangaLoader = {
      pages: [],
      currentIndex: 0,
      setCurrentIndex: vi.fn(),
      loading: false,
      onSelectFiles: vi.fn(),
      loadFromFile: vi.fn(),
    };
  });

  it('affiche le message d\'accueil et le bouton retour en l\'absence de manga chargé', () => {
    render(<ReaderApp />);
    expect(screen.getByText(/SensAI Reader/i)).toBeInTheDocument();
    const backBtn = screen.getByText(/Retour à la bibliothèque/i);
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('affiche la barre supérieure avec le bouton retour, le titre et la pagination quand des pages sont chargées', () => {
    mockLocation = { state: { manga: { id: 42, title: 'One Piece Ch. 1', file_path: 'op1.pdf' } } };
    mockMangaLoader = {
      pages: ['blob:page1', 'blob:page2'],
      currentIndex: 0,
      setCurrentIndex: vi.fn(),
      loading: false,
      onSelectFiles: vi.fn(),
      loadFromFile: vi.fn(),
    };

    render(<ReaderApp />);

    // Bouton de retour en haut
    const backNavBtn = screen.getByRole('button', { name: /Retour à la bibliothèque/i });
    expect(backNavBtn).toBeInTheDocument();
    fireEvent.click(backNavBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/');

    // Titre du manga
    expect(screen.getByText(/One Piece Ch\. 1/i)).toBeInTheDocument();

    // Compteur de pagination
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // Boutons précédent et suivant
    const prevBtn = screen.getByRole('button', { name: /Page précédente/i });
    const nextBtn = screen.getByRole('button', { name: /Page suivante/i });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(mockMangaLoader.setCurrentIndex).toHaveBeenCalledWith(1);
  });
});
