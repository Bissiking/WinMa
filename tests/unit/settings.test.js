// tests/unit/settings.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { createSettingsService, DEFAULT_SETTINGS } = require('../../src/server/services/settings-service');

const temporaryDirectories = [];

async function createService() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-settings-test-'));
    temporaryDirectories.push(directory);
    return createSettingsService(directory);
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, {
        recursive: true,
        force: true
    })));
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
        wallpaper: DEFAULT_SETTINGS.wallpaper,
        theme: 'dark',
        accentColor: '#3366CC',
        density: 'comfortable',
        motion: 'system',
        restoreSession: true
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
