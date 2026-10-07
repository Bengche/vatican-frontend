/* Service worker: offline fallback, fast repeat visits. API traffic is never cached. */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const MAX_PAGES = 30;
const SLOW_NETWORK_MS = 3500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache
        .addAll(["/icons/icon-192.png", "/logo-mark.png"])
        .catch(() => {});
      await cacheOfflinePage();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !keep.has(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimPages(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i += 1)
    await cache.delete(keys[i]);
}

async function cacheOfflinePage() {
  const cache = await caches.open(STATIC_CACHE);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);
  const assets = [
    ...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g),
  ].map((m) => m[1]);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => {})));
}

let lastOfflineRefresh = 0;

async function navigate(request) {
  if (Date.now() - lastOfflineRefresh > 3_600_000) {
    lastOfflineRefresh = Date.now();
    cacheOfflinePage().catch(() => {});
  }

  const pages = await caches.open(PAGE_CACHE);

  const network = fetch(request).then((response) => {
    // Redirects (e.g. a signed-out visit bounced to /login) must never be stored under the original address.
    if (response.ok && !response.redirected && response.type === "basic") {
      pages.put(request, response.clone()).then(() => trimPages(pages));
    }
    return response;
  });

  const cached = await pages.match(request, { ignoreSearch: true });

  if (!cached) {
    try {
      return await network;
    } catch {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
  }

  // Serve the saved page if the connection is slow or down; the fresh copy still updates the cache.
  return Promise.race([
    network.catch(() => cached),
    new Promise((resolve) =>
      setTimeout(() => resolve(cached), SLOW_NETWORK_MS),
    ),
  ]);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

const STATIC_PATTERN = /\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/manifest.webmanifest" ||
    STATIC_PATTERN.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
