// InkaHobby Service Worker - PWA + Background Sync
const CACHE_NAME = 'inkahobby-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately without waiting
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ─── Background Sync ──────────────────────────────────────
// This allows the app to sync files even when it's in the background
// as long as the device has internet connectivity

self.addEventListener('sync', (event) => {
  if (event.tag === 'inkahobby-sync') {
    console.log('[SW] Background sync triggered!');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Notify all clients that a background sync is happening
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: 'BACKGROUND_SYNC' });
    }

    // The actual sync logic is handled by the client (useSync hook)
    // We just need to wake up the client and trigger the sync
    // Opening the client window will trigger the useSync interval
    
    // If no clients are active, we can't do IndexedDB operations from SW
    // (Service Workers don't have access to IndexedDB in all browsers)
    // So we just make sure the client is aware
    console.log('[SW] Background sync notification sent to clients');
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// ─── Push messages (for future use) ──────────────────────
// When the server wants to notify the client to sync
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  if (data.type === 'SYNC_REQUESTED') {
    // Admin requested sync - wake up the app
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'SYNC_REQUESTED', userId: data.userId });
        }
      })
    );
  }
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    // Register a background sync
    self.registration.sync.register('inkahobby-sync').catch((err) => {
      console.error('[SW] Failed to register background sync:', err);
    });
  }
});
