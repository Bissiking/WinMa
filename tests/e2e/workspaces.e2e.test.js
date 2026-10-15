// tests/e2e/workspaces.e2e.test.js
// Parcours d’espaces de travail : création depuis la disposition courante,
// ouverture d’applications, bascule entre espaces avec rechargement du bureau.
// Exécutez-la via `npm run test:e2e` (sautée dans `npm test`).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { resolveBrowser, startE2ESession } = require('./helpers/e2e');

const skip = !process.env.LUMA_E2E
    ? 'Recette navigateur : exécutez npm run test:e2e.'
    : !resolveBrowser()
        ? 'Navigateur de recette indisponible (chromium système, ou LUMA_E2E_BROWSER=firefox|webkit avec `npx playwright-core install`).'
        : false;

let session;
let promptAnswers = [];

before(async () => {
    if (skip) return;
    session = await startE2ESession();
    session.page.on('dialog', (dialog) => {
        dialog.accept(promptAnswers.shift() ?? '').catch(() => {});
    });
    await session.page.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
});

after(async () => {
    if (session) await session.stop();
});

function toast(page, text) {
    return page.locator('#toast-region .toast', { hasText: text }).first();
}

async function openAppWindow(page, appId, title) {
    await page.evaluate((id) => window.LumaOS.openApp(id), appId);
    const window = page.locator(`.luma-window[aria-label="${title}"]`).first();
    await window.waitFor({ state: 'visible' });
    const id = await window.getAttribute('id');
    return page.locator(`[id="${id}"]`);
}

test('Espaces : création, bascule et rechargement du bureau', { skip }, async () => {
    const { page } = session;
    const settingsWindow = await openAppWindow(page, 'settings', 'Paramètres');
    const app = settingsWindow.locator('.settings-app');
    await app.waitFor({ state: 'visible' });
    await app.locator('[data-settings-view="workspaces"]').first().click();
    await app.locator('[data-ws-create]').waitFor({ state: 'visible' });

    // 1. « Minimal » capture la disposition courante (Paramètres seule) et devient actif.
    promptAnswers.push('Minimal');
    await app.locator('[data-ws-create]').click();
    await app.locator('.workspace-row', { hasText: 'Minimal' }).first().waitFor({ state: 'visible' });
    await toast(page, 'Espace « Minimal » créé').waitFor({ state: 'visible' });
    assert.ok(await app.locator('.workspace-row.is-active', { hasText: 'Minimal' }).isVisible(), 'le nouvel espace est actif');

    // 2. Deux fenêtres supplémentaires : « Complet » les capture, puis bascule.
    await openAppWindow(page, 'notepad', 'Bloc-notes');
    await openAppWindow(page, 'calculator', 'Calculatrice');
    await settingsWindow.locator('.window-titlebar').click();
    promptAnswers.push('Complet');
    await app.locator('[data-ws-create]').click();
    await app.locator('.workspace-row', { hasText: 'Complet' }).first().waitFor({ state: 'visible' });
    await toast(page, 'Espace « Complet » créé').waitFor({ state: 'visible' });

    // 3. Bascule sur « Minimal » : le bureau se recharge avec sa seule fenêtre.
    await settingsWindow.locator('.window-titlebar').click();
    const minimalRow = page.locator('.workspace-row', { hasText: 'Minimal' }).first();
    await minimalRow.locator('[data-ws-activate]').click();
    await toast(page, '« Minimal » appliqué').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('.luma-window[aria-label="Calculatrice"]').waitFor({ state: 'detached' });
    await page.locator('.luma-window[aria-label="Bloc-notes"]').waitFor({ state: 'detached' });
    await page.locator('.luma-window[aria-label="Paramètres"]').first().waitFor({ state: 'visible' });

    // 4. Retour sur « Complet » : les deux fenêtres reviennent.
    const restoredSettings = page.locator('.luma-window[aria-label="Paramètres"]').first();
    await restoredSettings.waitFor({ state: 'visible' });
    const restoredId = await restoredSettings.getAttribute('id');
    const restoredApp = page.locator(`[id="${restoredId}"] .settings-app`);
    await restoredSettings.locator('.window-titlebar').click();
    await restoredApp.locator('[data-settings-view="workspaces"]').first().click();
    const completRow = page.locator('.workspace-row', { hasText: 'Complet' }).first();
    await completRow.locator('[data-ws-activate]').click();
    await toast(page, '« Complet » appliqué').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('.luma-window[aria-label="Bloc-notes"]').first().waitFor({ state: 'visible' });
    await page.locator('.luma-window[aria-label="Calculatrice"]').first().waitFor({ state: 'visible' });

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Espaces');
});
