const assert = require('node:assert/strict');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createSqlitePreferencesRepository } = require('../../src/server/repositories/sqlite-preferences-repository');
const { createAccountService, DEFAULT_ACCOUNT } = require('../../src/server/services/account-service');

const testContexts = [];

async function createService() {
    const context = await createSqliteTestDatabase('luma-account-test-');
    testContexts.push(context);
    const repository = createSqlitePreferencesRepository(context.database, 'account_preferences');
    return createAccountService({
        repository,
        legacyDirectory: path.join(context.directory, 'accounts')
    });
}

afterEach(async () => {
    for (const context of testContexts.splice(0)) {
        await context.cleanup();
    }
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

test('le pull Kyros initialise le snapshot sans écraser les préférences locales', async () => {
    const service = await createService();
    await service.update('usr_one', { preferredName: 'Nom local' });

    const account = await service.applyKyrosProfile('usr_one', { display_name: 'Kyros Name', locale: 'fr-FR', timezone: 'Europe/Paris' });

    assert.equal(account.preferredName, 'Nom local');
    assert.deepEqual(account.lastProfileSync, { displayName: 'Kyros Name', locale: 'fr-FR', timezone: 'Europe/Paris' });
});

test('le pull Kyros applique un changement de profil depuis le dernier synchronisme', async () => {
    const service = await createService();
    await service.applyKyrosProfile('usr_one', { display_name: 'Avant', locale: 'fr-FR', timezone: 'Europe/Paris' });

    const account = await service.applyKyrosProfile('usr_one', {
        display_name: 'Après',
        locale: 'en-US',
        timezone: 'America/New_York'
    });

    assert.equal(account.preferredName, 'Après');
    assert.equal(account.language, 'en-US');
    assert.equal(account.timeZone, 'America/New_York');
    assert.deepEqual(account.lastProfileSync, { displayName: 'Après', locale: 'en-US', timezone: 'America/New_York' });
});

test('le pull Kyros ignore les locales inconnues et ne boucle pas sans changement', async () => {
    const service = await createService();
    await service.applyKyrosProfile('usr_one', { display_name: 'Stable', locale: 'fr-FR', timezone: 'Europe/Paris' });

    const unchanged = await service.applyKyrosProfile('usr_one', { display_name: 'Stable', locale: 'fr-FR', timezone: 'Europe/Paris' });
    assert.equal(unchanged.preferredName, '');

    const weird = await service.applyKyrosProfile('usr_one', { display_name: 'Stable', locale: 'xx-INVALID', timezone: 'Europe/Paris' });
    assert.equal(weird.language, 'fr-FR');
    assert.equal(weird.lastProfileSync.locale, 'xx-INVALID');
});

test('le pull Kyros ne s\'applique jamais si syncProfile est désactivé', async () => {
    const service = await createService();
    await service.update('usr_one', { syncProfile: false });

    const account = await service.applyKyrosProfile('usr_one', { display_name: 'Ignored', locale: 'en-US', timezone: 'America/New_York' });

    assert.equal(account.preferredName, '');
    assert.equal(account.lastProfileSync, null);
});
