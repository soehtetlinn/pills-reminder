// Service worker: makes the app installable, lets it open offline, and lets the page
// show notifications on mobile browsers (Android Chrome requires a service worker for that).
const CACHE = 'med-tracker-v1';
const CORE = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // Cache each file on its own so one failed download does not block installation.
      // Files from other sites are fetched "no-cors"; cache.add() refuses those, so fetch and put by hand.
      .then(c => Promise.allSettled(CORE.map(u => {
        const req = new Request(u, u.startsWith('http') ? { mode: 'no-cors' } : {});
        return fetch(req).then(res => { if (res.ok || res.type === 'opaque') return c.put(req, res); });
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const store = res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate') {
    // The page itself: newest version when online, saved copy when offline.
    e.respondWith(fetch(req).then(store).catch(() => caches.match(req).then(r => r || caches.match('./'))));
    return;
  }
  // Everything else (styles, fonts, icons): answer from the cache at once, refresh in the background.
  e.respondWith(
    caches.match(req).then(cached => {
      const fresh = fetch(req).then(store).catch(() => cached);
      return cached || fresh;
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
