// Sube VERSION cada vez que cambies archivos para forzar la actualización del caché
const VERSION = 'v2';
const APP = 'lidos-app-' + VERSION;
const TILES = 'lidos-tiles';
const MAX_TILES = 800;

const PRECACHE = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=Open+Sans:wght@400;600&family=Raleway:wght@500;700&display=swap'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k)));
}

// Responde primero desde el caché (rápido y sin señal) y actualiza en segundo plano
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  const isTile = req.url.includes('basemaps.cartocdn.com');
  e.respondWith((async () => {
    const cache = await caches.open(isTile ? TILES : APP);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        cache.put(req, res.clone()).then(() => isTile && trim(cache));
      }
      return res;
    }).catch(() => null);

    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
