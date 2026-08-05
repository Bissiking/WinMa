const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { createAccountService, DEFAULT_ACCOUNT } = require('../../src/server/services/account-service');

const temporaryDirectories = [];

async function createService() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-account-test-'));
    temporaryDirectories.push(directory);
    return createAccountService(directory);
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

test('un compte absent retourne des préférences Luma sûres', async () => {
    const service = await createService();
    assert.deepEqual(await service.read('usr_one'), DEFAULT_ACCOUNT);
});

test('les préférences de compte sont isolées par sujet Kyros', async () => {
    const service = await createService();
    await service.update('usr_one', { preferredName: 'Mathéo', syncAppearance: false });

    assert.equal((await service.read('usr_one')).preferredName, 'Mathéo');
    assert.equal((await service.read('usr_one')).syncAppearance, false);
    assert.deepEqual(await service.read('usr_two'), DEFAULT_ACCOUNT);
});

test('un fuseau ou un champ inconnu est refusé', async () => {
    const service = await createService();
    await assert.rejects(service.update('usr_one', { timeZone: 'Mars/Olympus' }), (error) => error.code === 'ACCOUNT_TIMEZONE_INVALID');
    await assert.rejects(service.update('usr_one', { kyrosRole: 'admin' }), (error) => error.code === 'ACCOUNT_INVALID');
});
