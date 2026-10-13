// tests/integration/session-persistence.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig();
const fake = createFakeKyros(config);
let secondServer;
let secondBaseUrl;
let authenticatedCookie;

before(async () => {
    const first = await startTestServer(createApp({ config, fetchImplementation: fake.fetchImplementation }));
    const { cookie } = await loginAs(first.baseUrl, fake, { extractCookie });
    authenticatedCookie = cookie;

    const settingsResponse = await fetch(`${first.baseUrl}/api/users/me/settings`, {
        method: 'PATCH',
        headers: { cookie: authenticatedCookie, 'content-type': 'application/json', origin: config.appBaseUrl },
        body: JSON.stringify({ theme: 'dark' })
    });
    assert.equal(settingsResponse.status, 200);

    await stopTestServer(first.server);
});

after(async () => {
    if (secondServer) await stopTestServer(secondServer);
});

test('la session survit à un redémarrage du serveur', async () => {
    const second = await startTestServer(createApp({ config, fetchImplementation: fake.fetchImplementation }));
    secondBaseUrl = second.baseUrl;
    secondServer = second.server;

    const sessionResponse = await fetch(`${secondBaseUrl}/api/session`, {
        headers: { cookie: authenticatedCookie }
    });
    const payload = await sessionResponse.json();

    assert.equal(sessionResponse.status, 200);
    assert.equal(payload.data.authenticated, true);
    assert.equal(payload.data.user.username, 'matheo');
});

test('le réglage écrit avant le redémarrage est conservé', async () => {
    const settingsResponse = await fetch(`${secondBaseUrl}/api/users/me/settings`, {
        headers: { cookie: authenticatedCookie }
    });
    const payload = await settingsResponse.json();

    assert.equal(settingsResponse.status, 200);
    assert.equal(payload.data.theme, 'dark');
});
