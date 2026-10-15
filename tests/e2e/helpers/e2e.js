// tests/e2e/helpers/e2e.js
const fs = require('node:fs');
const net = require('node:net');
const { chromium, firefox, webkit } = require('playwright-core');
const { createApp } = require('../../../src/server/app');
const { createTestConfig } = require('../../helpers/test-config');
const { createFakeKyros, loginAs } = require('../../helpers/fake-kyros');
const { extractCookie, stopTestServer } = require('../../helpers/test-server');

// Recette Chromium sur le navigateur système (Edge et Chrome sont détectés
// automatiquement) ; LUMA_E2E_BROWSER_PATH force un exécutable.
// LUMA_E2E_BROWSER=firefox|webkit bascule sur les moteurs Playwright installés
// via `npx playwright-core install firefox webkit`.
const BROWSER_CANDIDATES = [
    process.env.LUMA_E2E_BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
];

function resolveBrowserPath() {
    return BROWSER_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

// Moteur de recette actif : chromium (défaut, système) | firefox | webkit.
function resolveBrowser() {
    const kind = process.env.LUMA_E2E_BROWSER || 'chromium';

    if (kind === 'firefox' || kind === 'webkit') {
        const engine = kind === 'firefox' ? firefox : webkit;
        try {
            const executable = engine.executablePath();
            if (executable && fs.existsSync(executable)) {
                return { kind, label: `Playwright ${kind}`, launch: () => engine.launch({ headless: true }) };
            }
        } catch {
            // navigateur non installé : on retombe sur l'indisponibilité.
        }
        return null;
    }

    const browserPath = resolveBrowserPath();
    if (!browserPath) return null;
    return { kind: 'chromium', label: browserPath, launch: () => chromium.launch({ executablePath: browserPath, headless: true }) };
}

function reservePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close((error) => (error ? reject(error) : resolve(port)));
        });
    });
}

function parseCookie(cookie) {
    const separator = cookie.indexOf('=');
    return { name: cookie.slice(0, separator), value: cookie.slice(separator + 1) };
}

// Serveur complet (faux Kyros inclus) + page navigateur authentifiée par le
// cookie de session obtenu hors navigateur : le parcours SSO lui-même est déjà
// couvert par tests/integration/auth.test.js.
async function startE2ESession() {
    const browser = resolveBrowser();
    if (!browser) return null;

    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const config = createTestConfig({ appBaseUrl: baseUrl });
    const fake = createFakeKyros(config);
    const app = await createApp({ config, fetchImplementation: fake.fetchImplementation });
    const server = await new Promise((resolve, reject) => {
        const instance = app.listen(port, '127.0.0.1', () => resolve(instance));
        instance.on('error', reject);
    });

    const { cookie } = await loginAs(baseUrl, fake, { extractCookie });

    const launched = await browser.launch();
    const context = await launched.newContext({ viewport: { width: 1440, height: 900 } });
    const { name, value } = parseCookie(cookie);
    await context.addCookies([{ name, value, url: baseUrl }]);

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    return {
        browser: launched,
        context,
        page,
        baseUrl,
        server,
        pageErrors,
        takePageErrors() {
            return pageErrors.splice(0, pageErrors.length);
        },
        async stop() {
            await launched.close();
            await stopTestServer(server);
        }
    };
}

async function openStartMenu(page) {
    const startPanel = page.locator('#start-panel');
    if (await startPanel.getAttribute('hidden') !== null) {
        await page.locator('#luma-launcher').click();
    }
    await startPanel.waitFor({ state: 'visible' });
}

module.exports = { resolveBrowserPath, resolveBrowser, startE2ESession, openStartMenu };
