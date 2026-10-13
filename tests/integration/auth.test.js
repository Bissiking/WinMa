// tests/integration/auth.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ sonoraStudio: { baseUrl: 'https://sonora.test', timeoutMs: 1000 } });
const fake = createFakeKyros(config);
let baseUrl;
let server;
let sonoraCalls;

async function combinedFetch(url, options) {
    if (url.startsWith('https://sonora.test')) {
        sonoraCalls.push({ url, authorization: new Headers(options.headers).get('authorization') });
        return Response.json({ items: [{ id: 'track-1', title: 'Lueur' }] });
    }
    return fake.fetchImplementation(url, options);
}

function tokenCalls() {
    return fake.calls.filter((call) => call.url.endsWith('/token'));
}

async function authenticate() {
    return loginAs(baseUrl, fake, { extractCookie });
}

before(async () => {
    sonoraCalls = [];
    const started = await startTestServer(createApp({ config, fetchImplementation: combinedFetch }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
});

test('le login pousse un PAR SSOv4 puis redirige vers authorize avec request_uri', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const location = new URL(response.headers.get('location'));

    assert.equal(response.status, 302);
    assert.equal(location.origin, 'https://kyros.test');
    assert.equal(location.pathname, '/authorize');
    assert.equal(location.searchParams.get('client_id'), config.kyros.clientId);
    assert.ok(location.searchParams.get('request_uri')?.startsWith('urn:ietf:params:oauth:request_uri:'));
    assert.equal(location.searchParams.get('code_challenge'), null);
    assert.equal(location.searchParams.get('state'), null);
    assert.ok(extractCookie(response).startsWith('luma.sid='));

    const par = fake.calls.find((call) => call.url.endsWith('/par'));
    assert.ok(par, 'le PAR doit précéder la redirection');
    assert.equal(par.body.kyros_sso_version, 'v4');
    assert.equal(par.body.kyros_edition, config.kyros.edition);
    assert.equal(par.body.kyros_application_scope, config.kyros.applicationScope);
    assert.equal(par.body.redirect_uri, config.kyros.callbackUrl);
    assert.equal(par.body.scope, 'profile email');
    assert.ok(par.body.state);
    assert.match(par.body.code_challenge, /^[A-Za-z0-9_-]{43,128}$/);
    assert.equal(par.body.code_challenge_method, 'S256');
});

test('le callback rejette un state différent sans contacter Kyros', async () => {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const cookie = extractCookie(loginResponse);
    const previousTokenCalls = tokenCalls().length;
    const response = await fetch(`${baseUrl}/auth/callback?code=test-code&state=wrong&iss=${encodeURIComponent(config.kyros.issuer)}`, {
        headers: { cookie },
        redirect: 'manual'
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.code, 'KYROS_STATE_INVALID');
    assert.equal(tokenCalls().length, previousTokenCalls);
});

test('le callback rejette un issuer absent ou différent', async () => {
    const previousTokenCalls = tokenCalls().length;

    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const loginCookie = extractCookie(loginResponse);
    const missingIssuer = await fake.completeAuthorization();
    const deniedWithoutIssuer = await fetch(
        `${baseUrl}/auth/callback?code=${encodeURIComponent(missingIssuer.code)}&state=${encodeURIComponent(missingIssuer.state)}`,
        { headers: { cookie: loginCookie }, redirect: 'manual' }
    );
    assert.equal(deniedWithoutIssuer.status, 400);
    assert.equal((await deniedWithoutIssuer.json()).code, 'KYROS_ISSUER_INVALID');

    const loginAgain = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const wrongIssuer = await fake.completeAuthorization();
    const deniedWithWrongIssuer = await fetch(
        `${baseUrl}/auth/callback?code=${encodeURIComponent(wrongIssuer.code)}&state=${encodeURIComponent(wrongIssuer.state)}&iss=another-issuer`,
        { headers: { cookie: extractCookie(loginAgain) }, redirect: 'manual' }
    );
    assert.equal(deniedWithWrongIssuer.status, 400);
    assert.equal((await deniedWithWrongIssuer.json()).code, 'KYROS_ISSUER_INVALID');
    assert.equal(tokenCalls().length, previousTokenCalls);
});

test('le callback échange le code avec PKCE et expose seulement le profil minimal', async () => {
    const { callbackResponse, cookie } = await authenticate();
    const sessionResponse = await fetch(`${baseUrl}/api/session`, {
        headers: { cookie }
    });
    const sessionPayload = await sessionResponse.json();

    assert.equal(callbackResponse.status, 303);
    assert.equal(sessionPayload.data.authenticated, true);
    assert.deepEqual(sessionPayload.data.user, {
        id: 'usr_luma',
        username: 'matheo',
        displayName: 'Matheo',
        avatar: 'default',
        avatarUrl: null
    });
    assert.equal(JSON.stringify(sessionPayload).includes('token'), false);

    const exchange = tokenCalls().find((call) => call.body.grant_type === 'authorization_code');
    assert.ok(exchange, 'le code doit avoir été échangé');
    assert.equal(exchange.body.client_secret, config.kyros.clientSecret);
    assert.equal(exchange.body.redirect_uri, config.kyros.callbackUrl);
    assert.equal(exchange.body.kyros_sso_version, 'v4');
    assert.match(exchange.body.code_verifier, /^[A-Za-z0-9._~-]{43,128}$/);

    const par = [...fake.calls].reverse().find((call) => call.url.endsWith('/par'));
    const expectedChallenge = require('node:crypto').createHash('sha256').update(exchange.body.code_verifier).digest('base64url');
    assert.equal(par.body.code_challenge, expectedChallenge);
});

test('la déconnexion révoque le refresh token et détruit la session', async () => {
    const { cookie } = await authenticate();
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { cookie, origin: config.appBaseUrl }
    });
    const sessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
    const sessionPayload = await sessionResponse.json();

    assert.equal(logoutResponse.status, 200);
    assert.equal(sessionPayload.data.authenticated, false);
    assert.ok(fake.calls.some((call) => call.url.endsWith('/revoke')));
});

test('Sonora reçoit le token Kyros utilisateur conservé dans la session serveur', async () => {
    const { cookie } = await authenticate();
    const response = await fetch(`${baseUrl}/api/sonora-studio/tracks`, {
        headers: { cookie }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.items[0].title, 'Lueur');
    assert.equal(sonoraCalls.length, 1);
    assert.match(sonoraCalls[0].authorization, /^Bearer ey/);
    assert.equal(JSON.stringify(payload).includes(sonoraCalls[0].authorization), false);
});

test("l'avatar Kyros est servi via le proxy avec mise en cache privée", async () => {
    fake.serveAvatar('https://kyros.test/avatars/matheo.jpg', {
        contentType: 'image/jpeg',
        body: Buffer.from('jpeg-bytes')
    });
    fake.setTokenClaims({ picture: '/avatars/matheo.jpg' });

    const { cookie } = await authenticate();
    const response = await fetch(`${baseUrl}/api/users/me/avatar`, { headers: { cookie } });
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(body.toString(), 'jpeg-bytes');

    fake.setTokenClaims(null);
});

test("un compte sans avatar reçoit un 404 sur le proxy", async () => {
    fake.setTokenClaims({ picture: null });

    const { cookie } = await authenticate();
    const response = await fetch(`${baseUrl}/api/users/me/avatar`, { headers: { cookie } });

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, 'AVATAR_NOT_FOUND');

    fake.setTokenClaims(null);
});
