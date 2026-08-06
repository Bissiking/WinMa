// tests/integration/auth.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ sonoraStudio: { baseUrl: 'https://sonora.test', timeoutMs: 1000 } });
let baseUrl;
let server;
let providerCalls;
let sonoraCalls;

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
    if (url.startsWith('https://sonora.test')) {
        sonoraCalls.push({ url, authorization: new Headers(options.headers).get('authorization') });
        return Response.json({ items: [{ id: 'track-1', title: 'Lueur' }] });
    }
    providerCalls.push({ url, body: JSON.parse(options.body) });

    if (url.endsWith('/revoke')) {
        return new Response(JSON.stringify({ revoked: true }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
        });
    }

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
    providerCalls = [];
    sonoraCalls = [];
    const started = await startTestServer(createApp({ config, fetchImplementation: fakeKyrosFetch }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

test('le login redirige vers Kyros avec callback, scopes et state', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const location = new URL(response.headers.get('location'));

    assert.equal(response.status, 302);
    assert.equal(location.origin, 'https://kyros.test');
    assert.equal(location.pathname, '/authorize');
    assert.equal(location.searchParams.get('client_id'), config.kyros.clientId);
    assert.equal(location.searchParams.get('redirect_uri'), config.kyros.callbackUrl);
    assert.equal(location.searchParams.get('scope'), 'profile email');
    assert.ok(location.searchParams.get('state'));
    assert.ok(extractCookie(response).startsWith('luma.sid='));
});

test('le callback rejette un state différent sans contacter Kyros', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const cookie = extractCookie(loginResponse);
    const previousCallCount = providerCalls.length;
    const response = await fetch(`${baseUrl}/auth/callback?code=test-code&state=wrong`, {
        headers: { cookie },
        redirect: 'manual'
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, 'KYROS_STATE_INVALID');
    assert.equal(providerCalls.length, previousCallCount);
});

test('le callback échange le code et expose seulement le profil minimal', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const loginCookie = extractCookie(loginResponse);
    const authorizeUrl = new URL(loginResponse.headers.get('location'));
    const state = authorizeUrl.searchParams.get('state');
    const callbackResponse = await fetch(`${baseUrl}/auth/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
        headers: { cookie: loginCookie },
        redirect: 'manual'
    });
    const authenticatedCookie = extractCookie(callbackResponse);
    const sessionResponse = await fetch(`${baseUrl}/api/session`, {
        headers: { cookie: authenticatedCookie }
    });
    const sessionPayload = await sessionResponse.json();

    assert.equal(callbackResponse.status, 303);
    assert.equal(sessionPayload.data.authenticated, true);
    assert.deepEqual(sessionPayload.data.user, {
        id: 'usr_luma',
        username: 'matheo',
        displayName: 'Matheo',
        avatar: 'default'
    });
    assert.equal(JSON.stringify(sessionPayload).includes('token'), false);

    const exchange = providerCalls.find((call) => call.body.grant_type === 'authorization_code');
    assert.equal(exchange.body.client_secret, config.kyros.clientSecret);
    assert.equal(exchange.body.redirect_uri, config.kyros.callbackUrl);
});

test('la déconnexion révoque le refresh token et détruit la session', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const authorizeUrl = new URL(loginResponse.headers.get('location'));
    const callbackResponse = await fetch(
        `${baseUrl}/auth/callback?code=valid-code&state=${encodeURIComponent(authorizeUrl.searchParams.get('state'))}`,
        { headers: { cookie: extractCookie(loginResponse) }, redirect: 'manual' }
    );
    const cookie = extractCookie(callbackResponse);
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { cookie, origin: config.appBaseUrl }
    });
    const sessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
    const sessionPayload = await sessionResponse.json();

    assert.equal(logoutResponse.status, 200);
    assert.equal(sessionPayload.data.authenticated, false);
    assert.ok(providerCalls.some((call) => call.url.endsWith('/revoke')));
});

test('Sonora reçoit le token Kyros utilisateur conservé dans la session serveur', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const authorizeUrl = new URL(loginResponse.headers.get('location'));
    const callbackResponse = await fetch(
        `${baseUrl}/auth/callback?code=valid-code&state=${encodeURIComponent(authorizeUrl.searchParams.get('state'))}`,
        { headers: { cookie: extractCookie(loginResponse) }, redirect: 'manual' }
    );
    const response = await fetch(`${baseUrl}/api/sonora-studio/tracks`, {
        headers: { cookie: extractCookie(callbackResponse) }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.items[0].title, 'Lueur');
    assert.equal(sonoraCalls.length, 1);
    assert.match(sonoraCalls[0].authorization, /^Bearer ey/);
    assert.equal(JSON.stringify(payload).includes(sonoraCalls[0].authorization), false);
});
