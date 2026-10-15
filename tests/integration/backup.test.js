// tests/integration/backup.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ appBaseUrl: 'http://127.0.0.1:3999' });
const fake = createFakeKyros(config);
let server;
let baseUrl;
let cookie;
let notesFolderId;

const jsonHeaders = () => ({ cookie, origin: config.appBaseUrl, accept: 'application/json', 'content-type': 'application/json' });

async function api(pathname, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: { cookie, accept: 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, payload: await response.json().catch(() => ({})) };
}

before(async () => {
    ({ server, baseUrl } = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation })));
    ({ cookie } = await loginAs(baseUrl, fake, { extractCookie }));
});

after(async () => {
    if (server) await stopTestServer(server);
});

test('les endpoints de sauvegarde refusent les requêtes sans session', async () => {
    for (const [method, pathname] of [['GET', '/api/users/me/backup'], ['POST', '/api/users/me/backup'], ['POST', '/api/users/me/backup/reset']]) {
        const response = await fetch(`${baseUrl}${pathname}`, { method });
        assert.equal(response.status, 401, `${method} ${pathname}`);
    }
});

test('GET /api/users/me/backup agrège paramètres, compte, fenêtres et notes', async () => {
    await api('/api/users/me/settings', { method: 'PATCH', headers: jsonHeaders(), body: { theme: 'dark' } });
    await api('/api/users/me/account', { method: 'PATCH', headers: jsonHeaders(), body: { preferredName: 'Matheo' } });
    await api('/api/users/me/windows', {
        method: 'PUT',
        headers: jsonHeaders(),
        body: { windows: [{ id: 'w1', appId: 'notepad', name: 'Bloc-notes', state: 'normal' }] }
    });
    const folder = await api('/api/documents/folders', { method: 'POST', headers: jsonHeaders(), body: { name: 'Notes de travail' } });
    notesFolderId = folder.payload.data.id;
    await api('/api/documents/text', { method: 'POST', headers: jsonHeaders(), body: { name: 'brouillon.md', parentId: notesFolderId, content: '# Brouillon' } });
    await api('/api/documents/text', { method: 'POST', headers: jsonHeaders(), body: { name: 'racine.txt', content: 'Au sol' } });

    const { status, payload } = await api('/api/users/me/backup');
    assert.equal(status, 200);
    assert.equal(payload.data.format, 'luma-backup');
    assert.equal(payload.data.schemaVersion, 1);
    assert.ok(payload.data.exportedAt);
    assert.equal(payload.data.server.settings.theme, 'dark');
    assert.equal(payload.data.server.account.preferredName, 'Matheo');
    assert.ok(!('lastProfileSync' in payload.data.server.account), 'le snapshot interne Kyros n’est pas exporté');
    assert.equal(payload.data.server.windows.length, 1);
    assert.equal(payload.data.server.windows[0].appId, 'notepad');

    const paths = payload.data.server.notes.map((note) => note.path).sort();
    assert.deepEqual(paths, ['Notes de travail/brouillon.md', 'racine.txt']);
    assert.equal(payload.data.server.notes.find((note) => note.path === 'racine.txt').content, 'Au sol');
});

test('POST /api/users/me/backup restaure les données sans supprimer l’existant', async () => {
    const exported = (await api('/api/users/me/backup')).payload.data;

    // On casse l'état : paramètres modifiés, note de racine éditée.
    await api('/api/users/me/settings', { method: 'PATCH', headers: jsonHeaders(), body: { theme: 'light', density: 'compact' } });
    const rootNote = (await api('/api/documents?parentId=')).payload.data.items.find((item) => item.name === 'racine.txt');
    await api(`/api/documents/${rootNote.id}/content`, { method: 'PUT', headers: jsonHeaders(), body: { content: 'Cassé' } });

    const { status, payload } = await api('/api/users/me/backup', {
        method: 'POST',
        headers: jsonHeaders(),
        body: {
            ...exported,
            server: {
                ...exported.server,
                settings: { ...exported.server.settings, accentColor: '#20a9ca' },
                notes: [...exported.server.notes, { path: 'Notes de travail/nouvelle.md', content: 'Nouvelle note' }]
            }
        }
    });

    assert.equal(status, 200);
    assert.equal(payload.data.settings, true);
    assert.equal(payload.data.account, true);
    assert.equal(payload.data.windows, true);
    assert.equal(payload.data.notes.created, 1);
    assert.equal(payload.data.notes.updated, 2);

    const settings = (await api('/api/users/me/settings')).payload.data;
    assert.equal(settings.theme, 'dark', 'les paramètres exportés sont restaurés');
    assert.equal(settings.accentColor, '#20a9ca', 'les valeurs modifiées dans le fichier sont appliquées');
    assert.equal(settings.density, 'comfortable', 'les champs absents du fichier reviennent aux défauts');

    const restored = (await api('/api/documents?parentId=')).payload.data.items.find((item) => item.name === 'racine.txt');
    const content = (await api(`/api/documents/${restored.id}/content`)).payload.data;
    assert.equal(content.content, 'Au sol', 'la note de racine est restaurée');

    const folderItems = (await api(`/api/documents?parentId=${notesFolderId}`)).payload.data.items;
    assert.ok(folderItems.some((item) => item.name === 'nouvelle.md'), 'la note supplémentaire est créée dans son dossier');
});

test('POST /api/users/me/backup refuse les fichiers invalides', async () => {
    const invalidFormat = await api('/api/users/me/backup', { method: 'POST', headers: jsonHeaders(), body: { format: 'autre', schemaVersion: 1 } });
    assert.equal(invalidFormat.status, 400);
    assert.equal(invalidFormat.payload.code, 'BACKUP_INVALID');

    const invalidVersion = await api('/api/users/me/backup', { method: 'POST', headers: jsonHeaders(), body: { format: 'luma-backup', schemaVersion: 999, server: {} } });
    assert.equal(invalidVersion.status, 400);
    assert.equal(invalidVersion.payload.code, 'BACKUP_VERSION_UNSUPPORTED');

    const invalidNote = await api('/api/users/me/backup', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { format: 'luma-backup', schemaVersion: 1, server: { notes: [{ path: '../evil.md', content: 'x' }] } }
    });
    assert.equal(invalidNote.status, 400);
    assert.equal(invalidNote.payload.code, 'BACKUP_NOTE_PATH_INVALID');

    const csrf = await fetch(`${baseUrl}/api/users/me/backup`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', origin: 'https://attacker.example' },
        body: JSON.stringify({ format: 'luma-backup', schemaVersion: 1, server: {} })
    });
    assert.equal(csrf.status, 403);
});

test('POST /api/users/me/backup/reset réinitialise les catégories choisies', async () => {
    const invalid = await api('/api/users/me/backup/reset', { method: 'POST', headers: jsonHeaders(), body: { targets: ['inconnu'] } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.payload.code, 'BACKUP_RESET_TARGET_INVALID');

    const { status, payload } = await api('/api/users/me/backup/reset', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { targets: ['settings', 'windows', 'notes'] }
    });
    assert.equal(status, 200);
    assert.equal(payload.data.settings, true);
    assert.equal(payload.data.windows, true);
    assert.equal(payload.data.notes.deleted >= 2, true);

    const settings = (await api('/api/users/me/settings')).payload.data;
    assert.equal(settings.theme, 'luma', 'les paramètres reviennent aux défauts');
    const windows = (await api('/api/users/me/windows')).payload.data;
    assert.deepEqual(windows.windows, [], 'la disposition est vidée');
    const documents = (await api('/api/documents')).payload.data.items;
    assert.ok(!documents.some((item) => /\.(?:md|txt)$/i.test(item.name)), 'les notes de racine sont supprimées');
});
