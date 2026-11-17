// NAADI's service worker: every page and its assets, kept on the device so the shed works
// without signal. Pages are network-first (fresh when online, cached when not); Next's hashed
// assets are cache-first. The narrator API is never cached.
const VERSION = 'naadi-v1';
const PAGES = ['/', '/floor', '/agents', '/lab', '/rulebook', '/model', '/machine/L01', '/machine/L02', '/machine/L03', '/machine/L04', '/machine/L05', '/machine/L06', '/machine/C01', '/machine/P01', '/machine/P02'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const assets = new Set(['/naadi.svg', '/manifest.webmanifest']);
    for (const page of PAGES) {
      try {
        const res = await fetch(page, { cache: 'no-cache' });
        if (!res.ok) continue;
        const html = await res.clone().text();
        await cache.put(page, res);
        // every script, style and font the page references, so it also runs offline
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) assets.add(m[0]);
      } catch { /* a page that fails now is cached on first visit instead */ }
    }
    await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('/')) ?? Response.error();
    return Response.error();
  }
}
