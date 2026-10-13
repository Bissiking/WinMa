// tests/unit/app-registry.test.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { createAppRegistryService } = require('../../src/server/services/app-registry-service');

const registryPath = path.resolve(__dirname, '../../data/apps.json');

test('le registre charge uniquement des applications déclarées', async () => {
    const service = createAppRegistryService(registryPath);
    const applications = await service.list();

    assert.deepEqual(applications.map((application) => application.id), [
        'documents',
        'trash',
        'settings'
    ]);
});

test('les applications incompatibles restent déclarées mais désactivées', async () => {
    const service = createAppRegistryService(registryPath);
    const applications = await service.load();

    for (const id of ['sonora-studio', 'braindump']) {
        const application = applications.find((item) => item.id === id);
        assert.ok(application, `${id} doit rester déclaré dans le registre`);
        assert.equal(application.enabled, false);
    }
});

test('un identifiant de chemin est refusé avant toute lecture', async () => {
    const service = createAppRegistryService(registryPath);

    await assert.rejects(
        service.findById('../../etc/passwd'),
        (error) => error.code === 'APP_ID_INVALID'
    );
});
