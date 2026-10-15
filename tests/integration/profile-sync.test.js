const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig();
const fake = createFakeKyros(config);
const pushSubject = `usr_push_${crypto.randomBytes(4).toString('hex')}`;
fake.setTokenClaims({ sub: pushSubject, username: 'matheo' });

let baseUrl;
let server;

before(async () => {
    const started = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => {
    await stopTestServer(server);
    for (const subject of [pushSubject]) {
        const key = crypto.createHash('sha256').update(subject).digest('hex');
        await fs.rm(path.join(__dirname, '../../data/accounts', `${key}.json`), { force: true });
    }
});

async function authenticate() {
    const { cookie } = await loginAs(baseUrl, fake, { extractCookie });
    return cookie;
}

function patchAccount(cookie, body) {
    return fetch(`${baseUrl}/api/users/me/account`, {
        method: 'PATCH',
        headers: { cookie, origin: config.appBaseUrl, 'content-type': 'application/json' },
        body: JSON.stringify(body)
    });
}

function readAccount(cookie) {
    return fetch(`${baseUrl}/api/users/me/account`, { headers: { cookie } });
}

test('PATCH le compte pousse le profil vers Kyros et masque le snapshot', async () => {
    const cookie = await authenticate();
    fake.profileUpdates.length = 0;

    const response = await patchAccount(cookie, {
        preferredName: 'Matheo Push',
        language: 'en-US',
        timeZone: 'America/New_York'
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.profileSyncWarning, null);
    assert.equal(payload.data.preferences.preferredName, 'Matheo Push');
    assert.equal(payload.data.preferences.lastProfileSync, undefined);

    assert.equal(fake.profileUpdates.length, 1);
    assert.deepEqual(fake.profileUpdates[0], {
        displayName: 'Matheo Push',
        locale: 'en-US',
        timezone: 'America/New_York'
    });
});

test('un échec de push Kyros remonte un avertissement sans perdre la sauvegarde locale', async () => {
    const cookie = await authenticate();
    fake.failNextProfileWith(502);

    const response = await patchAccount(cookie, { preferredName: 'Locale Only' });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(payload.data.profileSyncWarning, /injoignable/);

    const getPayload = await (await readAccount(cookie)).json();
    assert.equal(getPayload.data.preferences.preferredName, 'Locale Only');
});

test('désactiver syncProfile coupe le push vers Kyros', async () => {
    const cookie = await authenticate();
    fake.profileUpdates.length = 0;

    const response = await patchAccount(cookie, { syncProfile: false, preferredName: 'Local Seulement' });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.data.profileSyncWarning, null);
    assert.equal(fake.profileUpdates.length, 0);
});

test('le pull applique le profil Kyros au login si le profil a changé', async () => {
    const subject = `usr_pull_${crypto.randomBytes(4).toString('hex')}`;
    fake.setTokenClaims({ sub: subject, username: 'matheo', display_name: 'Avant', locale: 'fr-FR', timezone: 'Europe/Paris' });

    // Premier login : le snapshot est initialisé, les préférences locales restent intactes.
    let cookie = await authenticate();
    let payload = await (await readAccount(cookie)).json();
    assert.equal(payload.data.preferences.preferredName, '');

    // Second login avec un profil Kyros modifié : les préférences locales suivent.
    fake.setTokenClaims({ sub: subject, username: 'matheo', display_name: 'Apres Kyros', locale: 'en-US', timezone: 'America/New_York' });
    cookie = await authenticate();
    payload = await (await readAccount(cookie)).json();

    assert.equal(payload.data.preferences.preferredName, 'Apres Kyros');
    assert.equal(payload.data.preferences.language, 'en-US');
    assert.equal(payload.data.preferences.timeZone, 'America/New_York');

    const key = crypto.createHash('sha256').update(subject).digest('hex');
    await fs.rm(path.join(__dirname, '../../data/accounts', `${key}.json`), { force: true });
    fake.setTokenClaims({ sub: pushSubject, username: 'matheo' });
});
