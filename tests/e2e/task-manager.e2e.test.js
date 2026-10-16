// tests/e2e/task-manager.e2e.test.js
// Gestionnaire des tâches : le contrat /api/system/metrics est consommé tel
// quel par l'interface — vue Performances rendue, périmètre affiché et aucune
// valeur invalide (NaN, Infinity) dans le rendu.
// Exécutez-la via `npm run test:e2e` (sautée dans `npm test`).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { openStartMenu, resolveBrowser, startE2ESession } = require('./helpers/e2e');

const skip = !process.env.LUMA_E2E
    ? 'Recette navigateur : exécutez npm run test:e2e.'
    : !resolveBrowser()
        ? 'Navigateur de recette indisponible (chromium système, ou LUMA_E2E_BROWSER=firefox|webkit avec `npx playwright-core install`).'
        : false;

let session;

before(async () => {
    if (skip) return;
    session = await startE2ESession();
    await session.page.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
});

after(async () => {
    if (session) await session.stop();
});

test('Gestionnaire des tâches : métriques avec périmètre explicite', { skip }, async () => {
    const { page } = session;

    // Contrat du payload avec la session du navigateur.
    const payload = await page.evaluate(async () => {
        const response = await fetch('/api/system/metrics', { headers: { accept: 'application/json' } });
        return { status: response.status, body: await response.json() };
    });
    assert.equal(payload.status, 200);
    assert.equal(payload.body.success, true);
    assert.ok(['host', 'container', 'probe'].includes(payload.body.data.meta.scope), 'périmètre déclaré par le serveur');
    assert.ok(payload.body.data.meta.sources, 'chaque métrique déclare sa source');

    // Ouverture du Gestionnaire des tâches et vue Performances.
    await openStartMenu(page);
    await page.locator('.start-app[data-open-app="task-manager"]').click();
    const window = page.locator('.luma-window[aria-label="Gestionnaire des tâches"]').first();
    await window.waitFor({ state: 'visible' });
    const app = window.locator('.task-manager-app');
    await app.waitFor({ state: 'visible' });

    await app.locator('[data-task-view="performance"]').click();
    const panel = app.locator('.performance-panel');
    await panel.waitFor({ state: 'visible' });
    await panel.locator('h2', { hasText: 'Processeur' }).waitFor({ state: 'visible' });
    await panel.locator('h2', { hasText: 'Mémoire' }).waitFor({ state: 'visible' });

    // Le périmètre réellement collecté apparaît dès la première réponse.
    await page.waitForFunction(() => {
        const caption = document.querySelector('.luma-window .performance-scope');
        return caption && /machine hôte|conteneur|collecteur/.test(caption.textContent);
    }, null, { timeout: 8000 });

    const rendered = await app.innerText();
    assert.ok(!rendered.includes('NaN'), 'aucun NaN dans le rendu des métriques');
    assert.ok(!rendered.includes('Infinity'), 'aucun Infinity dans le rendu des métriques');

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Gestionnaire des tâches');
    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
});
