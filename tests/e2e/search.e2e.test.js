// tests/e2e/search.e2e.test.js
// Recherche globale du bureau (Ctrl+K) : applications du registre, documents
// du serveur, réglages et événements du Calendrier, avec ouverture du résultat.
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

before(async () => {
    if (skip) return;
    session = await startE2ESession();
    await session.page.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
});

after(async () => {
    if (session) await session.stop();
});

async function openGlobalSearch(page, query) {
    await page.keyboard.press('Control+k');
    await page.locator('#app-search').waitFor({ state: 'visible' });
    await page.locator('#app-search').fill(query);
}

test('Recherche globale : applications, documents, réglages et événements', { skip }, async () => {
    const { page } = session;

    // Fixtures : un document texte créé avec la session du navigateur et un
    // événement Calendrier injecté dans le stockage local.
    const createdStatus = await page.evaluate(async () => {
        const response = await fetch('/api/documents/text', {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: window.location.origin },
            body: JSON.stringify({ name: 'Rapport-projecteur-X9.md', content: '# Rapport X9' })
        });
        return response.status;
    });
    assert.equal(createdStatus, 201, 'document de fixture créé');
    await page.evaluate(() => {
        localStorage.setItem('luma.calendar.events', JSON.stringify([
            { id: 'e2e-zeppelin', date: '2026-10-20', time: '14:00', title: 'Réunion Zeppelin' }
        ]));
    });

    // 1. Applications : « calc » groupe Applications, Entrée ouvre la fenêtre.
    await openGlobalSearch(page, 'calc');
    const calcGroup = page.locator('#start-apps .start-group', { hasText: 'Applications' });
    await calcGroup.waitFor({ state: 'visible' });
    const calcResult = page.locator('#start-apps .start-app--row', { hasText: 'Calculatrice' }).first();
    await calcResult.waitFor({ state: 'visible' });
    assert.ok(await page.locator('#start-apps .start-app--row', { hasText: 'Documents' }).first().isHidden(), 'le groupe Documents reste vide sans requête serveur valide');

    await page.keyboard.press('Enter');
    await page.locator('.luma-window[aria-label="Calculatrice"]').first().waitFor({ state: 'visible' });
    await page.locator('#start-panel').waitFor({ state: 'hidden' });

    // 2. Documents : le résultat ouvre Documents avec la recherche pré-remplie.
    await openGlobalSearch(page, 'rapport-projecteur');
    const docGroup = page.locator('#start-apps .start-group', { hasText: 'Documents' });
    await docGroup.waitFor({ state: 'visible', timeout: 8000 });
    const docResult = page.locator('#start-apps .start-app--row', { hasText: 'Rapport-projecteur-X9.md' }).first();
    await docResult.waitFor({ state: 'visible' });
    assert.ok(await page.locator('#start-apps .start-group', { hasText: 'Applications' }).isHidden(), 'aucun groupe vide : les applications non pertinentes sont retirées');
    await docResult.click();

    const docsWindow = page.locator('.luma-window[aria-label="Documents"]').first();
    await docsWindow.waitFor({ state: 'visible' });
    const docsSearch = docsWindow.locator('.documents-search input');
    await docsSearch.waitFor({ state: 'visible' });
    assert.equal(await docsSearch.inputValue(), 'rapport-projecteur', 'la recherche du panneau est reprise par Documents');
    await docsWindow.locator('.documents-list [data-item-id]', { hasText: 'Rapport-projecteur-X9.md' }).first().waitFor({ state: 'visible', timeout: 8000 });

    // 3. Réglages : « corbeille » pointe vers la vue Stockage des Paramètres.
    await openGlobalSearch(page, 'corbeille');
    const storageResult = page.locator('#start-apps .start-app--row', { hasText: 'Stockage' }).first();
    await storageResult.waitFor({ state: 'visible' });
    assert.ok(await page.locator('#start-apps .start-group', { hasText: 'Réglages' }).isVisible());
    await storageResult.click();

    const settingsWindow = page.locator('.luma-window[aria-label="Paramètres"]').first();
    await settingsWindow.waitFor({ state: 'visible' });
    await settingsWindow.locator('.settings-sidebar nav [data-settings-view="storage"].is-current').waitFor({ state: 'visible', timeout: 8000 });

    // 4. Événements : le titre injecté est retrouvé et ouvre le Calendrier.
    await openGlobalSearch(page, 'zeppelin');
    const eventGroup = page.locator('#start-apps .start-group', { hasText: 'Événements' });
    await eventGroup.waitFor({ state: 'visible' });
    const eventResult = page.locator('#start-apps .start-app--row', { hasText: 'Réunion Zeppelin' }).first();
    await eventResult.waitFor({ state: 'visible' });
    assert.ok(await eventResult.locator('small', { hasText: '2026-10-20' }).isVisible(), 'la date de l’événement est affichée');
    await eventResult.click();
    await page.locator('.luma-window[aria-label="Calendrier"]').first().waitFor({ state: 'visible' });

    // 5. Aucun résultat : message explicite, puis fermeture sur Échap.
    await openGlobalSearch(page, 'zzz-aucun-resultat');
    await page.locator('#start-apps .start-empty', { hasText: 'Aucun résultat' }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('#start-panel').waitFor({ state: 'hidden' });
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#app-search').inputValue(), '', 'la recherche est réinitialisée entre deux ouvertures');
    await page.keyboard.press('Escape');

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Recherche');
});
