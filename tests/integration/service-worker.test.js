// tests/integration/service-worker.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { VERSION_PLACEHOLDER } = require('../../src/server/services/build-version-service');
const { createTestConfig } = require('../helpers/test-config');
const { startTestServer, stopTestServer } = require('../helpers/test-server');

const projectRoot = path.resolve(__dirname, '../..');

let baseUrl;
let server;
let serviceWorkerSource;

before(async () => {
    const config = createTestConfig({ kyros: { enabled: false } });
    const started = await startTestServer(await createApp({ config }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

async function fetchServiceWorker() {
    return fetch(`${baseUrl}/sw.js`);
}

test('sw.js est servi sans cache HTTP et avec la version de build injectée', async () => {
    const response = await fetchServiceWorker();
    serviceWorkerSource = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(response.headers.get('cache-control'), /no-cache/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.ok(!serviceWorkerSource.includes(VERSION_PLACEHOLDER), 'le marqueur de build doit être remplacé');
    assert.match(serviceWorkerSource, /const RAW_BUILD_VERSION = "[0-9a-f]{16}";/);
});

test('sw.js reste serviable en HEAD pour le sondage d’enregistrement', async () => {
    const response = await fetch(`${baseUrl}/sw.js`, { method: 'HEAD' });

    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-cache/);
});

test('la version de build est stable tant que les sources ne changent pas', async () => {
    const [first, second] = await Promise.all([fetchServiceWorker(), fetchServiceWorker()]);

    assert.equal(await first.text(), await second.text());
});

test('le service worker n’active jamais un nouveau worker sans confirmation', () => {
    const skipWaitingCalls = serviceWorkerSource.match(/self\.skipWaiting\(\)/g) || [];

    assert.equal(skipWaitingCalls.length, 1, 'skipWaiting doit être appelé une seule fois, via le message SKIP_WAITING');
    assert.match(serviceWorkerSource, /data\.type === "SKIP_WAITING"/);
    assert.match(serviceWorkerSource, /self\.addEventListener\("install"/);
});

test('les anciens caches du shell sont purgés sans toucher aux autres caches du domaine', () => {
    assert.match(serviceWorkerSource, /key\.startsWith\(CACHE_PREFIX\)/);
    assert.match(serviceWorkerSource, /const CACHE_PREFIX = "luma-shell-"/);
    assert.ok(
        !serviceWorkerSource.includes('.filter((key) => key !== CACHE_NAME)'),
        'la purge doit rester limitée aux caches du shell'
    );
});

test('HTML, JavaScript et CSS passent par le réseau avec repli sur le cache', () => {
    assert.ok(serviceWorkerSource.includes('const NETWORK_FIRST_PATTERN = /\\.(js|mjs|css|html?)$/i;'));
    assert.match(serviceWorkerSource, /destination === "script"/);
    assert.match(serviceWorkerSource, /destination === "style"/);
    assert.match(serviceWorkerSource, /request\.mode === "navigate"/);
    assert.match(serviceWorkerSource, /cache\.match\(OFFLINE_FALLBACK_URL\)/);
});

test('les appels d’API et les autres protocoles ne sont pas interceptés', () => {
    assert.match(serviceWorkerSource, /pathname\.startsWith\("\/api\/"\)/);
    assert.match(serviceWorkerSource, /url\.protocol !== self\.location\.protocol/);
    assert.match(serviceWorkerSource, /url\.origin !== self\.location\.origin/);
});

test('le précache couvre le module de mise à jour', () => {
    assert.match(serviceWorkerSource, /"\.\/assets\/javascripts\/luma-sw-update\.js"/);
    assert.match(serviceWorkerSource, /Promise\.allSettled/);
});

test('index.html charge le module de mise à jour avant le shell', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const updateScript = html.indexOf('./assets/javascripts/luma-sw-update.js');
    const shellScript = html.indexOf('./assets/javascripts/luma-shell.js');

    assert.ok(updateScript > 0, 'index.html doit charger le module de mise à jour');
    assert.ok(updateScript < shellScript, 'le module de mise à jour doit précéder le shell');
});

test('le shell délègue l’enregistrement et expose une sauvegarde de session', () => {
    const shell = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-shell.js'), 'utf8');

    assert.ok(!shell.includes('navigator.serviceWorker.register'), 'l’enregistrement vit dans le module de mise à jour');
    assert.match(shell, /saveSession: flushSession/);
    assert.match(shell, /keepalive: true/);
});

test('les mises à jour sont recherchées au démarrage, au retour d’onglet et toutes les 30 minutes', () => {
    const module = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-sw-update.js'), 'utf8');

    assert.match(module, /const CHECK_INTERVAL_MS = 30 \* 60 \* 1000;/);
    assert.match(module, /document\.addEventListener\("visibilitychange"/);
    assert.match(module, /window\.addEventListener\("online"/);
    assert.match(module, /await state\.registration\.update\(\)/);
    assert.match(module, /navigator\.serviceWorker\.register\("\.\/sw\.js", \{ updateViaCache: "none" \}\)/);
});

test('le rechargement n’a lieu qu’une fois et après confirmation', () => {
    const module = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-sw-update.js'), 'utf8');

    assert.match(module, /navigator\.serviceWorker\.addEventListener\("controllerchange", onControllerChange\)/);
    assert.match(module, /if \(!state\.confirmed\)/);
    assert.match(module, /if \(state\.reloading\) return;/);
    assert.match(module, /now - readReloadGuard\(\) < RELOAD_GUARD_MS/);
    assert.match(module, /saveSessionBeforeReload\(\)/);
});

test('l’état de mise à jour est exposé aux applications et à la barre des tâches', () => {
    const module = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-sw-update.js'), 'utf8');
    const shell = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-shell.js'), 'utf8');
    const worker = serviceWorkerSource;

    assert.match(module, /window\.LumaSwUpdate = Object\.freeze\(\{[\s\S]*?subscribe,/);
    assert.match(module, /currentVersion: state\.currentVersion/);
    assert.match(module, /targetVersion: state\.targetVersion/);
    assert.match(module, /lastCheckedAt: state\.lastCheckedAt/);
    assert.match(module, /withServiceWorkerMessage\("GET_ASSETS", "ASSETS"\)/);
    assert.match(worker, /data\.type === "GET_ASSETS"/);
    assert.match(shell, /taskbar-update/);
    assert.match(shell, /window\.LumaSwUpdate\?\.attachIndicator\?\.\(applyUpdateButtonState\)/);
});

test('les échecs d’installation sont signalés puis réessayés', () => {
    const module = fs.readFileSync(path.join(projectRoot, 'sources/assets/javascripts/luma-sw-update.js'), 'utf8');

    assert.match(module, /worker\.state === "redundant"/);
    assert.match(module, /state\.installAttempts \+= 1;/);
    assert.match(module, /scheduleRetry\(RETRY_BASE_MS \* 2 \*\*/);
    assert.match(module, /La mise à jour n’a pas pu être installée/);
});
