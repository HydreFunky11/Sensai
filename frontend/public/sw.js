const CACHE_NAME = 'sensai-cache-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

// Installation : mise en cache du shell de l'application
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et les schémas autres que http(s)
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Ne pas intercepter les requêtes WebSocket, les flux de dev Vite, ni les appels API
  const isExcluded = 
    url.pathname.startsWith('/@') ||
    url.pathname.includes('__vite') ||
    url.pathname.includes('node_modules') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/library') ||
    url.pathname.startsWith('/cards') ||
    url.pathname.startsWith('/analyze') ||
    url.pathname.startsWith('/detect') ||
    url.pathname.startsWith('/translate') ||
    url.pathname.startsWith('/tts') ||
    url.pathname.startsWith('/music') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/payments') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/subscription') ||
    url.port === '8000' ||
    url.origin !== self.location.origin;

  if (isExcluded) {
    return;
  }

  // Stratégie Stale-While-Revalidate pour les assets statiques et navigation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 1. Si nous avons une réponse en cache, la retourner
        if (cachedResponse) {
          return cachedResponse;
        }
        // 2. En cas de perte de connexion pour une navigation HTML, servir le fallback index.html
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html').then((fallback) => {
            return fallback || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain' } });
          });
        }
        // 3. IMPORTANT : Renvoyer un objet Response valide et universel pour éviter TypeError: Failed to convert value to 'Response'
        return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Message pour forcer la mise à jour immédiate si demandé
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
