const CACHE_NAME = 'apple-interior-manager-v4';
const STATIC_CACHE = 'static-v4';
const DYNAMIC_CACHE = 'dynamic-v4';

// Static assets to cache on install
const staticAssets = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/New-logo.png'
];

// URLs that should NEVER be cached (always fetch from network)
const noCacheUrls = [
  '/api/',           // All API routes
  '/auth/',          // Authentication routes
  '/_next/data/',    // Next.js data fetching
];

// Check if URL should never be cached
function shouldNeverCache(url) {
  return noCacheUrls.some(pattern => url.includes(pattern));
}

// Check if request is for a static asset
function isStaticAsset(url) {
  return url.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$/);
}

// Install event - cache static resources only
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v4...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(staticAssets);
      })
      .then(() => {
        console.log('[SW] Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip non-http(s) requests (chrome-extension, etc.)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return;
  }

  // NEVER cache API routes, auth, or dynamic data - always use network
  if (shouldNeverCache(url)) {
    event.respondWith(
      fetch(request)
        .catch((error) => {
          console.error('[SW] Network request failed for:', url, error);
          // Return a proper error response instead of cached data
          return new Response(
            JSON.stringify({ error: 'Network request failed', offline: true }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // For static assets: Cache-first strategy
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving static asset from cache:', url);
            return cachedResponse;
          }

          return fetch(request)
            .then((response) => {
              // Cache successful responses (only http/https)
              if (response && response.status === 200 &&
                  (url.startsWith('http://') || url.startsWith('https://'))) {
                const responseToCache = response.clone();
                caches.open(STATIC_CACHE).then((cache) => {
                  cache.put(request, responseToCache).catch((err) => {
                    console.warn('[SW] Failed to cache:', url, err.message);
                  });
                });
              }
              return response;
            });
        })
    );
    return;
  }

  // For HTML pages: Network-first strategy (always get fresh content)
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Optionally cache the page for offline access (only http/https)
          if (response && response.status === 200 &&
              (url.startsWith('http://') || url.startsWith('https://'))) {
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseToCache).catch((err) => {
                console.warn('[SW] Failed to cache page:', url, err.message);
              });
            });
          }
          return response;
        })
        .catch(() => {
          // Only serve cached version if network fails (offline)
          console.log('[SW] Network failed, serving cached page:', url);
          return caches.match(request)
            .then((cachedResponse) => {
              return cachedResponse || caches.match('/dashboard');
            });
        })
    );
    return;
  }

  // For everything else: Network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v4...');

  const currentCaches = [CACHE_NAME, STATIC_CACHE, DYNAMIC_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated and claiming clients');
        return self.clients.claim();
      })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/dashboard')
  );
});
