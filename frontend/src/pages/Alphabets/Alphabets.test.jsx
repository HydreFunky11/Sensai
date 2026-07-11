import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Alphabets from './Alphabets';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/alphabets' }),
}));

// Mocker le composant Navbar pour isoler le test d'Alphabets
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <div data-testid="mock-navbar">Navbar</div>,
}));

// Mocker les appels d'API du client
vi.mock('../../api/client', () => ({
  getDecks: vi.fn(() => Promise.resolve([{ id: 1, title: 'Dossier Principal' }])),
  createFlashcard: vi.fn(() => Promise.resolve({ id: 101, text_source: 'あ' })),
  toggleLearnedCharacter: vi.fn((char) => Promise.resolve({ status: 'added', character: char })),
  getLearnedCharacters: vi.fn(() => Promise.resolve(['あ', 'い'])),
}));

import { getDecks, toggleLearnedCharacter, getLearnedCharacters } from '../../api/client';

describe('Composant Alphabets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait afficher la barre de navigation et les onglets d\'alphabets', async () => {
    render(<Alphabets />);

    // Vérifie le rendu de la Navbar mockée
    expect(screen.getByTestId('mock-navbar')).toBeInTheDocument();

    // Vérifie la présence des boutons d'onglets
    expect(screen.getByRole('button', { name: /hiragana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /katakana/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kanji/i })).toBeInTheDocument();
  });

  it('devrait charger les dossiers et les caractères appris au montage', async () => {
    render(<Alphabets />);

    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
      expect(getLearnedCharacters).toHaveBeenCalled();
    });
  });

  it('devrait sélectionner un caractère et afficher ses détails', async () => {
    render(<Alphabets />);

    // Attendre le chargement
    await waitFor(() => {
      expect(getLearnedCharacters).toHaveBeenCalled();
    });

    // Clic sur le caractère "い" dans la grille
    const charBtn = screen.getByRole('button', { name: /い/i });
    fireEvent.click(charBtn);

    // Vérifie que le volet de détail affiche bien "い" et son Romaji "i"
    expect(screen.getAllByText('い')).toHaveLength(2); // Un dans la grille, un dans l'entête
    expect(screen.getAllByText('i').length).toBeGreaterThan(0);
  });

  it('devrait basculer l\'état "Je connais" au clic sur le bouton', async () => {
    render(<Alphabets />);

    await waitFor(() => {
      expect(getLearnedCharacters).toHaveBeenCalled();
    });

    // Sélectionner un caractère non appris, par exemple "う" (non présent dans le mock initial ['あ', 'い'])
    const charBtn = screen.getByRole('button', { name: /う/i });
    fireEvent.click(charBtn);

    // Trouver le bouton "Je connais" dans la fiche de détails
    const knownBtn = screen.getByRole('button', { name: /je connais/i });
    expect(knownBtn).toBeInTheDocument();

    // Clic sur "Je connais"
    fireEvent.click(knownBtn);

    // Vérifier que l'API est appelée avec les bons paramètres
    await waitFor(() => {
      expect(toggleLearnedCharacter).toHaveBeenCalledWith('う', 'hiragana');
      expect(screen.getByRole('button', { name: /✓ connu/i })).toBeInTheDocument();
    });
  });
});
