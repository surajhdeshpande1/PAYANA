/* PAYANA service worker — offline-first shell, cached heritage content & photos. */
const VERSION = "payana-v3";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const TILES = `${VERSION}-tiles`;

const SITE_IDS = [
  "badami-caves", "bhutanatha", "agastya-lake", "badami-fort", "aihole", "pattadakal",
  "mahakuta", "banashankari", "kudalasangama", "siddhanakolla", "ilkal", "guledgudda",
];
const PRECACHE = [
  "/", "/explore", "/scan", "/trip", "/artisans", "/guide", "/passport", "/sos", "/share", "/admin",
  "/artisans/register", "/manifest.webmanifest",
  "/icons/icon-192.png", "/icons/icon-512.png", "/images/hero.jpg",
  ...SITE_IDS.map((id) => `/site/${id}`),
  ...SITE_IDS.map((id) => `/images/sites/${id}.jpg`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

async function pageNetworkFirst(req, timeoutMs = 6000) {
  const url = new URL(req.url);
  const key = new Request(url.origin + url.pathname);
  const cache = await caches.open(RUNTIME);
  // Keep the saved copy fresh even if we fall back to it this time.
  const network = fetch(req).then((res) => {
    if (res && res.ok && (res.headers.get("content-type") || "").includes("text/html")) cache.put(key, res.clone());
    return res;
  });
  network.catch(() => {});
  try {
    return await Promise.race([
      network,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
  } catch {
    const hit = (await caches.match(key)) || (await caches.match(url.pathname));
    if (hit) return hit;
    return (await caches.match("/")) || Response.error();
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    const cache = await caches.open(cacheName);
    cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Map tiles: cache as the user browses (works offline for viewed areas).
  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(cacheFirst(req, TILES).catch(() => Response.error()));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Hashed build assets, fonts, images → cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  // Full page loads → network-first, offline fallback to cached HTML.
  // (RSC payload requests are left to the network; offline, Next.js falls back to a full navigation.)
  if (req.mode === "navigate") {
    event.respondWith(pageNetworkFirst(req));
    return;
  }
});
