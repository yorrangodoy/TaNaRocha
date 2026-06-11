// [PWA] Service Worker — cache offline first
// Garante que o app funciona sem conexão após o primeiro carregamento

const CACHE_NAME = 'tanarocha-v3-pwa-fix';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/script.js',
  './manifest.json',
  './assets/logo-tanarocha.png',
  './assets/icons/home.png',
  './assets/icons/friends.png',
  './assets/icons/rachar.png',
  './assets/icons/trophy.png',
  './assets/icons/versus.png'
];

// Install: cacheia tudo
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

// Activate: limpa caches antigos e assume controle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

// Fetch: cache-first com fallback pra rede
self.addEventListener('fetch', (event) => {
  // Só intercepta GET
  if (event.request.method !== 'GET') return;

  // Ignora requests pra outros domínios (CDN, Fonts)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          // Só cacheia respostas válidas
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clona pra cachear
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });

          return response;
        })
        .catch(() => {
          // Offline e não tá em cache: retorna index como fallback (SPA)
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// Mensagem do client pra forçar update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
