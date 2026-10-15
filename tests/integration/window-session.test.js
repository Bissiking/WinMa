const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig();
const fake = createFakeKyros(config);
let baseUrl;
let server;

before(async () => {
    const started = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

async function authenticate() {
    const { cookie } = await loginAs(baseUrl, fake, { extractCookie });
    return cookie;
}

test('une session anonyme ne peut pas accéder aux fenêtres', async () => {
    const response = await fetch(`${baseUrl}/api/users/me/windows`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.code, 'SESSION_REQUIRED');
});

test('la sauvegarde des fenêtres est persistée et relue par utilisateur', async () => {
    const cookie = await authenticate();
    const windows = [{ appId: 'terminal', state: 'maximized', bounds: { left: 20, top: 30, width: 900, height: 600 } }];

    const putResponse = await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'PUT',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ windows })
    });
    const putPayload = await putResponse.json();

    assert.equal(putResponse.status, 200);
    assert.equal(putPayload.data.windows[0].appId, 'terminal');
    assert.ok(putPayload.data.updatedAt);

    const getResponse = await fetch(`${baseUrl}/api/users/me/windows`, { headers: { cookie } });
    const getPayload = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(getPayload.data.windows.length, 1);
    assert.equal(getPayload.data.windows[0].state, 'maximized');
});

test('une origine étrangère ne peut pas enregistrer de session', async () => {
    const cookie = await authenticate();
    const response = await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'PUT',
        headers: { cookie, origin: 'https://attacker.example', 'content-type': 'application/json' },
        body: JSON.stringify({ windows: [] })
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.code, 'ORIGIN_REJECTED');
});

test('la suppression efface la session enregistrée', async () => {
    const cookie = await authenticate();
    await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'PUT',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ windows: [{ appId: 'calendar' }] })
    });

    const deleteResponse = await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'DELETE',
        headers: { cookie, origin: config.appBaseUrl }
    });
    assert.equal(deleteResponse.status, 200);

    const getResponse = await fetch(`${baseUrl}/api/users/me/windows`, { headers: { cookie } });
    const getPayload = await getResponse.json();
    assert.equal(getPayload.data.windows.length, 0);
});

test('une payload invalide est refusée proprement', async () => {
    const cookie = await authenticate();
    const response = await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'PUT',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ windows: 'not-an-array' })
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, 'SESSION_WINDOWS_INVALID');
});
