// ═══════════════════════════════════════════
// Student Bot — PWA Service Worker
// ═══════════════════════════════════════════
// Cache versiyasini o'zgartirish uchun bu raqamni oshiring
const CACHE_NAME = 'studentbot-v3';

// Offline da ishlashi uchun saqlanadigan fayllar
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://telegram.org/js/telegram-web-app.js',
];

// ─── Install: statik fayllarni cache qilish ───────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE).catch((err) => {
        console.log('[SW] Cache xatosi:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: eski cache larni o'chirish ─────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch: so'rovlarni ushlash ───────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API so'rovlari — network first (cache emas)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Muvaffaqiyatli javobni cache qilmaymiz (API dynamic)
          return response;
        })
        .catch(() => {
          // Offline bo'lsa — JSON xato qaytarish
          return new Response(
            JSON.stringify({ error: 'Offline rejimdasiz. Internet aloqasini tekshiring.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // HTML fayllar — HECH QACHON cache qilmaslik (force logout ishlashi uchun)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Statik fayllar — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.status === 200 && event.request.method === 'GET') {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => null);
    })
  );
});

// ─── Push bildirishnomalar (keyinchalik) ──────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Student Bot', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});