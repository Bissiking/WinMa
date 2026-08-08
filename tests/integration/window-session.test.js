const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig();
let baseUrl;
let server;

function createToken(overrides = {}) {
    return jwt.sign(
        {
            sub: 'usr_luma',
            username: 'matheo',
            display_name: 'Matheo',
            resource_aud: config.kyros.resourceAudience,
            client_id: config.kyros.clientId,
            scope: 'profile email',
            ...overrides
        },
        config.kyros.jwtSecret,
        {
            algorithm: 'HS256',
            issuer: config.kyros.issuer,
            audience: config.kyros.audience,
            expiresIn: '15m'
        }
    );
}

async function fakeKyrosFetch(url, options) {
    return new Response(JSON.stringify({
        access_token: createToken(),
        refresh_token: 'refresh-token-next',
        refresh_token_expires_at: '2099-01-01T00:00:00.000Z',
        user: {
            id: 'usr_luma',
            username: 'matheo',
            email: 'not-exposed@example.test',
            displayName: 'Matheo',
            role: 'admin'
        }
    }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
}

before(async () => {
    const started = await startTestServer(createApp({ config, fetchImplementation: fakeKyrosFetch }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

async function authenticate() {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const authorizeUrl = new URL(loginResponse.headers.get('location'));
    const callbackResponse = await fetch(
        `${baseUrl}/auth/callback?code=valid-code&state=${encodeURIComponent(authorizeUrl.searchParams.get('state'))}`,
        { headers: { cookie: extractCookie(loginResponse) }, redirect: 'manual' }
    );
    return extractCookie(callbackResponse);
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
