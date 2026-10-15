// tests/integration/security-headers.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { startTestServer, stopTestServer } = require('../helpers/test-server');

const validWindow = { width: 600, height: 400, minWidth: 300, minHeight: 200 };

async function writeRegistry(entries) {
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'luma-csp-registry-')), 'apps.json');
    await fs.writeFile(file, JSON.stringify(entries));
    return file;
}

// Base SQLite isolée par serveur : deux createApp concurrents ne doivent jamais
// partager le même fichier (course sur les migrations).
let sqliteCounter = 0;
function createSecurityConfig() {
    sqliteCounter += 1;
    return createTestConfig({
        kyros: { enabled: false },
        database: {
            sqlite: {
                filePath: path.join(os.tmpdir(), `luma-csp-${process.pid}-${sqliteCounter}.sqlite`)
            }
        }
    });
}

function parseCsp(header) {
    const directives = {};
    for (const part of header.split(';')) {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (tokens.length) {
            directives[tokens[0].toLowerCase()] = tokens.slice(1);
        }
    }
    return directives;
}

// --- Serveur 1 : registre réel (aucune app iframe) ---
let realBaseUrl;
let realServer;

before(async () => {
    const started = await startTestServer(await createApp({ config: createSecurityConfig() }));
    realBaseUrl = started.baseUrl;
    realServer = started.server;
});

after(async () => {
    if (realServer) await stopTestServer(realServer);
});

test("la CSP n'autorise aucun script inline ni CDN externe", async () => {
    const response = await fetch(`${realBaseUrl}/api/health`);
    const csp = parseCsp(response.headers.get('content-security-policy'));

    assert.ok(csp['default-src']?.includes("'self'"));
    assert.deepEqual(csp['script-src'], ["'self'"]);
    assert.equal((csp['script-src'] || []).includes("'unsafe-inline'"), false);
    assert.equal((csp['script-src'] || []).some((v) => v.includes('jsdelivr')), false);
    assert.deepEqual(csp['script-src-attr'], ["'none'"]);
    assert.deepEqual(csp['object-src'], ["'none'"]);
    assert.deepEqual(csp['frame-ancestors'], ["'self'"]);
});

test("le style-src garde l'exception documentée pour les attributs dynamiques", async () => {
    const response = await fetch(`${realBaseUrl}/api/health`);
    const csp = parseCsp(response.headers.get('content-security-policy'));

    assert.deepEqual(csp['style-src'], ["'self'", "'unsafe-inline'"]);
});

test("sans app iframe, frame-src se limite à 'self'", async () => {
    const response = await fetch(`${realBaseUrl}/api/health`);
    const csp = parseCsp(response.headers.get('content-security-policy'));

    assert.deepEqual(csp['frame-src'], ["'self'"]);
});

// --- Serveur 2 : registre temporaire avec une app iframe activée et une désactivée ---
let iframeBaseUrl;
let iframeServer;
let tempRegistryFile;

before(async () => {
    tempRegistryFile = await writeRegistry([
        {
            id: 'demo-iframe',
            name: 'Démo iframe',
            icon: 'folder',
            entry: '/apps/demo/index.html',
            type: 'iframe',
            enabled: true,
            allowedOrigin: 'https://demo.example',
            window: validWindow
        },
        {
            id: 'off-iframe',
            name: 'Iframe désactivée',
            icon: 'folder',
            entry: '/apps/off/index.html',
            type: 'iframe',
            enabled: false,
            allowedOrigin: 'https://off.example',
            window: validWindow
        },
        {
            id: 'demo',
            name: 'Démo',
            icon: 'folder',
            entry: '/apps/demo/app.js',
            type: 'internal',
            enabled: true,
            window: validWindow
        }
    ]);
    const started = await startTestServer(await createApp({
        config: createSecurityConfig(),
        appRegistryPath: tempRegistryFile
    }));
    iframeBaseUrl = started.baseUrl;
    iframeServer = started.server;
});

after(async () => {
    if (iframeServer) await stopTestServer(iframeServer);
    if (tempRegistryFile) await fs.rm(tempRegistryFile, { force: true });
});

test("le frame-src intègre l'origine de l'app iframe activée", async () => {
    const response = await fetch(`${iframeBaseUrl}/api/health`);
    const csp = parseCsp(response.headers.get('content-security-policy'));

    assert.ok(csp['frame-src'].includes("'self'"));
    assert.ok(csp['frame-src'].includes('https://demo.example'));
    assert.equal(csp['frame-src'].includes('https://off.example'), false, "l'app désactivée ne doit pas figurer dans le frame-src");
});
