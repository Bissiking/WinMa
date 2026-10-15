// tests/integration/apps.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig();
const fake = createFakeKyros(config);
let server;
let baseUrl;
let authenticatedCookie;

before(async () => {
    ({ server, baseUrl } = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation })));
    ({ cookie: authenticatedCookie } = await loginAs(baseUrl, fake, { extractCookie }));
});

after(async () => {
    if (server) await stopTestServer(server);
});

test('GET /api/apps refuse les requêtes sans session', async () => {
    const response = await fetch(`${baseUrl}/api/apps`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.code, 'SESSION_REQUIRED');
});

test('GET /api/apps expose les applications activées avec leurs métadonnées', async () => {
    const response = await fetch(`${baseUrl}/api/apps`, { headers: { cookie: authenticatedCookie } });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    const ids = payload.data.map((app) => app.id);
    assert.ok(ids.includes('documents'));
    assert.ok(ids.includes('settings'));
    assert.ok(ids.includes('trash'));
    assert.equal(ids.includes('sonora-studio'), false, 'les applications désactivées ne sont pas listées');

    const documents = payload.data.find((app) => app.id === 'documents');
    assert.equal(documents.type, 'system');
    assert.equal(documents.enabled, true);
    assert.equal(documents.module, '/apps/documents/app.js');
    assert.equal(documents.entry, '/apps/documents/app.js');
    assert.equal(documents.window.width, 980);
    assert.equal(documents.position.left, 0.28);

    for (const app of payload.data) {
        assert.equal(app.enabled, true);
        assert.ok(!('pinned' in app), 'les champs inconnus ne fuient jamais dans l’API');
    }
});

test('GET /api/apps/:appId valide puis retrouve une application', async () => {
    const found = await fetch(`${baseUrl}/api/apps/documents`, { headers: { cookie: authenticatedCookie } });
    const foundPayload = await found.json();

    assert.equal(found.status, 200);
    assert.equal(foundPayload.data.id, 'documents');

    const missing = await fetch(`${baseUrl}/api/apps/inconnue`, { headers: { cookie: authenticatedCookie } });
    assert.equal(missing.status, 404);

    const invalid = await fetch(`${baseUrl}/api/apps/${encodeURIComponent('../../etc/passwd')}`, { headers: { cookie: authenticatedCookie } });
    assert.equal(invalid.status, 400);
});
