const RAW_BUILD_VERSION = "__LUMA_BUILD__";
const BUILD_VERSION = RAW_BUILD_VERSION.startsWith("__") ? "dev" : RAW_BUILD_VERSION;
const CACHE_PREFIX = "luma-shell-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const OFFLINE_FALLBACK_URL = "/";

const PRECACHE = [
    "/",
    "./assets/javascripts/luma-shell.js",
    "./assets/javascripts/luma-window-manager.js",
    "./assets/javascripts/luma-api.js",
    "./assets/javascripts/luma-context-menu.js",
    "./assets/javascripts/luma-sw-update.js",
    "./assets/javascripts/luma-avatar.js",
    "./assets/javascripts/luma-avatar-store.js",
    "./assets/css/luma-shell.css",
    "./apps/session-select/style.css",
    "./images/backgrounds/background-00.jpg"
];

const NETWORK_FIRST_PATTERN = /\.(js|mjs|css|html?)$/i;
const CACHE_FIRST_PATTERN = /\.(svg|png|jpg|jpeg|webp|woff2?|ico)$/i;

function isApiRequest(pathname) {
    return pathname.startsWith("/api/");
}

function isNetworkFirst(pathname) {
    return NETWORK_FIRST_PATTERN.test(pathname);
}

function isCacheFirst(pathname) {
    return CACHE_FIRST_PATTERN.test(pathname);
}

function isCriticalAsset(url) {
    return url === OFFLINE_FALLBACK_URL || /\.(js|css)$/i.test(url);
}

async function precache() {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(PRECACHE.map(async (url) => {
        const response = await fetch(new Request(url, { cache: "no-cache" }));
        if (!response.ok) throw new Error(`Réponse ${response.status} pour ${url}`);
        await cache.put(url, response);
    }));

    const failures = results.filter((result) => result.status === "rejected").length;
    if (failures === PRECACHE.length) {
        throw new Error("Précache impossible : aucune ressource n’a pu être mise en cache.");
    }
    const criticalFailures = PRECACHE.filter((url, index) => results[index].status === "rejected" && isCriticalAsset(url));
    if (criticalFailures.length === PRECACHE.filter(isCriticalAsset).length) {
        throw new Error("Précache impossible : aucune ressource critique n’a pu être mise en cache.");
    }
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response && response.ok && !response.redirected) {
            const cacheKey = request.mode === "navigate"
                ? new Request(request.url, { credentials: "same-origin" })
                : request;
            try {
                await cache.put(cacheKey, response.clone());
            } catch { /* quota dépassé : la réponse reste servie */ }
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fallback = await cache.match(OFFLINE_FALLBACK_URL);
        if (fallback) return fallback;
        return Response.error();
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            try {
                await cache.put(request, response.clone());
            } catch { /* quota dépassé : la réponse reste servie */ }
        }
        return response;
    } catch (error) {
        return Response.error();
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === "SKIP_WAITING") {
        self.skipWaiting();
        return;
    }
    if (data.type === "PING" && event.source) {
        event.source.postMessage({ type: "PONG", version: BUILD_VERSION, cacheName: CACHE_NAME });
        return;
    }
    if (data.type === "GET_ASSETS" && event.source) {
        event.source.postMessage({ type: "ASSETS", version: BUILD_VERSION, assets: PRECACHE });
    }
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.protocol !== self.location.protocol) return;
    if (url.origin !== self.location.origin) return;
    if (isApiRequest(url.pathname)) return;

    const destination = request.destination;
    const navigation = request.mode === "navigate";

    if (navigation || destination === "script" || destination === "style" || isNetworkFirst(url.pathname)) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (destination === "image" || destination === "font" || isCacheFirst(url.pathname)) {
        event.respondWith(cacheFirst(request));
    }
});
