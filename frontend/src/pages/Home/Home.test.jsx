import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Home from './Home';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

// Mocker le composant Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: ({ onImportClick }) => (
    <button data-testid="mock-navbar-import" onClick={onImportClick}>
      Import Navbar
    </button>
  ),
}));

// Mocker les appels d'API
vi.mock('../../api/client', () => ({
  getLibraryFolders: vi.fn(() => Promise.resolve([{ id: 1, name: 'Dossier Test' }])),
  getLibrary: vi.fn(() => Promise.resolve([])),
  importToLibrary: vi.fn(() => Promise.resolve({ id: 101, title: 'Manga' })),
}));

import { getLibraryFolders, getLibrary, importToLibrary } from '../../api/client';

describe('Page Home - Modale d\'Importation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait ouvrir la modale d\'importation lors de la sélection d\'un fichier image', async () => {
    render(<Home />);

    // Attendre le chargement initial
    await waitFor(() => {
      expect(getLibraryFolders).toHaveBeenCalled();
    });

    // Simuler le changement de fichier dans l'input file (sélection d'un PNG)
    const file = new File(['image-data'], 'manga_volume1.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]');
    
    // Simuler le changement de fichier
    fireEvent.change(fileInput, { target: { files: [file] } });

    // La modale d'importation doit s'ouvrir
    expect(screen.getByText('Importer une œuvre')).toBeInTheDocument();
    
    // Le titre par défaut doit être pré-rempli sans l'extension
    const titleInput = screen.getByPlaceholderText(/ex: My Hero Academia/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.value).toBe('manga_volume1');

    // Les options de découpage PDF ne doivent pas être visibles pour une image PNG
    expect(screen.queryByText(/options d'extraction pdf/i)).not.toBeInTheDocument();
  });

  it('devrait afficher les options d\'extraction si le fichier importé est un PDF', async () => {
    render(<Home />);

    const file = new File(['pdf-data'], 'one_piece.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('Importer une œuvre')).toBeInTheDocument();

    // La boîte d'options d'extraction PDF doit être affichée
    expect(screen.getByText(/options d'extraction pdf/i)).toBeInTheDocument();

    // L'option "Tout le document" doit être sélectionnée par défaut
    const radioAll = screen.getByLabelText('Tout le document');
    const radioSplit = screen.getByLabelText('Sélectionner des pages');
    expect(radioAll).toBeChecked();
    expect(radioSplit).not.toBeChecked();

    // Les champs de saisie numérique de début et fin ne doivent pas être affichés par défaut
    expect(screen.queryByText('Début')).not.toBeInTheDocument();
  });

  it('devrait afficher les champs de saisie numériques si "Sélectionner des pages" est coché', async () => {
    render(<Home />);

    const file = new File(['pdf-data'], 'one_piece.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Cocher "Sélectionner des pages"
    const radioSplit = screen.getByLabelText('Sélectionner des pages');
    fireEvent.click(radioSplit);

    // Les champs "Début" et "Fin" doivent s'afficher
    expect(screen.getByText('Début')).toBeInTheDocument();
    expect(screen.getByText('Fin')).toBeInTheDocument();
  });

  it('devrait appeler l\'API importToLibrary avec le titre personnalisé et la plage de pages au clic sur Importer', async () => {
    render(<Home />);

    const file = new File(['pdf-data'], 'one_piece.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Saisir un titre personnalisé
    const titleInput = screen.getByPlaceholderText(/ex: My Hero Academia/i);
    fireEvent.change(titleInput, { target: { value: 'One Piece Tome 100' } });

    // Sélectionner des pages (13 à 26)
    const radioSplit = screen.getByLabelText('Sélectionner des pages');
    fireEvent.click(radioSplit);

    const startInput = screen.getByPlaceholderText('1');
    const endInput = screen.getByPlaceholderText('12');
    fireEvent.change(startInput, { target: { value: '13' } });
    fireEvent.change(endInput, { target: { value: '26' } });

    // Cliquer sur le bouton Importer de la modale
    const submitBtn = screen.getByRole('button', { name: 'Importer' });
    fireEvent.click(submitBtn);

    // Vérifier que l'API est appelée avec les bons paramètres de découpage
    await waitFor(() => {
      expect(importToLibrary).toHaveBeenCalledWith(file, null, 'One Piece Tome 100', 13, 26);
    });
  });
});
