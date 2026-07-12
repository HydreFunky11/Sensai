import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Profile from './Profile';

// Mocker react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/profile' }),
}));

// Mocker le composant Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <div data-testid="mock-navbar">Navbar</div>,
}));

// Mock API clients
vi.mock('../../api/client', () => {
  return {
    getMe: vi.fn(() => Promise.resolve({ id: 1, email: 'test@example.com', is_premium: false })),
    updateProfile: vi.fn(() => Promise.resolve({ id: 1, email: 'updated@example.com' })),
    deleteAccount: vi.fn(() => Promise.resolve({ message: "Deleted" })),
    exportUserData: vi.fn(() => Promise.resolve({ profile: { email: "test@example.com" }, library: {}, srs_revision: {} })),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
  };
});

import { getMe, deleteAccount, exportUserData } from '../../api/client';

describe('Composant Profile (Mon Profil & RGPD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait afficher les informations du profil utilisateur et la section RGPD', async () => {
    render(<Profile />);

    // Attendre le chargement
    await waitFor(() => {
      expect(getMe).toHaveBeenCalled();
    });

    expect(screen.getByText('👤 Mon Profil')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/🛡️ Gestion des données/i)).toBeInTheDocument();
    expect(screen.getByText(/Exporter mes données/i)).toBeInTheDocument();
    expect(screen.getByText(/Supprimer mon compte/i)).toBeInTheDocument();
  });

  it('devrait appeler exportUserData lors du clic sur le bouton Exporter', async () => {
    render(<Profile />);

    await waitFor(() => {
      expect(getMe).toHaveBeenCalled();
    });

    // Utilisation d'une regex tolérante car le bouton contient une émoticône
    const exportBtn = screen.getByRole('button', { name: /exporter mes données/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportUserData).toHaveBeenCalled();
    });
  });

  it('devrait appeler deleteAccount après confirmation et rediriger l\'utilisateur', async () => {
    // Mocker window.confirm et window.prompt
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'test@example.com');

    render(<Profile />);

    await waitFor(() => {
      expect(getMe).toHaveBeenCalled();
    });

    const deleteBtn = screen.getByRole('button', { name: /supprimer mon compte/i });
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(promptSpy).toHaveBeenCalled();

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });
});
