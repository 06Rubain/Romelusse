// Service worker d'OmniCom Facturation : application installable et utilisable hors ligne.
// Les données de l'API ne passent pas par ici : l'application les garde elle-même, par utilisateur (IndexedDB).
// Remplacé à chaque déploiement par la construction (vite.config.ts) : chaque version est détectée
const VERSION = 'v4-__BUILD__';
const CACHE = `omnicom-${VERSION}`;
const STATIC = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.png', '/apple-touch-icon.png',
  '/omnicom-logo.png', '/omnicom-logo-dark.png', '/omnicom-mark.png'];

// Tous les fichiers de l'application (pages chargées à la demande comprises) : gardés dès l'installation
const appFiles = async () => {
  try {
    return await (await fetch('/precache.json', { cache: 'no-store' })).json();
  } catch {
    try {
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      return [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
    } catch {
      return [];
    }
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC);
    await cache.addAll(await appFiles());
    // Première installation : actif tout de suite. Mise à jour : attend que l'utilisateur la lance
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('omnicom-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages : le réseau d'abord (dernière version), la copie gardée si la connexion manque ou traîne
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(request, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) (await caches.open(CACHE)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/', { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }

  // Fichiers versionnés (/assets/…-hash.js) et images : la copie gardée d'abord, sinon le réseau
  if (url.pathname.startsWith('/assets/') || STATIC.includes(url.pathname)) {
    event.respondWith((async () => {
      // ignoreVary : un fichier gardé à l'installation doit servir aussi aux scripts de module (en-tête Origin)
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) return cached;
      const res = await fetch(request);
      if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
      return res;
    })());
  }
});
