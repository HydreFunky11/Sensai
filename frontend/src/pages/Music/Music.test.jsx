import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Music from './Music';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/music' }),
}));

// Mocker Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar">Navbar SensAI</nav>,
}));

// Mocker API Client
vi.mock('../../api/client', () => ({
  getMusicPresets: vi.fn(() => Promise.resolve([
    {
      id: 'preset-1',
      title: 'Idol (アイドル)',
      artist: 'YOASOBI',
      anime: 'Oshi no Ko (Opening 1)',
      spotify_url: 'https://open.spotify.com/track/7vRri9DEyKtA1EIGjuz1L4',
      thumbnail: 'https://example.com/thumb.jpg',
      track_id: '7vRri9DEyKtA1EIGjuz1L4',
      embed_url: 'https://open.spotify.com/embed/track/7vRri9DEyKtA1EIGjuz1L4'
    }
  ])),
  resolveSpotifyTrack: vi.fn(() => Promise.resolve({
    track_id: '7vRri9DEyKtA1EIGjuz1L4',
    title: 'Idol',
    artist: 'YOASOBI',
    thumbnail: 'https://example.com/thumb.jpg',
    embed_url: 'https://open.spotify.com/embed/track/7vRri9DEyKtA1EIGjuz1L4'
  })),
  getMusicLyrics: vi.fn(() => Promise.resolve({
    title: 'Idol',
    artist: 'YOASOBI',
    jlpt_level: 'N3',
    vocabulary: [
      { word: '無敵', romanji: 'muteki', meaning: 'invincible', type: 'nom' },
      { word: '笑顔', romanji: 'egao', meaning: 'sourire', type: 'nom' }
    ],
    lines: [
      {
        id: 1,
        japanese: '無敵の笑顔で荒らすメディア',
        romaji: 'Muteki no egao de arasu media',
        translation: 'Conquérant les médias avec un sourire invincible',
        time: 0.0,
        duration: 4.0
      }
    ]
  })),
  getDecks: vi.fn(() => Promise.resolve([{ id: 1, title: 'Musique J-Pop' }])),
  createDeck: vi.fn((title) => Promise.resolve({ id: 2, title })),
  createFlashcard: vi.fn(() => Promise.resolve({ id: 101, text_source: '無敵の笑顔で荒らすメディア' })),
  getAudioUrl: vi.fn((text) => `http://testserver/tts?text=${encodeURIComponent(text)}`),
}));

import { getMusicPresets, resolveSpotifyTrack, getMusicLyrics, createFlashcard } from '../../api/client';

describe('Page SensAI Music (Spotify & Karaoké)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('devrait afficher la saisie manuelle Titre/Artiste par défaut et permettre de basculer vers Lien Spotify', async () => {
    render(<Music />);

    expect(screen.getByText(/SensAI Music & Karaoké/i)).toBeInTheDocument();
    // Option principale : Titre & Artiste
    expect(screen.getByPlaceholderText(/Nom de la musique/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Nom de l'artiste/i)).toBeInTheDocument();
    expect(screen.getByText('✨ Analyser Paroles')).toBeInTheDocument();

    // Bascule vers Lien Spotify
    const spotifyTab = screen.getByRole('tab', { name: /Lien Spotify/i });
    fireEvent.click(spotifyTab);
    expect(screen.getByPlaceholderText(/Collez un lien Spotify/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getMusicPresets).toHaveBeenCalled();
      expect(screen.getByText(/YOASOBI — Idol/i)).toBeInTheDocument();
    });
  });

  it('devrait charger un morceau suggéré, afficher le lecteur Spotify et les paroles', async () => {
    render(<Music />);

    await waitFor(() => {
      expect(screen.getByText(/YOASOBI — Idol/i)).toBeInTheDocument();
    });

    const presetBtn = screen.getByText(/YOASOBI — Idol/i);
    fireEvent.click(presetBtn);

    await waitFor(() => {
      expect(resolveSpotifyTrack).toHaveBeenCalled();
      expect(getMusicLyrics).toHaveBeenCalled();
    });

    // Titre et badges
    await waitFor(() => {
      expect(screen.getByText(/Niveau linguistique : JLPT N3/i)).toBeInTheDocument();
      expect(screen.getByText('無敵の笑顔で荒らすメディア')).toBeInTheDocument();
      expect(screen.getByText('Muteki no egao de arasu media')).toBeInTheDocument();
      expect(screen.getByText('Conquérant les médias avec un sourire invincible')).toBeInTheDocument();
    });

    // Mots de vocabulaire
    expect(screen.getByText('無敵')).toBeInTheDocument();
    expect(screen.getByText('sourire')).toBeInTheDocument();
  });

  it('devrait permettre de sauvegarder un vers en carte Anki', async () => {
    render(<Music />);

    await waitFor(() => {
      expect(screen.getByText(/YOASOBI — Idol/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/YOASOBI — Idol/i));

    await waitFor(() => {
      expect(screen.getByText('💾 Fiche')).toBeInTheDocument();
    });

    const saveBtn = screen.getByText('💾 Fiche');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createFlashcard).toHaveBeenCalledWith(expect.objectContaining({
        text_source: '無敵の笑顔で荒らすメディア',
        translation: 'Conquérant les médias avec un sourire invincible',
        romaji: 'Muteki no egao de arasu media'
      }));
      expect(screen.getByText('Sauvegardé ✓')).toBeInTheDocument();
    });
  });

  it('devrait basculer le mode karaoké au clic', async () => {
    render(<Music />);

    await waitFor(() => {
      expect(screen.getByText(/YOASOBI — Idol/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/YOASOBI — Idol/i));

    await waitFor(() => {
      expect(screen.getByText(/Activer Mode Karaoké/i)).toBeInTheDocument();
    });

    const karaokeToggle = screen.getByText(/Activer Mode Karaoké/i);
    fireEvent.click(karaokeToggle);

    expect(screen.getByText(/Mode Karaoké Actif/i)).toBeInTheDocument();
  });

  it('devrait afficher la zone de paroles personnalisées au clic', () => {
    render(<Music />);

    const toggleCustomBtn = screen.getByText('📝 Coller mes paroles');
    fireEvent.click(toggleCustomBtn);

    expect(screen.getByPlaceholderText(/Collez ici les paroles japonaises/i)).toBeInTheDocument();
  });
});
