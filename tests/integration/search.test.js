// tests/integration/search.test.js
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ appBaseUrl: 'http://127.0.0.1:3998' });
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

before(async () => {
    ({ server, baseUrl } = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation })));
    ({ cookie } = await loginAs(baseUrl, fake, { extractCookie }));
});

after(async () => {
    if (server) await stopTestServer(server);
});

test('la recherche Documents exige une session authentifiée', async () => {
    const response = await fetch(`${baseUrl}/api/documents?search=projet`);
    assert.equal(response.status, 401);
});

test('la recherche Documents reste strictement dans le périmètre du sujet', async () => {
    const created = await api('/api/documents/text', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { name: 'Compte-rendu-projecteur.md', content: '# Compte-rendu' }
    });
    assert.equal(created.status, 201, 'création du document de référence');

    const found = await api('/api/documents?search=projecteur');
    assert.equal(found.status, 200);
    assert.ok(found.payload.data.items.some((item) => item.name === 'Compte-rendu-projecteur.md'), 'le sujet A retrouve son document');

    const caseInsensitive = await api('/api/documents?search=PROJECTEUR');
    assert.ok(caseInsensitive.payload.data.items.some((item) => item.name === 'Compte-rendu-projecteur.md'));

    // Un autre sujet Kyros ne doit jamais voir ce document.
    fake.setTokenClaims({ sub: 'usr_autre_sujet' });
    try {
        const other = await loginAs(baseUrl, fake, { extractCookie });
        const response = await fetch(`${baseUrl}/api/documents?search=projecteur`, {
            headers: { cookie: other.cookie, accept: 'application/json' }
        });
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.data.items.length, 0, 'aucun document d’un autre sujet');
    } finally {
        fake.setTokenClaims(null);
    }
});

test('les documents de la Corbeille sont exclus de la recherche', async () => {
    const created = await api('/api/documents/text', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { name: 'Notes-archivées-e2e.md', content: 'archive' }
    });
    assert.equal(created.status, 201);

    const before = await api('/api/documents?search=archivées');
    assert.equal(before.payload.data.items.length, 1, 'présent avant la corbeille');

    const trashed = await api('/api/documents/actions/trash', {
        method: 'POST',
        headers: jsonHeaders(),
        body: { ids: [created.payload.data.id] }
    });
    assert.equal(trashed.status, 200);

    const after = await api('/api/documents?search=archivées');
    assert.equal(after.payload.data.items.length, 0, 'jamais exposé depuis la Corbeille');
});
