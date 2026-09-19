import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mocker l'API Canvas pour éviter les plantages lors des rendus de l'ardoise guidée
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  setLineDash: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  drawImage: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
}));

HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  if (callback) {
    callback(new Blob(['mock-canvas-blob'], { type: 'image/jpeg' }));
  }
});

// Mocker speechSynthesis pour la prononciation audio
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  speakSpeechSynthesisUtterance: vi.fn(),
};

global.window.speechSynthesis = mockSpeechSynthesis;
global.window.SpeechSynthesisUtterance = vi.fn(function (text) {
  this.text = text;
  this.lang = 'ja-JP';
});
