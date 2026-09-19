import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Admin from './Admin';

// Mocker react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/admin' }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));

// Mocker Navbar
vi.mock('../../components/Navbar/Navbar', () => ({
  Navbar: () => <nav data-testid="mock-navbar">Navbar SensAI</nav>,
}));

// Mocker client API
vi.mock('../../api/client', () => ({
  getAdminStats: vi.fn(() => Promise.resolve({
    total_users: 5,
    total_testers: 4,
    total_admins: 1,
    total_premium: 3,
    total_mangas: 12,
    total_decks: 8,
    total_cards: 64
  })),
  getAdminUsers: vi.fn(() => Promise.resolve([
    {
      id: 1,
      email: 'admin@sensai.local',
      is_admin: true,
      is_premium: true,
      created_at: '2026-09-19T22:00:00Z',
      flashcards_count: 20,
      decks_count: 2,
      mangas_count: 5
    },
    {
      id: 2,
      email: 'tester1@example.com',
      is_admin: false,
      is_premium: false,
      created_at: '2026-09-19T22:10:00Z',
      flashcards_count: 10,
      decks_count: 1,
      mangas_count: 2
    }
  ])),
  getMe: vi.fn(() => Promise.resolve({
    id: 1,
    email: 'admin@sensai.local',
    is_admin: true,
    is_premium: true
  })),
  createAdminUser: vi.fn((data) => Promise.resolve({
    id: 3,
    email: data.email,
    is_admin: data.is_admin,
    is_premium: data.is_premium,
    created_at: '2026-09-19T22:30:00Z',
    flashcards_count: 0,
    decks_count: 0,
    mangas_count: 0
  })),
  toggleAdminUserPremium: vi.fn((userId, isPremium) => Promise.resolve({
    id: userId,
    email: 'tester1@example.com',
    is_admin: false,
    is_premium: isPremium
  })),
  resetAdminUserPassword: vi.fn(() => Promise.resolve({ message: 'OK' })),
  deleteAdminUser: vi.fn(() => Promise.resolve({ message: 'Deleted' })),
  createCheckoutSession: vi.fn(),
}));

import { createAdminUser, toggleAdminUserPremium } from '../../api/client';

describe('Page Admin (Dashboard d\'administration et gestion des testeurs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devrait afficher l\'en-tête et les cartes de statistiques', async () => {
    render(<Admin />);

    expect(screen.getByText(/Panneau d'Administration/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // total_users
      expect(screen.getByText('3')).toBeInTheDocument(); // total_premium
      expect(screen.getByText('12')).toBeInTheDocument(); // total_mangas
      expect(screen.getByText('64')).toBeInTheDocument(); // total_cards
    });
  });

  it('devrait lister les comptes utilisateurs dans le tableau', async () => {
    render(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('admin@sensai.local')).toBeInTheDocument();
      expect(screen.getByText('tester1@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('🛡️ Admin')).toBeInTheDocument();
    expect(screen.getByText('🧪 Testeur')).toBeInTheDocument();
  });

  it('devrait permettre de créer un nouveau compte testeur', async () => {
    render(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('admin@sensai.local')).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/Email du testeur/i);
    const pwdInput = screen.getByLabelText(/Mot de passe provisoire/i);
    const submitBtn = screen.getByRole('button', { name: /Créer le compte/i });

    fireEvent.change(emailInput, { target: { value: 'newtester@example.com' } });
    fireEvent.change(pwdInput, { target: { value: 'SecretTester123!' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith(expect.objectContaining({
        email: 'newtester@example.com',
        password: 'SecretTester123!',
      }));
    });

    // Un message de succès contenant les identifiants doit être affiché
    await waitFor(() => {
      expect(screen.getByText(/Compte prêt !/i)).toBeInTheDocument();
    });
  });

  it('devrait permettre de basculer le statut Premium d\'un testeur', async () => {
    render(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('tester1@example.com')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /Passer VIP/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(toggleAdminUserPremium).toHaveBeenCalledWith(2, true);
    });
  });

  it('devrait filtrer les utilisateurs lors de la recherche par email', async () => {
    render(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('admin@sensai.local')).toBeInTheDocument();
      expect(screen.getByText('tester1@example.com')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/Filtrer les utilisateurs/i);
    fireEvent.change(searchInput, { target: { value: 'tester1' } });

    expect(screen.getByText('tester1@example.com')).toBeInTheDocument();
    expect(screen.queryByText('admin@sensai.local')).not.toBeInTheDocument();
  });
});
