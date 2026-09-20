import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  registerServiceWorker, 
  promptInstall, 
  isInstallPromptAvailable, 
  isStandaloneMode 
} from './pwa';

describe('PWA & Service Worker Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Manifest Web App', () => {
    it('devrait posséder un manifest.webmanifest valide et conforme aux standards PWA', () => {
      const manifestPath = path.resolve(__dirname, '../public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(manifestContent.name).toBe('SensAI - Lecteur Manga & Immersion Japonaise');
      expect(manifestContent.short_name).toBe('SensAI');
      expect(manifestContent.start_url).toBe('/');
      expect(manifestContent.display).toBe('standalone');
      expect(manifestContent.theme_color).toBe('#0b0f19');
      expect(manifestContent.background_color).toBe('#0b0f19');
      expect(Array.isArray(manifestContent.icons)).toBe(true);
      expect(manifestContent.icons.length).toBeGreaterThanOrEqual(4);

      // Vérifier présence d'icônes standard et maskable
      const hasStandard192 = manifestContent.icons.some(i => i.sizes === '192x192' && i.purpose === 'any');
      const hasMaskable192 = manifestContent.icons.some(i => i.sizes === '192x192' && i.purpose === 'maskable');
      const hasStandard512 = manifestContent.icons.some(i => i.sizes === '512x512' && i.purpose === 'any');
      const hasMaskable512 = manifestContent.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable');

      expect(hasStandard192).toBe(true);
      expect(hasMaskable192).toBe(true);
      expect(hasStandard512).toBe(true);
      expect(hasMaskable512).toBe(true);
    });

    it('devrait avoir généré l\'ensemble des fichiers d\'icônes physiques', () => {
      const iconsDir = path.resolve(__dirname, '../public/icons');
      const requiredIcons = [
        'icon-192x192.png',
        'icon-512x512.png',
        'icon-maskable-192x192.png',
        'icon-maskable-512x512.png',
        'apple-touch-icon.png',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'icon.svg'
      ];

      for (const icon of requiredIcons) {
        const filePath = path.join(iconsDir, icon);
        expect(fs.existsSync(filePath), `Icône manquante: ${icon}`).toBe(true);
      }
    });
  });

  describe('Service Worker File', () => {
    it('devrait posséder un fichier sw.js avec les stratégies de cache et d\'exclusion API', () => {
      const swPath = path.resolve(__dirname, '../public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf-8');
      expect(swContent).toContain('sensai-cache');
      expect(swContent).toContain('addEventListener(\'install\'');
      expect(swContent).toContain('addEventListener(\'activate\'');
      expect(swContent).toContain('addEventListener(\'fetch\'');
      expect(swContent).toContain('/auth');
      expect(swContent).toContain('/library');
    });
  });

  describe('Détection du mode Standalone', () => {
    it('devrait détecter correctement le mode standalone via matchMedia', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isStandaloneMode()).toBe(true);
    });

    it('devrait retourner false quand l\'application est dans un navigateur standard', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      expect(isStandaloneMode()).toBe(false);
    });
  });

  describe('Cycle d\'enregistrement du Service Worker', () => {
    it('devrait enregistrer le Service Worker lorsque window émet l\'événement load', () => {
      const registerMock = vi.fn().mockReturnValue(Promise.resolve({
        addEventListener: vi.fn()
      }));

      Object.defineProperty(navigator, 'serviceWorker', {
        value: { register: registerMock },
        writable: true,
        configurable: true
      });

      registerServiceWorker();

      // Déclencher l'événement load
      window.dispatchEvent(new Event('load'));

      expect(registerMock).toHaveBeenCalledWith('/sw.js');
    });
  });

  describe('Installation PWA & Prompt', () => {
    it('devrait gérer le prompt d\'installation et renvoyer true en cas d\'acceptation', async () => {
      const promptMock = vi.fn();
      const mockEvent = new Event('beforeinstallprompt');
      mockEvent.prompt = promptMock;
      mockEvent.userChoice = Promise.resolve({ outcome: 'accepted' });

      // Déclencher l'événement avant installation
      window.dispatchEvent(mockEvent);

      expect(isInstallPromptAvailable()).toBe(true);

      const installed = await promptInstall();
      expect(installed).toBe(true);
      expect(promptMock).toHaveBeenCalled();
      expect(isInstallPromptAvailable()).toBe(false);
    });
  });
});
