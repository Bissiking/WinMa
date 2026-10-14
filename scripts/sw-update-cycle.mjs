// scripts/sw-update-cycle.mjs
// Cycle complet de mise à jour du Service Worker Luma OS :
// ancien SW bloqué → nouvelle page → détection → notification → confirmation utilisateur
// → skipWaiting → rechargement unique → purge des anciens caches → déploiement suivant → hors ligne.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const { createApp } = require('../src/server/app.js');
const { loadConfig } = require('../src/server/config/env.js');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probeFile = path.join(projectRoot, 'sources', 'assets', 'sw-cycle-probe.txt');
const legacyWorkerFile = path.join(projectRoot, 'sources', 'legacy-sw.js');
const shellSourceFile = path.join(projectRoot, 'sources', 'assets', 'javascripts', 'luma-shell.js');

// Reprise fidèle de l'ancien service worker (cache-first + skipWaiting immédiat).
// Le shell pré-cache doit être un VRAI bundle d'ancienne génération : sans indicateur
// de barre des tâches, la notification est alors son seul canal d'information.
function buildLegacyServiceWorker(shellSource) {
    return `const CACHE_NAME = "luma-shell-v3";
const LEGACY_SHELL = ${JSON.stringify(shellSource)};
const PRECACHE = ["/", "./assets/javascripts/luma-window-manager.js", "./assets/javascripts/luma-api.js", "./assets/javascripts/luma-context-menu.js", "./assets/css/luma-shell.css", "./apps/session-select/style.css", "./images/backgrounds/background-00.jpg"];
const LEGACY_SHELL_URL = "/assets/javascripts/luma-shell.js";
const LEGACY_DOCUMENT_KEY = "/__legacy_document__";
function isStaticAsset(url) {
    const pathname = new URL(url).pathname;
    if (pathname.startsWith("/api/")) return false;
    return /\\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/.test(pathname);
}
self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
        await cache.addAll(PRECACHE);
        await cache.put(LEGACY_SHELL_URL, new Response(LEGACY_SHELL, { headers: { "Content-Type": "application/javascript; charset=utf-8" } }));
        await cache.put(LEGACY_DOCUMENT_KEY, new Response("1"));
    }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (isStaticAsset(url)) {
        event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) return cached;
            try {
                const response = await fetch(request);
                if (response && response.status === 200) cache.put(request, response.clone());
                return response;
            } catch (error) { return cached || Response.error(); }
        }));
        return;
    }
    if (request.mode === "navigate") {
        // Tant que le marqueur est présent dans le cache, le document hérité est
        // servi sans le module de mise à jour : la notification est alors le seul
        // canal d'information. Le test retire le marqueur pour simuler la page réelle.
        event.respondWith((async () => {
            const marker = await caches.open(CACHE_NAME).then((cache) => cache.match(LEGACY_DOCUMENT_KEY));
            const response = await fetch(request).catch(async () => (await caches.match("/")) || Response.error());
            if (!marker || !response || !response.ok) return response;
            const headers = new Headers(response.headers);
            headers.delete("content-length");
            const html = (await response.text())
                .replace('<script type="module" src="./assets/javascripts/luma-sw-update.js"></script>', '')
                .replace("</body>", '<script>navigator.serviceWorker && navigator.serviceWorker.register("./legacy-sw.js");</script></body>');
            return new Response(html, { status: response.status, statusText: response.statusText, headers });
        })());
    }
});
`;
}

const chromeCandidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome'
].filter(Boolean);

const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

if (!executablePath) {
    throw new Error('Aucun Chromium/Chrome trouvé : définissez CHROME_PATH.');
}

const failures = [];
const pageErrors = [];

function check(label, condition, details = '') {
    if (condition) {
        console.log(`  ok   ${label}`);
        return;
    }
    failures.push(`${label}${details ? ` — ${details}` : ''}`);
    console.log(`  FAIL ${label}${details ? ` — ${details}` : ''}`);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingServiceWorker(page) {
    return page.evaluate(() => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('aucune réponse du service worker')), 8000);
        const onMessage = (event) => {
            if (event.data?.type !== 'PONG') return;
            clearTimeout(timer);
            navigator.serviceWorker.removeEventListener('message', onMessage);
            resolve(event.data);
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (!registration?.active) {
                clearTimeout(timer);
                reject(new Error('aucun service worker actif'));
                return;
            }
            registration.active.postMessage({ type: 'PING' });
        }).catch((error) => {
            clearTimeout(timer);
            reject(error);
        });
    }));
}

async function cacheNames(page) {
    return page.evaluate(async () => {
        const keys = await caches.keys();
        keys.sort();
        return keys;
    });
}

async function controllerScript(page) {
    return page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || null);
}

async function pageCount(page) {
    return page.evaluate(() => Number(sessionStorage.getItem('luma.e2e.page-loads') || 0));
}

async function updateToastCount(page) {
    return page.locator('[data-luma-toast="service-worker"]').count();
}

// Reconstitution du bundle 3.1.0 : ni filtre hidden/incompatible, ni indicateur
// de la barre des tâches — la notification est alors le seul canal d'information.
const STALE_BUNDLE_PATCHES = [
    ['!app.hidden && !app.incompatible', 'true'],
    ['window.LumaSwUpdate?.attachIndicator?.(applyUpdateButtonState);', 'void applyUpdateButtonState;']
];

function toLegacyBundle(body) {
    let output = body;
    for (const [marker, replacement] of STALE_BUNDLE_PATCHES) output = output.replace(marker, replacement);
    return output;
}

async function startMenuApps(page) {
    const texts = await page.locator('#start-apps .start-app').allInnerTexts();
    return texts.map((text) => text.trim());
}

async function confirmUpdate(page) {
    await page.locator('[data-luma-toast="service-worker"] button', { hasText: 'Mettre à jour' }).click();
}

async function readServiceWorkerResponse(baseUrl) {
    const response = await fetch(`${baseUrl}/sw.js`, { method: 'GET', cache: 'no-store' });
    return { status: response.status, cacheControl: response.headers.get('cache-control'), body: await response.text() };
}

let server;
let browser;

async function main() {
    fs.writeFileSync(probeFile, 'sw-cycle probe v1\n');
    fs.writeFileSync(
        legacyWorkerFile,
        buildLegacyServiceWorker(toLegacyBundle(fs.readFileSync(shellSourceFile, 'utf8')))
    );

    const config = loadConfig();
    const app = createApp({ config });
    server = await new Promise((resolve) => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`Serveur : ${baseUrl}`);

    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext();
    await context.addInitScript(() => {
        try {
            localStorage.setItem('luma.orbit.installed', JSON.stringify(['sonora-studio']));
            const key = 'luma.e2e.page-loads';
            sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || '0') + 1));
        } catch { /* stockage indisponible */ }
    });

    const page = await context.newPage();
    const avatarRequests = [];
    page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/users/me/avatar') avatarRequests.push(request.url());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(message.text());
    });

    try {
        const swResponse = await readServiceWorkerResponse(baseUrl);
        console.log('\n1. Service worker servi sans cache HTTP');
        check('GET /sw.js répond 200', swResponse.status === 200, `statut ${swResponse.status}`);
        check('Cache-Control interdit le cache navigateur', /no-cache/.test(swResponse.cacheControl || ''), swResponse.cacheControl);
        check('la version de build est injectée',
            !swResponse.body.includes('__LUMA_BUILD__') && /RAW_BUILD_VERSION = "[0-9a-f]{16}"/.test(swResponse.body));

        console.log('\n2. Situation de départ : ancien service worker bloqué (luma-shell-v3)');
        // Premier chargement uniquement : aucun service worker ne contrôle encore la
        // page, l'interception suffit à servir un document hérité. Dès la prise de
        // contrôle, c'est le service worker legacy qui réécrit le document lui-même.
        await context.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            const isRootDocument = request.resourceType() === 'document'
                && url.origin === new URL(baseUrl).origin
                && url.pathname === '/';
            if (isRootDocument) {
                const response = await fetch(`${baseUrl}/`);
                const html = (await response.text())
                    .replace('<script type="module" src="./assets/javascripts/luma-sw-update.js"></script>', '')
                    .replace('</body>', '<script>navigator.serviceWorker && navigator.serviceWorker.register("./legacy-sw.js");</script></body>');
                await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
                return;
            }
            await route.continue();
        });

        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await context.unroute('**/*');
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
        // Le service worker prend la main : le shell hérité vient désormais de son cache.
        await page.reload({ waitUntil: 'domcontentloaded' });
        check('l’ancien service worker contrôle la page', /legacy-sw\.js$/.test(await controllerScript(page)), await controllerScript(page));
        check('l’ancien cache luma-shell-v3 est en place', (await cacheNames(page)).includes('luma-shell-v3'), (await cacheNames(page)).join(', '));
        const legacyToasts = await page.locator('[data-luma-toast="service-worker"]').allInnerTexts();
        check('l’ancien shell ne déclenche aucune notification', legacyToasts.length === 0,
            legacyToasts.join(' | '));
        const legacyStartApps = await startMenuApps(page);
        const blockedInLegacy = ['Sonora Studio', 'Alimentation', 'Photos Luma']
            .filter((name) => legacyStartApps.includes(name));
        check('symptôme reconstitué : le bundle obsolète affiche les applications bloquées',
            blockedInLegacy.length === 3, `${blockedInLegacy.length}/3 — ${legacyStartApps.join(', ')}`);

        console.log('\n3. Le retour sur la page détecte la nouvelle version sans purge manuelle');
        // On retire le marqueur hérité : le service worker legacy sert désormais le
        // document réel, qui embarque le module de mise à jour.
        await page.evaluate(async () => {
            const cache = await caches.open('luma-shell-v3');
            await cache.delete('/__legacy_document__');
        });
        const loadsOnLegacyPage = await pageCount(page);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-luma-toast="service-worker"]', { timeout: 30000 });
        const promptText = await page.locator('[data-luma-toast="service-worker"]').innerText();
        check('la notification « Mise à jour disponible » s’affiche', promptText.includes('Mise à jour disponible'), promptText);
        check('la notification propose « Mettre à jour »',
            (await page.locator('[data-luma-toast="service-worker"] button', { hasText: 'Mettre à jour' }).count()) === 1);
        check('l’ancien service worker est toujours actif tant que l’utilisateur n’a pas tranché',
            /legacy-sw\.js$/.test(await controllerScript(page)), await controllerScript(page));
        check('aucun rechargement sans confirmation',
            (await pageCount(page)) === loadsOnLegacyPage + 1, `chargements ${await pageCount(page)}`);
        check('la notification sert de repli : l’ancien shell n’a pas d’indicateur',
            (await page.evaluate(() => window.LumaSwUpdate.getState().indicatorAttached)) === false);

        console.log('\n4. Confirmation de l’utilisateur');
        const firstUpdateLoads = await pageCount(page);
        const activated = page.waitForFunction(
            (expected) => Number(sessionStorage.getItem('luma.e2e.page-loads')) > expected,
            firstUpdateLoads,
            { timeout: 30000 }
        );
        await confirmUpdate(page);
        await activated;
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

        const versionA = (await pingServiceWorker(page)).version;
        check('la nouvelle version est active', /^[0-9a-f]{16}$/.test(versionA), versionA);
        check('la version correspond à sw.js servi', swResponse.body.includes(`RAW_BUILD_VERSION = "${versionA}"`));
        check('exactement un rechargement a eu lieu', (await pageCount(page)) === firstUpdateLoads + 1, `chargements ${await pageCount(page)}`);
        check('la notification disparaît après la mise à jour', (await updateToastCount(page)) === 0);
        const refreshedStartApps = await startMenuApps(page);
        check('le menu Démarrer n’affiche plus aucune application bloquée',
            !refreshedStartApps.some((name) => ['Sonora Studio', 'BrainDump', 'Alimentation'].includes(name)),
            refreshedStartApps.join(', '));
        check('le menu Démarrer conserve les applications visibles',
            refreshedStartApps.includes('Documents') && refreshedStartApps.includes('Bloc-notes'),
            refreshedStartApps.join(', '));
        await page.waitForFunction(
            () => document.getElementById('taskbar-update')?.dataset.updateState === 'up-to-date',
            null,
            { timeout: 20000 }
        );
        check('l’icône de mise à jour se retire une fois la version installée',
            (await page.locator('#taskbar-update').evaluate((element) => element.hidden)) === true);

        console.log('\n5. Purge des anciens caches sans toucher aux autres caches du domaine');
        await delay(3000);
        const cachesA = await cacheNames(page);
        check('l’ancien cache luma-shell-v3 est supprimé', !cachesA.includes('luma-shell-v3'), cachesA.join(', '));
        check('le cache versionné du shell existe', cachesA.includes(`luma-shell-${versionA}`), cachesA.join(', '));
        check('aucune boucle de rechargement', (await pageCount(page)) === firstUpdateLoads + 1, `chargements ${await pageCount(page)}`);

        console.log('\n6. Déploiement suivant');
        await delay(1200);
        fs.writeFileSync(probeFile, 'sw-cycle probe v2\n');
        await delay(1200);

        await page.evaluate(() => window.LumaSwUpdate.check());
        await page.waitForFunction(() => window.LumaSwUpdate.getState().phase === 'available', null, { timeout: 30000 });
        check('la seconde mise à jour est détectée', true);
        check('aucune popup : l’indicateur de la barre des tâches prend le relais',
            (await updateToastCount(page)) === 0);
        check('l’indicateur de la barre des tâches a remplacé la popup',
            (await page.evaluate(() => window.LumaSwUpdate.getState().indicatorAttached)) === true);
        check('la barre des tâches reflète la mise à jour disponible',
            (await page.locator('#taskbar-update').getAttribute('data-update-state')) === 'available');

        const secondUpdateLoads = await pageCount(page);
        const secondActivation = page.waitForFunction(
            (expected) => Number(sessionStorage.getItem('luma.e2e.page-loads')) > expected,
            secondUpdateLoads,
            { timeout: 30000 }
        );
        await page.evaluate(() => window.LumaSwUpdate.apply());
        await secondActivation;
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

        const versionB = (await pingServiceWorker(page)).version;
        check('la seconde version remplace la première', versionB !== versionA, `${versionA} → ${versionB}`);
        await delay(5000);
        const cachesB = await cacheNames(page);
        check('le cache de la version précédente est purgé', !cachesB.includes(`luma-shell-${versionA}`), cachesB.join(', '));
        check('le cache de la version courante est conservé', cachesB.includes(`luma-shell-${versionB}`), cachesB.join(', '));
        check('aucune boucle de rechargement après la seconde mise à jour',
            (await pageCount(page)) === secondUpdateLoads + 1, `chargements ${await pageCount(page)}`);

        console.log('\n7. Mode hors ligne');
        await context.setOffline(true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        check('le shell se charge hors ligne', (await page.locator('#toast-region').count()) === 1);
        check('le titre hors ligne est celui de Luma OS', (await page.title()) === 'Luma OS', await page.title());
        const offlineCaches = await cacheNames(page);
        check('le cache survit au rechargement hors ligne', offlineCaches.includes(`luma-shell-${versionB}`), offlineCaches.join(', '));
        await context.setOffline(false);

        console.log('\n8. Retour en ligne');
        await page.reload({ waitUntil: 'domcontentloaded' });
        check('la page se recharge correctement en ligne', (await page.title()) === 'Luma OS');
        const onlineVersion = (await pingServiceWorker(page)).version;
        check('le service worker reste stable après un aller-retour hors ligne', onlineVersion === versionB, onlineVersion);
        check('aucune fausse notification après le retour en ligne', (await updateToastCount(page)) === 0);

        console.log('\n9. Indicateur de la barre des tâches');
        fs.writeFileSync(probeFile, 'sw-cycle probe v3\n');
        await delay(1200);
        await page.evaluate(() => window.LumaSwUpdate.check());
        await page.waitForSelector('#taskbar-update[data-update-state="available"]', { timeout: 30000, state: 'attached' });
        check('l’icône de mise à jour sort du masquage quand une version est disponible',
            (await page.locator('#taskbar-update').evaluate((element) => element.hidden)) === false);
        check('l’icône expose l’état « available »',
            (await page.locator('#taskbar-update').getAttribute('data-update-state')) === 'available');
        const updateLabel = await page.locator('#taskbar-update').getAttribute('aria-label');
        check('l’étiquette annonce une mise à jour disponible', /disponible/i.test(updateLabel || ''), updateLabel);

        console.log('\n10. Paramètres > Mise à jour');
        await page.route('**/api/users/me/settings', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    theme: 'luma', accentColor: '#6d5ee8', density: 'comfortable', motion: 'system',
                    restoreSession: true, startupApps: [], startupDelayMs: 90, startupMode: 'staggered',
                    startupProfiles: {}, startupActiveProfile: null, startupOpenTrash: false,
                    startupOpenRecents: false, startupRestoreFolder: false, startupPresentation: false
                }
            })
        }));
        await page.route('**/api/health', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { status: 'ok', version: '3.3.0-alpha' } })
        }));

        const updateViewText = await page.evaluate(async () => {
            const host = document.createElement('div');
            host.id = 'e2e-settings-host';
            document.body.append(host);
            const module = await import('/apps/parametres/app.js');
            await module.mount(host, {
                toast: () => {},
                registry: [{ id: 'documents', name: 'Documents', icon: 'documents', module: '/apps/documents/app.js' }],
                options: { data: { view: 'update' } }
            });
            return host.innerText;
        });

        check('la vue s’ouvre directement sur Mise à jour', updateViewText.includes('Mise à jour'), updateViewText.slice(0, 80));
        check('elle affiche la version de Luma OS', updateViewText.includes('Luma OS 3.3.0-alpha'),
            updateViewText.replace(/\s+/g, ' ').slice(0, 260));
        check('elle distingue le build installé du build disponible',
            /Build installé/i.test(updateViewText) && /Build disponible/i.test(updateViewText));
        check('elle annonce la mise à jour disponible', updateViewText.includes('Mise à jour disponible'));
        check('elle liste les applications servies par le Service Worker',
            updateViewText.includes('/apps/documents/app.js'));
        check('elle liste les ressources mises en cache',
            updateViewText.includes('/assets/javascripts/luma-shell.js'));

        const installButton = page.locator('#e2e-settings-host [data-update-apply]');
        check('le bouton d’installation est actif tant que l’utilisateur n’a pas tranché',
            await installButton.isEnabled());

        await page.unroute('**/api/users/me/settings');
        await page.unroute('**/api/health');

        console.log('\n11. Avatars hors ligne');
        check('aucune requête d’avatar n’est émise sans session authentifiée (pas de 401)',
            avatarRequests.length === 0, `${avatarRequests.length} requête(s)`);

        const seeded = await page.evaluate(async () => {
            const store = await import('/assets/javascripts/luma-avatar-store.js');
            const { avatarMarkup, hydrateAvatars } = await import('/assets/javascripts/luma-avatar.js');
            store.setAvatarOwner('usr_e2e_avatar');
            const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#6d5ee8"/></svg>';
            await store.writeAvatar('usr_e2e_avatar', new Blob([svg], { type: 'image/svg+xml' }));
            const host = document.createElement('div');
            host.innerHTML = avatarMarkup('https://kyros.test/avatar', 'Mathéo', {});
            document.body.append(host);
            hydrateAvatars(host);
            await new Promise((resolve) => setTimeout(resolve, 600));
            const image = host.querySelector('img');
            host.remove();
            return { hasImage: Boolean(image), src: image?.getAttribute('src') || '', stored: Boolean(await store.readAvatar('usr_e2e_avatar')) };
        });
        check('l’avatar s’affiche depuis la copie locale', seeded.hasImage && seeded.src.startsWith('blob:'), seeded.src);
        check('la copie locale est conservée après un aller-retour réseau', seeded.stored);
        check('le cache d’avatars reste isolé dans son propre bac',
            (await cacheNames(page)).includes('luma-avatar-v1'), (await cacheNames(page)).join(', '));

        await context.setOffline(true);
        const offlineAvatar = await page.evaluate(async () => {
            const { avatarMarkup, hydrateAvatars } = await import('/assets/javascripts/luma-avatar.js');
            const host = document.createElement('div');
            host.innerHTML = avatarMarkup('https://kyros.test/avatar', 'Mathéo', {});
            document.body.append(host);
            hydrateAvatars(host);
            await new Promise((resolve) => setTimeout(resolve, 900));
            const image = host.querySelector('img');
            host.remove();
            return { hasImage: Boolean(image), src: image?.getAttribute('src') || '' };
        });
        check('l’avatar reste affichable hors ligne', offlineAvatar.hasImage && offlineAvatar.src.startsWith('blob:'), offlineAvatar.src);
        await context.setOffline(false);

        const loggedOut = await page.evaluate(async () => {
            const store = await import('/assets/javascripts/luma-avatar-store.js');
            store.setAvatarOwner(null);
            return { owner: store.getAvatarOwner(), cached: Boolean(await store.readAvatar('usr_e2e_avatar')) };
        });
        check('la déconnexion purge la copie locale de l’avatar', loggedOut.owner === null && loggedOut.cached === false, JSON.stringify(loggedOut));

        const sharedCacheAvatarEntries = await page.evaluate(async () => {
            const sharedKeys = (await caches.keys()).filter((key) => key.startsWith('luma-shell-'));
            const found = [];
            for (const key of sharedKeys) {
                const cache = await caches.open(key);
                for (const request of await cache.keys()) {
                    const pathname = new URL(request.url).pathname;
                    if (pathname.startsWith('/api/')) found.push(`${key} → ${pathname}`);
                }
            }
            return found;
        });
        check('le cache partagé du Service Worker ne contient aucune réponse d’API',
            sharedCacheAvatarEntries.length === 0, sharedCacheAvatarEntries.join(', '));

        console.log('\n12. Déploiement à chaud : aucun rechargement de page');
        const pendingLoads = await pageCount(page);
        await page.evaluate(() => window.LumaSwUpdate.apply());
        const reloaded = await page.waitForFunction(
            (expected) => Number(sessionStorage.getItem('luma.e2e.page-loads')) > expected,
            pendingLoads,
            { timeout: 30000 }
        ).then(() => true).catch(() => false);
        if (!reloaded) {
            check('l’application de la mise à jour en attente recharge la page', false,
                `chargements ${await pageCount(page)} — état ${JSON.stringify(await page.evaluate(() => window.LumaSwUpdate.getState()))}`);
        } else {
            await page.waitForFunction(() => window.LumaSwUpdate.getState().phase === 'up-to-date', null, { timeout: 20000 });

            const hotLoads = await pageCount(page);
            fs.writeFileSync(probeFile, `sw-cycle probe hot ${Date.now()}\n`);
            await page.waitForFunction(() => window.LumaSwUpdate.getState().phase === 'available', null, { timeout: 45000 });
            check('un déploiement est signalé sans rechargement ni action manuelle',
                (await pageCount(page)) === hotLoads, `chargements ${await pageCount(page)}`);
            check('l’indicateur de la barre des tâches affiche le déploiement',
                (await page.locator('#taskbar-update').getAttribute('data-update-state')) === 'available');
            check('le déploiement à chaud ne déclenche aucune popup',
                (await updateToastCount(page)) === 0);
        }
    } finally {
        fs.rmSync(probeFile, { force: true });
        fs.rmSync(legacyWorkerFile, { force: true });
        await browser?.close();
        await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
    }

    const unexpectedErrors = pageErrors.filter((message) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|favicon/i.test(message));
    if (unexpectedErrors.length) {
        failures.push(`erreurs navigateur : ${unexpectedErrors.join(' | ')}`);
    }

    console.log(`\n${failures.length ? 'ÉCHEC' : 'SUCCÈS'} — ${failures.length} problème(s).`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = failures.length ? 1 : 0;
}

main().catch((error) => {
    fs.rmSync(probeFile, { force: true });
    fs.rmSync(legacyWorkerFile, { force: true });
    console.error(error);
    process.exitCode = 1;
});
