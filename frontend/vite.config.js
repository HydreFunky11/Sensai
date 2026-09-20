/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function earlyGlobalsPlugin() {
  return {
    name: 'sensai-early-globals',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          '<head>',
          `<head>\n    <script>window.__SERVER_FORWARD_CONSOLE__ = { enabled: false }; var __SERVER_FORWARD_CONSOLE__ = window.__SERVER_FORWARD_CONSOLE__; window.__BUNDLED_DEV__ = false; var __BUNDLED_DEV__ = false;</script>`
        );
      },
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), earlyGlobalsPlugin()],
  define: {
    __SERVER_FORWARD_CONSOLE__: JSON.stringify({ enabled: false }),
    __BUNDLED_DEV__: 'false',
  },
  server: {
    forwardConsole: false,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/library': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/cards': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/analyze': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/detect': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/translate': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/tts': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/music': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/payments': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
})
