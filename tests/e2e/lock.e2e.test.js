// tests/e2e/lock.e2e.test.js
// Verrouillage manuel et automatique, reprise de session et propagation
// multi-onglets. Exécutez-la via `npm run test:e2e` (sautée dans `npm test`).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { openStartMenu, resolveBrowser, startE2ESession } = require('./helpers/e2e');

const skip = !process.env.LUMA_E2E
    ? 'Recette navigateur : exécutez npm run test:e2e.'
    : !resolveBrowser()
        ? 'Navigateur de recette indisponible (chromium système, ou LUMA_E2E_BROWSER=firefox|webkit avec `npx playwright-core install`).'
        : false;

let session;

async function bootDesktop(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
}

async function patchSettings(page, patch) {
    return page.evaluate(async (body) => {
        const response = await fetch('/api/users/me/settings', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });
        return response.status;
    }, patch);
}

before(async () => {
    if (skip) return;
    session = await startE2ESession();
});

after(async () => {
    if (session) await session.stop();
});

test('Verrouiller conserve le bureau et « Reprendre la session » le rouvre', { skip }, async () => {
    await bootDesktop(session.page, session.baseUrl);

    // Une fenêtre ouverte avant le verrou doit survivre à la reprise.
    await openStartMenu(session.page);
    await session.page.locator('.start-app[data-open-app="documents"]').click();
    const window = session.page.locator('.luma-window[aria-label="Documents"]').first();
    await window.waitFor({ state: 'visible' });

    await openStartMenu(session.page);
    await session.page.locator('[data-session-action="lock"]').click();

    await session.page.locator('.session-select').waitFor({ state: 'visible' });
    const text = await session.page.locator('#session-root').innerText();
    assert.ok(text.includes('Session verrouillée.'), 'le message de verrouillage est affiché');
    assert.ok(text.includes('Reprendre la session'), 'le bouton de reprise est proposé');
    assert.equal(await session.page.locator('#luma-desktop').isVisible(), false);

    await session.page.locator('#session-connect').click();
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible' });
    assert.ok(await window.isVisible(), 'la fenêtre ouverte avant le verrou est toujours là');
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS lors du verrouillage et de la reprise');
});

test('Le verrouillage automatique se déclenche après inactivité', { skip }, async () => {
    // Délai minimal serveur (30 s) + horloge simulée : aucune attente réelle.
    assert.equal(await patchSettings(session.page, { lockAfterIdleMs: 30000 }), 200);

    await session.page.clock.install();
    // Réapplique les paramètres : applySettings réarme le timer sous l'horloge simulée.
    await session.page.evaluate(async () => {
        const payload = await (await fetch('/api/users/me/settings', { credentials: 'same-origin' })).json();
        window.dispatchEvent(new CustomEvent('luma:settings', { detail: payload.data }));
    });
    await session.page.clock.fastForward(30500);

    await session.page.locator('.session-select').waitFor({ state: 'visible', timeout: 5000 });
    assert.ok((await session.page.locator('#session-root').innerText()).includes('Session verrouillée.'));

    // La reprise réarme le timer : la période suivante verrouille à nouveau.
    await session.page.locator('#session-connect').click();
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible' });
    await session.page.clock.fastForward(30500);
    await session.page.locator('.session-select').waitFor({ state: 'visible', timeout: 5000 });

    // Le clock reste installé sur la page : le temps repart en temps réel
    // après le dernier fastForward (playwright-core n'expose pas d'uninstall).
    assert.equal(await patchSettings(session.page, { lockAfterIdleMs: 300000 }), 200, 'le délai par défaut est restauré');
    // Réapplique le délai restauré dans le shell avant la reprise.
    await session.page.evaluate(async () => {
        const payload = await (await fetch('/api/users/me/settings', { credentials: 'same-origin' })).json();
        window.dispatchEvent(new CustomEvent('luma:settings', { detail: payload.data }));
    });
    await session.page.locator('#session-connect').click();
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible' });
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS lors du verrouillage automatique');
});

test('Le verrouillage d’un onglet se propage aux autres onglets', { skip }, async () => {
    const second = await session.context.newPage();
    await bootDesktop(second, session.baseUrl);

    await session.page.evaluate(() => window.LumaOS.lock());
    await second.locator('.session-select').waitFor({ state: 'visible', timeout: 5000 });
    assert.ok((await second.locator('#session-root').innerText()).includes('Session verrouillée.'));

    // La reprise sur un onglet ne déverrouille pas l'autre (verrou local).
    await second.locator('#session-connect').click();
    await second.locator('#luma-desktop').waitFor({ state: 'visible' });
    assert.ok(await session.page.locator('.session-select').isVisible(), 'le premier onglet reste verrouillé');
    await second.close();
});

test('La déconnexion d’un onglet se propage aux autres onglets', { skip }, async () => {
    // Le test précédent a laissé le premier onglet verrouillé : on le reprend.
    await session.page.locator('#session-connect').click();
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible' });

    const second = await session.context.newPage();
    await bootDesktop(second, session.baseUrl);

    await openStartMenu(session.page);
    await session.page.locator('[data-session-action="logout"]').click();
    await session.page.locator('.session-select').waitFor({ state: 'visible' });
    assert.ok((await session.page.locator('#session-root').innerText()).includes('Vous êtes déconnecté.'));

    await second.locator('.session-select').waitFor({ state: 'visible', timeout: 5000 });
    assert.ok((await second.locator('#session-root').innerText()).includes('Session close sur un autre onglet.'));

    // La session serveur est bien détruite : reprise impossible sans reconnexion.
    const sessionState = await second.evaluate(async () => (await fetch('/api/session', { credentials: 'same-origin' })).status);
    assert.equal(sessionState, 200);
    const authenticated = await second.evaluate(async () => {
        const payload = await (await fetch('/api/session', { credentials: 'same-origin' })).json();
        return payload.data.authenticated;
    });
    assert.equal(authenticated, false, 'la session serveur est terminée');
    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS lors de la propagation de la déconnexion');
});
