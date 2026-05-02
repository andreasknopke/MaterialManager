const CACHE_NAME = 'material-manager-v2';
const OFFLINE_URL = '/offline.html';

// Dateien, die sofort gecacht werden sollen (App Shell)
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/config.js'
];

// API-Endpunkte, die im Offline-Modus aus dem Cache geladen werden können
const CACHEABLE_API_ROUTES = [
  '/api/materials',
  '/api/cabinets',
  '/api/categories',
  '/api/companies',
  '/api/units'
];

// Install-Event: Precache wichtiger Dateien
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Precaching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Sofort aktivieren, ohne auf andere Tabs zu warten
  self.skipWaiting();
});

// Activate-Event: Alte Caches löschen
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Sofort alle Clients übernehmen
  self.clients.claim();
});

// Fetch-Event: Network-first mit Cache-Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nicht-GET-Requests nicht im Service Worker als Erfolg simulieren.
  // Der Axios-Client queued Änderungen selbst und kann dabei prüfen, ob IndexedDB wirklich funktioniert.
  if (request.method !== 'GET') {
    return;
  }

  // API-Requests: Network-first mit Cache-Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Navigation und update-kritische Dateien: Network-first, damit iPad-PWAs nach Redeploy aktualisieren
  if (request.mode === 'navigate' || ['/', '/index.html', '/service-worker.js', '/manifest.json', '/config.js'].includes(url.pathname)) {
    event.respondWith(networkFirstStatic(request));
    return;
  }

  // Static Assets mit Hash im Dateinamen: Cache-first mit Network-Fallback
  event.respondWith(cacheFirstWithNetwork(request));
});

async function networkFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    if (request.mode === 'navigate') {
      return cache.match(OFFLINE_URL);
    }

    throw error;
  }
}

// Network-first Strategie für API-Calls
async function networkFirstWithCache(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    // Erfolgreiche Antwort cachen (nur GET-Requests für bestimmte APIs)
    if (networkResponse.ok && isCacheableApiRoute(request.url)) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', request.url);
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Offline-Header hinzufügen
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');
      headers.set('X-Offline-Mode', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }
    
    // Keine Cache-Daten verfügbar
    return new Response(JSON.stringify({ 
      error: 'Offline - keine gecachten Daten verfügbar',
      offline: true 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache-first Strategie für statische Assets
async function cacheFirstWithNetwork(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Im Hintergrund aktualisieren
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse);
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Offline-Fallback für Navigation
    if (request.mode === 'navigate') {
      return cache.match(OFFLINE_URL);
    }
    throw error;
  }
}

// Prüfen ob API-Route gecacht werden soll
function isCacheableApiRoute(url) {
  return CACHEABLE_API_ROUTES.some(route => url.includes(route));
}

// Background Sync für Offline-Änderungen
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);
  
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges());
  }
});

// Pending Changes synchronisieren
async function syncPendingChanges() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'TRIGGER_SYNC',
      payload: { timestamp: Date.now() }
    });
  });
}

// Push-Benachrichtigungen (für Ablauf-Warnungen etc.)
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  const data = event.data?.json() || {};
  const title = data.title || 'Material Manager';
  const options = {
    body: data.body || 'Neue Benachrichtigung',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.url || '/',
    actions: data.actions || []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('[ServiceWorker] Loaded');
