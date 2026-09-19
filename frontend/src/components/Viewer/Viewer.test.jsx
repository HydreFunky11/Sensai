import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Viewer } from './Viewer';

// Mocker client API
vi.mock('../../api/client', () => ({
  detectBubbles: vi.fn(() => Promise.resolve({
    boxes: [
      { x: 10, y: 20, width: 80, height: 100 },
      { x: 120, y: 50, width: 90, height: 110 }
    ]
  })),
}));

describe('Composant Viewer (Visionneuse de manga)', () => {
  const defaultProps = {
    pageSrc: 'blob:http://localhost/manga-page-1.jpg',
    crop: undefined,
    setCrop: vi.fn(),
    setCompletedCrop: vi.fn(),
    imgRef: { current: document.createElement('img') },
    onAnalyze: vi.fn(),
    loading: false,
    hasSelection: false,
    gazeData: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['image-bytes'], { type: 'image/jpeg' })),
      })
    );
  });

  it('devrait afficher l\'image de la page', () => {
    render(<Viewer {...defaultProps} />);
    const img = screen.getByAltText('Page du document à analyser');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', defaultProps.pageSrc);
  });

  it('ne devrait pas afficher la ligne de scan laser quand loading est faux', () => {
    render(<Viewer {...defaultProps} loading={false} />);
    expect(screen.queryByTestId('viewer-scanner-line')).not.toBeInTheDocument();
    expect(screen.queryByText(/Traduction en cours\.\.\./i)).not.toBeInTheDocument();
  });

  it('devrait afficher le faisceau laser scanner et le badge animé quand loading est vrai', () => {
    render(<Viewer {...defaultProps} loading={true} />);
    
    // Vérification de la ligne de scan laser (effet Lens)
    const scannerLine = screen.getByTestId('viewer-scanner-line');
    expect(scannerLine).toBeInTheDocument();
    expect(scannerLine).toHaveClass('viewer-scanner-line');

    // Vérification du badge animé
    expect(screen.getByText(/Traduction en cours\.\.\./i)).toBeInTheDocument();
  });

  it('devrait afficher le bouton de traduction avec spinner désactivé lors de l\'analyse', () => {
    render(
      <Viewer
        {...defaultProps}
        hasSelection={true}
        loading={true}
      />
    );

    const btn = screen.getByRole('button', { name: /Analyse en cours/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Analyse en cours...');
  });

  it('devrait permettre de cliquer sur le bouton de traduction quand une sélection est présente', () => {
    const onAnalyzeMock = vi.fn();
    render(
      <Viewer
        {...defaultProps}
        hasSelection={true}
        loading={false}
        onAnalyze={onAnalyzeMock}
      />
    );

    const btn = screen.getByRole('button', { name: /Lancer la traduction de la zone sélectionnée/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onAnalyzeMock).toHaveBeenCalledTimes(1);
  });
});
