import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Study from './Study';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mocker le composant Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <div data-testid="mock-navbar">Navbar</div>,
}));

// Mock API clients
vi.mock('../../api/client', () => {
  const mockDueCards = [
    {
      id: 201,
      deck_id: 1,
      text_source: "こんにちは",
      translation: "Bonjour",
      romaji: "konnichiwa",
      context_note: "greeting"
    },
    {
      id: 202,
      deck_id: 1,
      text_source: "あ",
      translation: "a",
      romaji: "a",
      context_note: "character"
    }
  ];

  return {
    getDecks: vi.fn(() => Promise.resolve([{ id: 1, title: 'Dossier Principal' }])),
    getDueFlashcards: vi.fn(() => Promise.resolve(mockDueCards)),
    getFlashcards: vi.fn(() => Promise.resolve(mockDueCards)),
    submitCardReview: vi.fn(() => Promise.resolve({ message: "Review saved" })),
    getAudioUrl: vi.fn(() => "http://mock-audio-url"),
    logDeckCompletion: vi.fn(() => Promise.resolve({ message: "Complete" })),
  };
});

import { getDecks, getDueFlashcards, submitCardReview } from '../../api/client';

describe('Composant Study (Révisions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait afficher la liste des dossiers de révision', async () => {
    render(<Study />);
    
    // Attendre le chargement des decks
    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
    });

    expect(screen.getByText('📚 Dossiers de révision')).toBeInTheDocument();
    expect(screen.getByText('Dossier Principal')).toBeInTheDocument();
  });

  it('devrait lancer une session de révision au clic sur le bouton Réviser', async () => {
    render(<Study />);

    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
    });

    // Clic sur Réviser
    const reviewBtn = screen.getByRole('button', { name: /réviser/i });
    fireEvent.click(reviewBtn);

    // Attendre le chargement de la session
    await waitFor(() => {
      expect(getDueFlashcards).toHaveBeenCalledWith(1);
    });

    // Devrait afficher la première carte (normale) : son texte source (Recto)
    expect(screen.getByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /afficher la réponse/i })).toBeInTheDocument();
  });

  it('devrait basculer vers le Verso et afficher les boutons d\'évaluation pour une carte normale', async () => {
    render(<Study />);

    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
    });

    // Démarrer la session
    fireEvent.click(screen.getByRole('button', { name: /réviser/i }));

    await waitFor(() => {
      expect(getDueFlashcards).toHaveBeenCalled();
    });

    // Clic sur "Afficher la réponse"
    fireEvent.click(screen.getByRole('button', { name: /afficher la réponse/i }));

    // Vérifie le Verso
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
    expect(screen.getByText('konnichiwa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trop facile/i })).toBeInTheDocument();
  });

  it('devrait adapter l\'interface pour les cartes de type "character" (Romaji + Canvas au Recto)', async () => {
    render(<Study />);

    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
    });

    // Démarrer la session
    fireEvent.click(screen.getByRole('button', { name: /réviser/i }));

    await waitFor(() => {
      expect(getDueFlashcards).toHaveBeenCalled();
    });

    // Passer à la deuxième carte (qui est de type "character")
    // 1. Afficher le verso de la première
    fireEvent.click(screen.getByRole('button', { name: /afficher la réponse/i }));
    // 2. Valider (Je sais) pour passer à la suivante
    fireEvent.click(screen.getByRole('button', { name: /je sais/i }));

    // Vérifier l'interface de la carte caractère "a"
    await waitFor(() => {
      // Le Recto doit afficher le Romaji "a" en grand à la place du kanji/kana
      expect(screen.getByText('a')).toBeInTheDocument();
      // Devrait inviter à tracer le caractère
      expect(screen.getByText(/tracez le caractère correspondant/i)).toBeInTheDocument();
      // Le bouton "Afficher la réponse" n'est plus visible, remplacé par "Je ne sais plus" et le tracé
      expect(screen.queryByRole('button', { name: /afficher la réponse/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /je ne sais plus/i })).toBeInTheDocument();
    });
  });

  it('devrait afficher le tracé complet et le bouton de continuation au clic sur "Je ne sais plus" pour un caractère', async () => {
    render(<Study />);

    await waitFor(() => {
      expect(getDecks).toHaveBeenCalled();
    });

    // Lancer et aller sur la carte caractère
    fireEvent.click(screen.getByRole('button', { name: /réviser/i }));
    await waitFor(() => { expect(getDueFlashcards).toHaveBeenCalled(); });
    fireEvent.click(screen.getByRole('button', { name: /afficher la réponse/i }));
    fireEvent.click(screen.getByRole('button', { name: /je sais/i }));

    // Clic sur "Je ne sais plus"
    await waitFor(() => {
      expect(screen.getByText('a')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /je ne sais plus/i }));

    // Vérifier que le Verso s'affiche avec le bon message d'explication
    expect(screen.getByText(/voici le tracé correct/i)).toBeInTheDocument();
    // Le bouton unique de continuation est visible
    const continueBtn = screen.getByRole('button', { name: /continuer/i });
    expect(continueBtn).toBeInTheDocument();

    // Clic sur "Continuer" doit soumettre une révision de qualité 1
    fireEvent.click(continueBtn);
    expect(submitCardReview).toHaveBeenCalledWith(202, 1);
  });
});
