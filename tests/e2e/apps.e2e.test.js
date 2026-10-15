// tests/e2e/apps.e2e.test.js
// Parcours métier profonds : Documents (dossier, import, corbeille, restauration,
// quota), Bloc-notes (édition, enregistrement, aperçu), Calendrier (événement),
// Terminal (commandes, gestion des fenêtres, easter egg sudo reboot).
// Exécutez-la via `npm run test:e2e` (sautée dans `npm test`).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { openStartMenu, resolveBrowser, startE2ESession } = require('./helpers/e2e');

const skip = !process.env.LUMA_E2E
    ? 'Recette navigateur : exécutez npm run test:e2e.'
    : !resolveBrowser()
        ? 'Navigateur de recette indisponible (chromium système, ou LUMA_E2E_BROWSER=firefox|webkit avec `npx playwright-core install`).'
        : false;

let session;
let uploadFile;

before(async () => {
    if (skip) return;
    uploadFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'luma-e2e-')), 'note-import.txt');
    await fs.writeFile(uploadFile, 'Contenu importé par la recette E2E.\n');
    session = await startE2ESession();
    await session.page.goto(session.baseUrl, { waitUntil: 'networkidle' });
    await session.page.locator('#luma-desktop').waitFor({ state: 'visible', timeout: 20000 });
});

after(async () => {
    if (session) await session.stop();
    if (uploadFile) await fs.rm(path.dirname(uploadFile), { recursive: true, force: true });
});

async function openAppWindow(page, appId, title) {
    await page.evaluate((id) => window.LumaOS.openApp(id), appId);
    // Filtre sur aria-label (le texte de la fenêtre peut contenir le titre
    // ailleurs — ex. sortie du Terminal — et peut changer, ex. « • Sans titre.md »).
    const window = page.locator(`.luma-window[aria-label="${title}"]`).first();
    await window.waitFor({ state: 'visible' });
    const id = await window.getAttribute('id');
    return page.locator(`[id="${id}"]`);
}

function toast(page, text) {
    return page.locator('#toast-region .toast', { hasText: text }).first();
}

test('Documents : dossier, import, corbeille, restauration et quota', { skip }, async () => {
    const { page } = session;
    await openStartMenu(page);
    await page.locator('.start-app[data-open-app="documents"]').click();

    const window = page.locator('.luma-window[aria-label="Documents"]').first();
    await window.waitFor({ state: 'visible' });
    const app = window.locator('.documents-app');
    await app.waitFor({ state: 'visible' });
    await app.locator('.documents-toolbar').waitFor({ state: 'visible' });

    // 1. Nouveau dossier via le dialogue.
    await app.locator('.documents-toolbar [data-action="new-folder"]').click();
    const dialog = app.locator('.documents-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('h2').innerText(), 'Nouveau dossier');
    await dialog.locator('input[name="value"]').fill('Dossier E2E');
    await dialog.locator('button[value="confirm"]').click();
    await dialog.waitFor({ state: 'hidden' });
    const folderRow = app.locator('.document-row', { hasText: 'Dossier E2E' }).first();
    await folderRow.waitFor({ state: 'visible' });

    // 2. Import d'un fichier (quota avant/après).
    const quotaBefore = await app.locator('.storage-summary strong[data-storage-label]').innerText();
    await app.locator('.documents-toolbar input.document-upload').setInputFiles(uploadFile);
    await toast(page, 'note-import.txt a été importé.').waitFor({ state: 'visible' });
    const fileRow = app.locator('.document-row', { hasText: 'note-import.txt' }).first();
    await fileRow.waitFor({ state: 'visible' });
    const quotaAfter = await app.locator('.storage-summary strong[data-storage-label]').innerText();
    assert.notEqual(quotaAfter, quotaBefore, 'le quota doit évoluer après un import');
    assert.match(quotaAfter, /\/ 1 Go/);

    // 3. Sélection + envoi à la corbeille (checkbox de la ligne, pas la ligne).
    await fileRow.locator('input[type="checkbox"]').check();
    await app.locator('.documents-selection-bar').waitFor({ state: 'visible' });
    await app.locator('.documents-toolbar [data-action="trash"]').click();
    await toast(page, 'Déplacé dans la Corbeille.').waitFor({ state: 'visible' });
    await fileRow.waitFor({ state: 'detached' });

    // 4. Corbeille : restauration.
    await app.locator('.documents-nav [data-location="trash"]').click();
    const trashRow = app.locator('.document-row', { hasText: 'note-import.txt' }).first();
    await trashRow.waitFor({ state: 'visible' });
    await trashRow.locator('input[type="checkbox"]').check();
    await app.locator('.documents-toolbar [data-action="restore"]').click();
    await toast(page, 'Élément restauré.').waitFor({ state: 'visible' });
    await trashRow.waitFor({ state: 'detached' });

    // 5. Retour à la racine : le fichier restauré est présent.
    await app.locator('.documents-nav [data-location="root"]').click();
    await app.locator('.document-row', { hasText: 'note-import.txt' }).first().waitFor({ state: 'visible' });

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Documents');
    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
});

test('Bloc-notes : édition, enregistrement et aperçu Markdown', { skip }, async () => {
    const { page } = session;
    const window = await openAppWindow(page, 'notepad', 'Bloc-notes');
    const app = window.locator('.notepad-app');
    await app.waitFor({ state: 'visible' });

    assert.equal(await app.locator('.notepad-status').innerText(), 'Nouveau document');
    assert.equal(await app.locator('input[data-note-name]').inputValue(), 'Sans titre.md');

    const editor = app.locator('textarea[data-note-editor]');
    await editor.fill('# Titre E2E\n\nContenu **gras** de la recette.');
    assert.equal(await app.locator('.notepad-status').innerText(), 'Modifications non enregistrées');
    assert.ok((await window.getAttribute('aria-label')).startsWith('• '), 'le titre signale les modifications');

    await app.locator('button[data-note-save]').click();
    await app.locator('.notepad-status', { hasText: 'Enregistré' }).waitFor({ state: 'visible' });
    await toast(page, 'Sans titre.md a été enregistré.').waitFor({ state: 'visible' });

    await app.locator('button[data-note-mode="preview"]').click();
    const preview = app.locator('.notepad-preview');
    await preview.waitFor({ state: 'visible' });
    assert.ok(await preview.locator('h1', { hasText: 'Titre E2E' }).isVisible(), 'le titre Markdown est rendu');
    assert.ok(await preview.locator('strong', { hasText: 'gras' }).isVisible(), 'le gras Markdown est rendu');

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Bloc-notes');
    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
});

test('Calendrier : création et suppression d’un événement persistant', { skip }, async () => {
    const { page } = session;
    const window = await openAppWindow(page, 'calendar', 'Calendrier');
    const app = window.locator('.calendar-app');
    await app.waitFor({ state: 'visible' });

    await app.locator('button[data-calendar-add]').click();
    const dialog = window.locator('.calendar-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('h2').innerText(), 'Nouvel événement');

    await dialog.locator('input[name="date"]').fill('2030-01-15');
    await dialog.locator('input[name="time"]').fill('14:30');
    await dialog.locator('input[name="title"]').fill('Réunion E2E');
    await dialog.locator('button.calendar-dialog-submit').click();
    await dialog.waitFor({ state: 'hidden' });

    const event = app.locator('li.calendar-event', { hasText: 'Réunion E2E' }).first();
    await event.waitFor({ state: 'visible' });
    assert.equal(await event.locator('.calendar-event-time').innerText(), '14:30');
    assert.equal(await app.locator('[data-calendar-month-title]').innerText(), 'Janvier 2030');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('luma.calendar.events') || '[]'));
    assert.ok(stored.some((item) => item.title === 'Réunion E2E' && item.time === '14:30'), 'événement persistant côté client');

    await event.locator('button[data-event-remove]').click();
    await event.waitFor({ state: 'detached' });

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Calendrier');
    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
});

test('Terminal : commandes, gestion des fenêtres et easter egg sudo reboot', { skip }, async () => {
    const { page } = session;
    const window = await openAppWindow(page, 'terminal', 'Terminal');
    const app = window.locator('.terminal-app');
    await app.waitFor({ state: 'visible' });
    const output = app.locator('[data-terminal-output]');

    async function run(command) {
        const input = app.locator('.terminal-input');
        await input.fill(command);
        await input.press('Enter');
    }

    // help / echo : sorties simples.
    await run('help');
    await output.locator('.terminal-line', { hasText: 'affiche la liste des commandes' }).first().waitFor({ state: 'visible' });
    await run('echo bonjour e2e');
    await output.locator('.terminal-line', { hasText: 'bonjour e2e' }).first().waitFor({ state: 'visible' });

    // open / ps / close : gestion des fenêtres depuis le terminal.
    // Cibles par aria-label : la sortie du terminal contient aussi « Documents ».
    await run('open documents');
    const documentsWindow = page.locator('.luma-window[aria-label="Documents"]').first();
    await documentsWindow.waitFor({ state: 'visible' });
    await run('ps');
    await output.locator('.terminal-line', { hasText: '[documents]' }).first().waitFor({ state: 'visible' });
    await run('close documents');
    await output.locator('.terminal-line', { hasText: 'Fermeture de 1 fenêtre(s) de documents.' }).first().waitFor({ state: 'visible' });
    await documentsWindow.waitFor({ state: 'detached' });

    // Easter egg : sudo reboot ouvre Matheo Systems.
    await run('sudo reboot');
    await output.locator('.terminal-line', { hasText: 'Ouverture de Matheo Systems…' }).first().waitFor({ state: 'visible' });
    const matheo = page.locator('.luma-window[aria-label="Matheo Systems"]').first();
    await matheo.waitFor({ state: 'visible' });
    await matheo.locator('.matheo-systems-app').waitFor({ state: 'visible' });
    await matheo.locator('[data-window-action="close"]').click();
    await matheo.waitFor({ state: 'detached' });

    assert.deepEqual(session.takePageErrors(), [], 'aucune erreur JS dans le parcours Terminal');
    await window.locator('[data-window-action="close"]').click();
    await window.waitFor({ state: 'detached' });
});
