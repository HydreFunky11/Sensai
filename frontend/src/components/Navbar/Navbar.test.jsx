import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Navbar } from './Navbar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/' }),
}));

vi.mock('../../api/client', () => ({
  getMe: vi.fn(() => Promise.resolve({ id: 1, email: 'admin@sensai.local', is_admin: true, is_premium: true })),
  createCheckoutSession: vi.fn(() => Promise.resolve({ url: 'https://checkout.stripe.com/test' })),
}));

describe('Composant Navbar Responsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('devrait afficher le logo SensAI et naviguer vers / au clic', () => {
    render(<Navbar />);
    const logo = screen.getByText('SensAI');
    expect(logo).toBeInTheDocument();

    fireEvent.click(logo);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('devrait afficher la barre inférieure mobile dock avec les raccourcis clés', () => {
    render(<Navbar />);
    const dockNav = screen.getByRole('navigation', { name: /navigation mobile principale/i });
    expect(dockNav).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^bibliothèque$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sensai lens$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^flashcards et révisions$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^musique et karaoké$/i })).toBeInTheDocument();
  });

  it('devrait ouvrir et fermer le tiroir de menu mobile (Drawer)', async () => {
    render(<Navbar />);
    
    // Au départ, le tiroir n'est pas affiché
    expect(screen.queryByRole('dialog', { name: /menu principal/i })).not.toBeInTheDocument();

    // Cliquer sur le burger button
    const burgerBtn = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(burgerBtn);

    // Le tiroir s'ouvre
    const drawer = screen.getByRole('dialog', { name: /menu principal/i });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText('Alphabets & Kanji')).toBeInTheDocument();
    expect(screen.getByText('Statistiques & Progression')).toBeInTheDocument();

    // Fermer le tiroir via le bouton close
    const closeBtn = screen.getByRole('button', { name: /fermer le menu/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /menu principal/i })).not.toBeInTheDocument();
  });

  it('devrait afficher le badge Admin lorsque l\'utilisateur possède les privilèges', async () => {
    render(<Navbar />);

    await waitFor(() => {
      // Bouton admin dans la navbar desktop
      const adminBtns = screen.getAllByText(/admin/i);
      expect(adminBtns.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('devrait déclencher onImportClick lorsque le bouton Importer est cliqué', () => {
    const mockImport = vi.fn();
    render(<Navbar onImportClick={mockImport} importing={false} />);

    const importBtns = screen.getAllByRole('button', { name: /importer/i });
    expect(importBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(importBtns[0]);
    expect(mockImport).toHaveBeenCalled();
  });
});
