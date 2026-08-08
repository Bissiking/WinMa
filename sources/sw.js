const CACHE_NAME = "luma-shell-v3";

const PRECACHE = [
    "/",
    "./assets/javascripts/luma-shell.js",
    "./assets/javascripts/luma-window-manager.js",
    "./assets/javascripts/luma-api.js",
    "./assets/javascripts/luma-context-menu.js",
    "./assets/css/luma-shell.css",
    "./apps/session-select/style.css",
    "./images/backgrounds/background-00.jpg"
];

function isStaticAsset(url) {
    const pathname = new URL(url).pathname;
    if (pathname.startsWith("/api/")) return false;
    return /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/.test(pathname);
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isStaticAsset(url)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(request);
                if (cached) return cached;
                try {
                    const response = await fetch(request);
                    if (response && response.status === 200) cache.put(request, response.clone());
                    return response;
                } catch (error) {
                    return cached || Response.error();
                }
            })
        );
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request).catch(async () => (await caches.match("/")) || Response.error())
        );
    }
});
