// tests/integration/workspaces.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ appBaseUrl: 'http://127.0.0.1:3997' });
const fake = createFakeKyros(config);
let server;
let baseUrl;
let cookie;

const jsonHeaders = () => ({ cookie, origin: config.appBaseUrl, accept: 'application/json', 'content-type': 'application/json' });

async function api(pathname, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
        method,
        headers: { cookie, accept: 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, payload: await response.json().catch(() => ({})) };
}

function sampleWindows(name) {
    return [{ id: `win-${name}`, appId: 'notepad', name: `Bloc-notes ${name}`, state: 'normal', bounds: { left: 40, top: 40, width: 700, height: 500 } }];
}

before(async () => {
    ({ server, baseUrl } = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation })));
    ({ cookie } = await loginAs(baseUrl, fake, { extractCookie }));
});

after(async () => {
    if (server) await stopTestServer(server);
});

test('les endpoints d’espaces refusent les requêtes sans session', async () => {
    for (const [method, pathname] of [
        ['GET', '/api/users/me/workspaces'],
        ['POST', '/api/users/me/workspaces']
    ]) {
        const response = await fetch(`${baseUrl}${pathname}`, { method });
        assert.equal(response.status, 401, `${method} ${pathname}`);
    }
});

test('le cycle de vie d’un espace passe par l’API', async () => {
    await api('/api/users/me/windows', { method: 'PUT', headers: jsonHeaders(), body: { windows: sampleWindows('A') } });

    const created = await api('/api/users/me/workspaces', { method: 'POST', headers: jsonHeaders(), body: { name: 'Développement' } });
    assert.equal(created.status, 200);
    assert.equal(created.payload.data.name, 'Développement');
    assert.equal(created.payload.data.isActive, true);
    assert.equal(created.payload.data.windowCount, 1);

    const workspaceA = created.payload.data;
    const list = await api('/api/users/me/workspaces');
    assert.equal(list.payload.data.activeId, workspaceA.id);
    assert.equal(list.payload.data.workspaces.length, 1);

    const renamed = await api(`/api/users/me/workspaces/${workspaceA.id}`, { method: 'PATCH', headers: jsonHeaders(), body: { name: 'Bureau perso' } });
    assert.equal(renamed.payload.data.name, 'Bureau perso');

    // Deuxième espace avec une autre disposition, puis bascule A ⇄ B.
    const second = await api('/api/users/me/workspaces', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { name: 'Administration', windows: sampleWindows('B') }
    });
    assert.equal(second.payload.data.windowCount, 1);
    const workspaceB = second.payload.data;

    const activated = await api(`/api/users/me/workspaces/${workspaceA.id}/activate`, { method: 'POST', headers: jsonHeaders(), body: {} });
    assert.equal(activated.payload.data.layoutApplied, true);
    const windows = await api('/api/users/me/windows');
    assert.equal(windows.payload.data.windows[0].name, 'Bloc-notes A', 'la disposition de l’espace appliqué devient la session courante');

    const saved = await api(`/api/users/me/workspaces/${workspaceA.id}`, { method: 'PUT', headers: jsonHeaders(), body: {} });
    assert.equal(saved.status, 200);

    const removed = await api(`/api/users/me/workspaces/${workspaceB.id}`, { method: 'DELETE', headers: jsonHeaders() });
    assert.equal(removed.payload.data.removed, true);
    const afterDelete = await api('/api/users/me/workspaces');
    assert.equal(afterDelete.payload.data.workspaces.length, 1);
});

test('l’API refuse les entrées invalides et le cross-origin', async () => {
    const invalidName = await api('/api/users/me/workspaces', { method: 'POST', headers: jsonHeaders(), body: { name: '   ' } });
    assert.equal(invalidName.status, 400);
    assert.equal(invalidName.payload.code, 'WORKSPACE_INVALID_NAME');

    const invalidId = await api('/api/users/me/workspaces/not-a-uuid/activate', { method: 'POST', headers: jsonHeaders(), body: {} });
    assert.equal(invalidId.status, 400);
    assert.equal(invalidId.payload.code, 'WORKSPACE_ID_INVALID');

    const csrf = await fetch(`${baseUrl}/api/users/me/workspaces`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', origin: 'https://attacker.example' },
        body: JSON.stringify({ name: 'Hack' })
    });
    assert.equal(csrf.status, 403);
});
