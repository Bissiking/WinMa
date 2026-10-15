// tests/unit/settings.test.js
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createSqlitePreferencesRepository } = require('../../src/server/repositories/sqlite-preferences-repository');
const { createSettingsService, DEFAULT_SETTINGS } = require('../../src/server/services/settings-service');

const testContexts = [];
let currentContext = null;

async function createService() {
    const context = await createSqliteTestDatabase('luma-settings-test-');
    testContexts.push(context);
    currentContext = context;
    const repository = createSqlitePreferencesRepository(context.database, 'user_settings');
    return createSettingsService({
        repository,
        legacyDirectory: path.join(context.directory, 'settings')
    });
}

afterEach(async () => {
    currentContext = null;
    for (const context of testContexts.splice(0)) {
        await context.cleanup();
    }
});

test('les paramètres absents retournent les valeurs par défaut', async () => {
    const service = await createService();
    assert.deepEqual(await service.read('usr_one'), DEFAULT_SETTINGS);
});

test('un patch conserve les champs qui ne sont pas modifiés', async () => {
    const service = await createService();
    await service.update('usr_one', { theme: 'dark' });
    const updated = await service.update('usr_one', { accentColor: '#3366CC' });

    assert.deepEqual(updated, {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        accentColor: '#3366CC'
    });
});

test('les sujets différents restent isolés', async () => {
    const service = await createService();
    await service.update('usr_one', { theme: 'dark' });

    assert.equal((await service.read('usr_one')).theme, 'dark');
    assert.equal((await service.read('usr_two')).theme, 'luma');
});

test('un fond arbitraire est refusé', async () => {
    const service = await createService();

    await assert.rejects(
        service.update('usr_one', { wallpaper: 'https://attacker.example/image.jpg' }),
        (error) => error.code === 'WALLPAPER_INVALID'
    );
});

test('la réouverture au démarrage doit être un booléen', async () => {
    const service = await createService();

    await assert.rejects(
        service.update('usr_one', { restoreSession: 'oui' }),
        (error) => error.code === 'RESTORE_SESSION_INVALID'
    );
    assert.equal((await service.update('usr_one', { restoreSession: false })).restoreSession, false);
});

test('les collections Full HD et 4K peuvent être sélectionnées', async () => {
    const service = await createService();

    assert.equal((await service.update('usr_one', { wallpaper: './images/backgrounds/background-12.jpg' })).wallpaper, './images/backgrounds/background-12.jpg');
    assert.equal((await service.update('usr_one', { wallpaper: './images/backgrounds/4K/background-4k-04.jpg' })).wallpaper, './images/backgrounds/4K/background-4k-04.jpg');
});

test('les options de démarrage sont validées', async () => {
    const service = await createService();

    await assert.rejects(service.update('usr_one', { startupDelayMs: 9999 }), (error) => error.code === 'STARTUP_DELAY_INVALID');
    await assert.rejects(service.update('usr_one', { startupDelayMs: -1 }), (error) => error.code === 'STARTUP_DELAY_INVALID');
    await assert.rejects(service.update('usr_one', { startupMode: 'chaotic' }), (error) => error.code === 'STARTUP_MODE_INVALID');
    await assert.rejects(service.update('usr_one', { startupApps: 'documents' }), (error) => error.code === 'STARTUP_APPS_INVALID');
    await assert.rejects(service.update('usr_one', { startupApps: ['../evil'] }), (error) => error.code === 'STARTUP_APPS_INVALID');
    await assert.rejects(service.update('usr_one', { startupOpenTrash: 'oui' }), (error) => error.code === 'STARTUP_OPTION_INVALID');

    const updated = await service.update('usr_one', {
        startupApps: ['documents', 'settings'],
        startupDelayMs: 250,
        startupMode: 'simultaneous',
        startupOpenTrash: true,
        startupOpenRecents: true,
        startupRestoreFolder: true,
        startupPresentation: true
    });
    assert.deepEqual(updated.startupApps, ['documents', 'settings']);
    assert.equal(updated.startupDelayMs, 250);
    assert.equal(updated.startupMode, 'simultaneous');
    assert.equal(updated.startupOpenTrash, true);
});

test('le délai de verrouillage automatique est validé', async () => {
    const service = await createService();

    assert.equal(DEFAULT_SETTINGS.lockAfterIdleMs, 300000);
    await assert.rejects(service.update('usr_one', { lockAfterIdleMs: 1000 }), (error) => error.code === 'LOCK_AFTER_IDLE_INVALID');
    await assert.rejects(service.update('usr_one', { lockAfterIdleMs: -1 }), (error) => error.code === 'LOCK_AFTER_IDLE_INVALID');
    await assert.rejects(service.update('usr_one', { lockAfterIdleMs: 86400001 }), (error) => error.code === 'LOCK_AFTER_IDLE_INVALID');
    await assert.rejects(service.update('usr_one', { lockAfterIdleMs: '300000' }), (error) => error.code === 'LOCK_AFTER_IDLE_INVALID');

    assert.equal((await service.update('usr_one', { lockAfterIdleMs: 0 })).lockAfterIdleMs, 0);
    assert.equal((await service.update('usr_one', { lockAfterIdleMs: 60000 })).lockAfterIdleMs, 60000);
    assert.equal((await service.update('usr_one', { lockAfterIdleMs: 86400000 })).lockAfterIdleMs, 86400000);
});

test('les profils de démarrage sont validés', async () => {
    const service = await createService();

    await assert.rejects(
        service.update('usr_one', { startupProfiles: { '': { apps: [] } } }),
        (error) => error.code === 'STARTUP_PROFILES_INVALID'
    );
    await assert.rejects(
        service.update('usr_one', { startupProfiles: { Travail: { apps: 'documents' } } }),
        (error) => error.code === 'STARTUP_PROFILES_INVALID'
    );
    await assert.rejects(
        service.update('usr_one', { startupActiveProfile: 42 }),
        (error) => error.code === 'STARTUP_PROFILE_INVALID'
    );

    const updated = await service.update('usr_one', {
        startupProfiles: { Travail: { apps: ['documents'], delayMs: 0, mode: 'simultaneous' } },
        startupActiveProfile: 'Travail'
    });
    assert.deepEqual(updated.startupProfiles.Travail, { apps: ['documents'], delayMs: 0, mode: 'simultaneous' });
    assert.equal(updated.startupActiveProfile, 'Travail');

    await service.update('usr_one', { startupActiveProfile: null });
});

test('les paramètres historiques restent lisibles depuis leur fichier puis remontent en base', async () => {
    const service = await createService();
    const legacyDirectory = path.join(currentContext.directory, 'settings');
    const subject = 'usr_legacy';
    const key = crypto.createHash('sha256').update(subject).digest('hex');
    const legacyFile = path.join(legacyDirectory, `${key}.json`);

    await fs.mkdir(legacyDirectory, { recursive: true, mode: 0o700 });
    await fs.writeFile(legacyFile, `${JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'dark' }, null, 2)}\n`, { mode: 0o600 });

    // Repli lecture : le fichier historique est lu et reporté dans la base.
    assert.equal((await service.read(subject)).theme, 'dark');

    // La base est désormais la source : la suppression du fichier ne perd rien.
    await fs.rm(legacyFile, { force: true });
    assert.equal((await service.read(subject)).theme, 'dark');

    await service.update(subject, { theme: 'light' });
    assert.equal((await service.read(subject)).theme, 'light');
});
