// tests/integration/postgres.test.js
// Application complète branchée sur PostgreSQL (DB_PROVIDER=postgresql).
// Non exécutée (signalée comme skip) sans TEST_DATABASE_URL : jamais de repli
// silencieux sur SQLite dans ces tests.
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');
const { createPostgresTestDatabase, postgresSkipReason } = require('../helpers/db');

const config = createTestConfig({
    database: {
        provider: 'postgresql',
        postgres: { connectionString: process.env.TEST_DATABASE_URL || null },
        migrationsDir: path.resolve(__dirname, '../../migrations')
    }
});
const fake = createFakeKyros(config);

let unavailable = null;
let context = null;
let baseUrl = null;
let server = null;
let cookie = null;

before(async () => {
    try {
        context = await createPostgresTestDatabase();
        if (!context) {
            unavailable = postgresSkipReason();
            return;
        }
        const app = await createApp({
            config,
            fetchImplementation: fake.fetchImplementation,
            database: context.database
        });
        const started = await startTestServer(app);
        baseUrl = started.baseUrl;
        server = started.server;
        ({ cookie } = await loginAs(baseUrl, fake, { extractCookie }));
    } catch (error) {
        unavailable = error.message;
        if (context) {
            await context.cleanup();
            context = null;
        }
    }
});

after(async () => {
    if (server) await stopTestServer(server);
    await context?.cleanup();
});

function skipIfUnavailable(t) {
    if (unavailable) {
        t.skip(unavailable);
        return true;
    }
    return false;
}

test('la session Kyros persistée en PostgreSQL est relue', async (t) => {
    if (skipIfUnavailable(t)) return;

    const response = await fetch(`${baseUrl}/api/session`, { headers: { cookie } });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.authenticated, true);
    assert.equal(payload.data.user.username, 'matheo');
});

test('les paramètres d\u2019apparence survivent à une nouvelle requête', async (t) => {
    if (skipIfUnavailable(t)) return;

    const patchResponse = await fetch(`${baseUrl}/api/users/me/settings`, {
        method: 'PATCH',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'dark', accentColor: '#112233' })
    });
    assert.equal(patchResponse.status, 200);

    const readResponse = await fetch(`${baseUrl}/api/users/me/settings`, { headers: { cookie } });
    const payload = await readResponse.json();

    assert.equal(readResponse.status, 200);
    assert.equal(payload.data.theme, 'dark');
    assert.equal(payload.data.accentColor, '#112233');
});

test('les fenêtres de l\u2019utilisateur sont persistées en base PostgreSQL', async (t) => {
    if (skipIfUnavailable(t)) return;

    const putResponse = await fetch(`${baseUrl}/api/users/me/windows`, {
        method: 'PUT',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ windows: [{ appId: 'terminal', state: 'maximized' }] })
    });
    assert.equal(putResponse.status, 200);

    const getResponse = await fetch(`${baseUrl}/api/users/me/windows`, { headers: { cookie } });
    const payload = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(payload.data.windows.length, 1);
    assert.equal(payload.data.windows[0].appId, 'terminal');
});

test('les documents créent leur métadonnée en PostgreSQL et le quota répond', async (t) => {
    if (skipIfUnavailable(t)) return;

    const folderResponse = await fetch(`${baseUrl}/api/documents/folders`, {
        method: 'POST',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Prod' })
    });
    const folderPayload = await folderResponse.json();
    assert.equal(folderResponse.status, 201);
    assert.equal(folderPayload.data.name, 'Prod');

    const statsResponse = await fetch(`${baseUrl}/api/documents/stats`, { headers: { cookie } });
    const statsPayload = await statsResponse.json();

    assert.equal(statsResponse.status, 200);
    assert.equal(statsPayload.data.storage.quotaBytes, 1024 * 1024 * 1024);
    assert.deepEqual(statsPayload.data.categories, []);
});

test('les préférences de compte sont persistées en PostgreSQL', async (t) => {
    if (skipIfUnavailable(t)) return;

    const patchResponse = await fetch(`${baseUrl}/api/users/me/account`, {
        method: 'PATCH',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({ preferredName: 'Matheo PG', language: 'en-US' })
    });
    assert.equal(patchResponse.status, 200);

    const readResponse = await fetch(`${baseUrl}/api/users/me/account`, { headers: { cookie } });
    const payload = await readResponse.json();

    assert.equal(readResponse.status, 200);
    assert.equal(payload.data.preferences.preferredName, 'Matheo PG');
    assert.equal(payload.data.preferences.language, 'en-US');
});

test('les tables PostgreSQL alimentées sont bien renseignées', async (t) => {
    if (skipIfUnavailable(t)) return;

    const counts = {};
    for (const table of ['auth_sessions', 'window_sessions', 'user_settings', 'account_preferences', 'document_items']) {
        const result = await context.database.query(`SELECT COUNT(*) AS "count" FROM ${table}`);
        counts[table] = result.rows[0].count;
    }

    assert.ok(counts.auth_sessions >= 1);
    assert.equal(counts.window_sessions, 1);
    assert.ok(counts.user_settings >= 1);
    assert.ok(counts.account_preferences >= 1);
    assert.ok(counts.document_items >= 1);
});
