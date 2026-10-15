// tests/e2e/backup.e2e.test.js
// Parcours de sauvegarde : export d'un fichier luma-backup puis import de ce
// même fichier avec confirmation de restauration.
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

function toast(page, text) {
    return page.locator('#toast-region .toast', { hasText: text }).first();
}

test('Sauvegarde : export du fichier puis import avec restauration', { skip }, async () => {
    const { page } = session;
    await page.evaluate(() => window.LumaOS.openApp('settings'));
    const window = page.locator('.luma-window[aria-label="Paramètres"]').first();
    await window.waitFor({ state: 'visible' });
    const id = await window.getAttribute('id');
    const settingsWindow = page.locator(`[id="${id}"]`);
    const app = settingsWindow.locator('.settings-app');
    await app.waitFor({ state: 'visible' });

    await app.locator('[data-settings-view="backup"]').first().click();
    await app.locator('[data-backup-export]').waitFor({ state: 'visible' });

    // 1. Export : le téléchargement produit un fichier de sauvegarde valide.
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        app.locator('[data-backup-export]').click()
    ]);
    const backup = JSON.parse(await streamToString(await download.createReadStream()));
    assert.equal(backup.format, 'luma-backup');
    assert.equal(backup.schemaVersion, 1);
    assert.ok(backup.exportedAt, 'la date d’export est renseignée');
    assert.ok(backup.server?.settings, 'les paramètres serveur sont embarqués');
    assert.ok(Array.isArray(backup.server?.windows), 'la disposition du bureau est embarquée');
    assert.ok(backup.browser && typeof backup.browser === 'object', 'les données locales du navigateur sont embarquées');

    // 2. Import du même fichier : la restauration est confirmée puis le bureau
    // se recharge (le toast précède le rechargement).
    await app.locator('[data-backup-file]').setInputFiles({
        name: 'luma-sauvegarde-e2e.json',
        mimeType: 'application/json',
        buffer: Buffer.from(`${JSON.stringify(backup, null, 2)}\n`)
    });
    await toast(page, 'Restauration terminée').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Sauvegarde');
});

async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}
