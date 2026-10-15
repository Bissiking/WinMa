// tests/e2e/shell.e2e.test.js
// Recette navigateur du shell : exécutez-la via `npm run test:e2e`
// (elle est sautée dans `npm test` afin de garder la suite unitaire rapide).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { openStartMenu, resolveBrowser, startE2ESession } = require('./helpers/e2e');

const skip = !process.env.LUMA_E2E
    ? 'Recette navigateur : exécutez npm run test:e2e.'
    : !resolveBrowser()
        ? 'Navigateur de recette indisponible (chromium système, ou LUMA_E2E_BROWSER=firefox|webkit avec `npx playwright-core install`).'
        : false;

let session;
let anonymousPage;
let anonymousContext;

before(async () => {
    if (skip) return;
    session = await startE2ESession();
    anonymousContext = await session.browser.newContext({ viewport: { width: 1440, height: 900 } });
    anonymousPage = await anonymousContext.newPage();
});

after(async () => {
    if (session) await session.stop();
});

test("l'écran de session s'affiche sans session", { skip }, async () => {
    await anonymousPage.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await anonymousPage.locator('#session-root').waitFor({ state: 'visible' });
    assert.ok(await anonymousPage.locator('.session-select').isVisible(), 'la sélection de session est rendue');
    assert.ok((await anonymousPage.locator('#session-root').innerText()).includes('Se connecter avec Kyros'));
    assert.equal(await anonymousPage.locator('#luma-desktop').isVisible(), false);

    // Les styles de l'écran viennent de luma-shell.css (session fusionnée dans le shell).
    const sessionStyle = await anonymousPage.locator('.session-select').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            backgroundImage: style.backgroundImage,
            minHeight: style.minHeight,
            viewportHeight: `${window.innerHeight}px`
        };
    });
    assert.match(sessionStyle.backgroundImage, /luma-aurora/, 'le fond de l’écran de session est appliqué');
    assert.equal(sessionStyle.minHeight, sessionStyle.viewportHeight, 'l’écran de session occupe la fenêtre');

    const buttonStyle = await anonymousPage.locator('.luma-primary-button').first().evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(buttonStyle, 'rgba(0, 0, 0, 0)', 'le bouton de connexion est habillé par les styles du shell');
});

test('le bureau démarre avec la session et charge le registre serveur', { skip }, async () => {
    await session.page.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await session.page.locator('#session-root').isVisible(), false);

    await openStartMenu(session.page);
    const startApps = session.page.locator('.start-app');
    const ids = await startApps.evaluateAll((buttons) => buttons.map((button) => button.dataset.openApp));

    for (const id of ['documents', 'calculator', 'terminal', 'calendar', 'settings', 'task-manager', 'luma-orbit', 'notepad', 'timer']) {
        assert.ok(ids.includes(id), `${id} doit figurer dans le menu démarrer`);
    }
    assert.equal(ids.includes('image-viewer'), false, 'les applications cachées restent hors menu');
    assert.equal(ids.includes('sonora-studio'), false, 'les applications désactivées du registre restent hors menu');
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS non interceptée au démarrage');
});

test('ouvrir Documents depuis le menu crée une fenêtre refermable', { skip }, async () => {
    await openStartMenu(session.page);
    await session.page.locator('.start-app[data-open-app="documents"]').click();

    const window = session.page.locator('.luma-window', { hasText: 'Documents' }).first();
    await window.waitFor({ state: 'visible' });
    assert.ok((await window.getAttribute('aria-label'))?.includes('Documents'));

    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS à la fermeture');
});

test("LumaOS.openApp ouvre Terminal et Paramètres", { skip }, async () => {
    await session.page.evaluate(() => {
        window.LumaOS.openApp('terminal');
        window.LumaOS.openApp('settings');
    });

    const terminal = session.page.locator('.luma-window', { hasText: 'Terminal' }).first();
    const settings = session.page.locator('.luma-window', { hasText: 'Paramètres' }).first();
    await terminal.waitFor({ state: 'visible' });
    await settings.waitFor({ state: 'visible' });
    await settings.locator('.settings-app').waitFor({ state: 'visible' });

    // Paramètres s'ouvre en cascade par-dessus Terminal : refermer la fenêtre
    // du dessus d'abord évite tout clic intercepté.
    await settings.locator('[data-window-action="close"]').click();
    await settings.waitFor({ state: 'detached' });
    await terminal.locator('[data-window-action="close"]').click();
    await terminal.waitFor({ state: 'detached' });
    assert.equal(await session.page.locator('.luma-window').count(), 0);
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS à l’ouverture des applications');
});

test('le Service Worker prend le contrôle de la page', { skip }, async () => {
    await session.page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

    const sw = await session.page.evaluate(async () => {
        const response = await fetch('./sw.js', { cache: 'no-store' });
        return {
            status: response.status,
            cacheControl: response.headers.get('cache-control'),
            body: await response.text()
        };
    });

    assert.equal(sw.status, 200);
    assert.match(sw.cacheControl, /no-cache/);
    assert.match(sw.body, /const RAW_BUILD_VERSION = "[0-9a-f]{16}";/);
});

test('le bureau reste utilisable en viewport mobile', { skip }, async () => {
    await session.page.setViewportSize({ width: 390, height: 844 });
    await openStartMenu(session.page);
    await session.page.locator('.start-app[data-open-app="settings"]').click();

    const settings = session.page.locator('.luma-window', { hasText: 'Paramètres' }).first();
    await settings.waitFor({ state: 'visible' });
    await settings.locator('[data-window-action="close"]').click();
    await settings.waitFor({ state: 'detached' });
    await session.page.setViewportSize({ width: 1440, height: 900 });
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS en viewport mobile');
});
