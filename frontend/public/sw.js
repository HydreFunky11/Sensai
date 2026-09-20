const CACHE_NAME = 'sensai-cache-v1';

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

  // Ne pas intercepter les appels API backend ou les flux externes (ex: Spotify)
  const isApiRequest = url.pathname.startsWith('/auth') ||
                       url.pathname.startsWith('/library') ||
                       url.pathname.startsWith('/cards') ||
                       url.pathname.startsWith('/ocr') ||
                       url.pathname.startsWith('/llm') ||
                       url.pathname.startsWith('/music') ||
                       url.pathname.startsWith('/admin') ||
                       url.pathname.startsWith('/subscription') ||
                       url.port === '8000';

  if (isApiRequest || url.origin !== self.location.origin) {
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
        // En cas de perte de connexion pour une page HTML, servir le fallback index.html
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html') || cachedResponse;
        }
        return cachedResponse;
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
