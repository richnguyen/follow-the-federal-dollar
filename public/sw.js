// The game's service worker (public site only): fast return visits and play without a connection.
// - Pages: the network first, so a new release shows up at once; the saved copy if the network
//   is down or slower than 3.5 seconds.
// - Built files (/assets/, hashed names) and fingerprinted voice files (?v=): saved once, used
//   from then on.
// - Fonts and other files: the saved copy at once, refreshed in the background.
// - Everything else (the shared database, CAPTCHA, live Treasury data): always the network.
const VERSION = 'ftd-v1';
const PAGES = `${VERSION}-pages`;
const FILES = `${VERSION}-files`;
const ROOT = new URL('./', self.registration.scope).href;
const MAX_FILES = 80;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add(new Request(ROOT, { cache: 'reload' }))).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') { e.respondWith(fresh(req, e)); return; }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  if (url.pathname.includes('/assets/') || url.searchParams.has('v')) { e.respondWith(kept(req)); return; }
  e.respondWith(fresh(req, e));
});

const pageKey = (u) => { const k = new URL(u); k.search = ''; k.hash = ''; return k.href; };

async function page(req) {
  const cache = await caches.open(PAGES);
  const net = fetch(req).then((res) => { if (res.ok) cache.put(pageKey(req.url), res.clone()); return res; });
  const saved = () => cache.match(pageKey(req.url)).then((r) => r || cache.match(ROOT));
  const slow = new Promise((res) => setTimeout(res, 3500, 'slow'));
  try {
    const first = await Promise.race([net, slow]);
    if (first !== 'slow') return first;
    return (await saved()) || (await net);
  } catch {
    return (await saved()) || Response.error();
  }
}

async function kept(req) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { await cache.put(req, res.clone()); trim(cache); }
  return res;
}

async function fresh(req, e) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).then(() => trim(cache)); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

// Older builds' files pile up with each release; keep the newest ones.
async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_FILES))) await cache.delete(k);
}

// ---------- Daily Dollar reminders (opt-in; see src/game/reminders.tsx) ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'The Daily Dollar is ready', {
    body: d.body || 'Today’s puzzle: five quick higher-or-lower calls on real federal numbers.',
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png',
    tag: d.tag || 'daily-dollar',
    data: { url: d.url || './?daily&s=pu' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './?daily&s=pu', self.registration.scope).href;
  e.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of open) {
      if (new URL(c.url).origin !== self.location.origin) continue;
      try { await c.navigate(url); } catch { /* not controlled yet: just bring it forward */ }
      return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
