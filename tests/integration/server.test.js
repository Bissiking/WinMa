// tests/integration/server.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { startTestServer, stopTestServer } = require('../helpers/test-server');

let baseUrl;
let server;

before(async () => {
    const config = createTestConfig({ kyros: { enabled: false } });
    const started = await startTestServer(createApp({ config }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

test('le serveur expose sa santé avec les en-têtes de sécurité', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.status, 'ok');
    assert.equal(payload.data.version, '3.0.0-alpha.1');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('x-request-id'));
});

test('la session anonyme ne contient aucun profil', async () => {
    const response = await fetch(`${baseUrl}/api/session`);
    const payload = await response.json();

    assert.deepEqual(payload.data, {
        authenticated: false,
        user: null,
        authentication: { provider: 'kyros', available: false }
    });
});

test('le login explique que Kyros est incomplet', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.code, 'KYROS_NOT_CONFIGURED');
});

test('une origine étrangère ne peut pas déclencher la déconnexion', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { origin: 'https://attacker.example' }
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.code, 'ORIGIN_REJECTED');
});

test('une route inconnue utilise une enveloppe cohérente', async () => {
    const response = await fetch(`${baseUrl}/api/unknown`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(payload, {
        success: false,
        data: null,
        message: 'Ressource introuvable.',
        code: 'NOT_FOUND'
    });
});
