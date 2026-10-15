// tests/unit/app-registry.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { createAppRegistryService } = require('../../src/server/services/app-registry-service');

const registryPath = path.resolve(__dirname, '../../data/apps.json');
const tempFiles = [];

after(async () => {
    await Promise.all(tempFiles.map((file) => fs.rm(file, { force: true })));
});

async function writeRegistry(entries) {
    const file = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'luma-registry-')), 'apps.json');
    tempFiles.push(file);
    await fs.writeFile(file, JSON.stringify(entries));
    return file;
}

test('le registre publie toutes les applications activées', async () => {
    const service = createAppRegistryService(registryPath);
    const applications = await service.list();

    assert.deepEqual(applications.map((application) => application.id), [
        'documents',
        'calculator',
        'terminal',
        'calendar',
        'settings',
        'task-manager',
        'luma-orbit',
        'matheo-systems',
        'notepad',
        'image-viewer',
        'music-player',
        'video-player',
        'power',
        'timer',
        'trash'
    ]);
    for (const application of applications) {
        assert.equal(application.enabled, true);
        assert.ok(application.module === undefined || application.module.startsWith('/apps/'), `${application.id} : module interne attendu`);
        assert.ok(application.entry.startsWith('/'), `${application.id} : entry interne attendu`);
    }
});

test('les applications incompatibles restent déclarées mais désactivées', async () => {
    const service = createAppRegistryService(registryPath);
    const applications = await service.load();

    for (const id of ['sonora-studio', 'braindump']) {
        const application = applications.find((item) => item.id === id);
        assert.ok(application, `${id} doit rester déclaré dans le registre`);
        assert.equal(application.enabled, false);
        assert.equal(application.incompatible, true);
        assert.equal(application.storeManaged, true);
    }
});

test('un identifiant de chemin est refusé avant toute lecture', async () => {
    const service = createAppRegistryService(registryPath);

    await assert.rejects(
        service.findById('../../etc/passwd'),
        (error) => error.code === 'APP_ID_INVALID'
    );
});

test('une application inconnue ou désactivée retourne APP_NOT_FOUND', async () => {
    const service = createAppRegistryService(registryPath);

    await assert.rejects(
        service.findById('inconnue'),
        (error) => error.code === 'APP_NOT_FOUND'
    );
    await assert.rejects(
        service.findById('sonora-studio'),
        (error) => error.code === 'APP_NOT_FOUND'
    );
});

test('le registre retire les champs inconnus et fige les définitions', async () => {
    const file = await writeRegistry([{
        id: 'demo',
        name: 'Démo',
        icon: 'folder',
        entry: '/apps/demo/app.js',
        module: '/apps/demo/app.js',
        type: 'internal',
        enabled: true,
        pinned: true,
        secretLeak: 'jamais',
        window: { width: 600, height: 400, minWidth: 300, minHeight: 200 },
        position: { left: 0.5, top: 0.25 }
    }]);
    const service = createAppRegistryService(file);
    const [application] = await service.list();

    assert.equal('pinned' in application, false);
    assert.equal('secretLeak' in application, false);
    assert.equal(application.position.left, 0.5);
    assert.equal(Object.isFrozen(application), true);
    assert.equal(Object.isFrozen(application.window), true);
    assert.equal(Object.isFrozen(application.position), true);
});

test('une entrée invalide fait échouer le chargement du registre', async () => {
    const validWindow = { width: 600, height: 400, minWidth: 300, minHeight: 200 };

    const cases = [
        { label: 'iframe sans origine', entry: { id: 'ext', name: 'Ext', icon: 'folder', entry: 'https://ext.test', type: 'iframe', enabled: true, window: validWindow } },
        { label: 'iframe origine http', entry: { id: 'ext', name: 'Ext', icon: 'folder', entry: '/apps/ext/index.html', type: 'iframe', enabled: true, allowedOrigin: 'http://ext.test', window: validWindow } },
        { label: 'iframe origine avec chemin', entry: { id: 'ext', name: 'Ext', icon: 'folder', entry: '/apps/ext/index.html', type: 'iframe', enabled: true, allowedOrigin: 'https://ext.test/chemin', window: validWindow } },
        { label: 'iframe origine javascript', entry: { id: 'ext', name: 'Ext', icon: 'folder', entry: '/apps/ext/index.html', type: 'iframe', enabled: true, allowedOrigin: 'javascript:alert(1)', window: validWindow } },
        { label: 'iframe origine data', entry: { id: 'ext', name: 'Ext', icon: 'folder', entry: '/apps/ext/index.html', type: 'iframe', enabled: true, allowedOrigin: 'data:text/html,<h1>hi', window: validWindow } },
        { label: 'module hors /apps/', entry: { id: 'evil', name: 'Evil', icon: 'folder', entry: '/apps/evil/app.js', module: '../secrets.js', type: 'internal', enabled: true, window: validWindow } },
        { label: 'chemin avec ..', entry: { id: 'evil', name: 'Evil', icon: 'folder', entry: '/../secret', type: 'internal', enabled: true, window: validWindow } },
        { label: 'fenêtre incomplète', entry: { id: 'w', name: 'W', icon: 'folder', entry: '/apps/w/app.js', type: 'internal', enabled: true, window: { width: 600 } } },
        { label: 'position hors bornes', entry: { id: 'p', name: 'P', icon: 'folder', entry: '/apps/p/app.js', type: 'internal', enabled: true, window: validWindow, position: { left: 2, top: 0 } } },
        { label: 'drapeau non booléen', entry: { id: 'h', name: 'H', icon: 'folder', entry: '/apps/h/app.js', type: 'internal', enabled: true, hidden: 'oui', window: validWindow } }
    ];

    for (const { label, entry } of cases) {
        const file = await writeRegistry([entry]);
        const service = createAppRegistryService(file);
        await assert.rejects(service.load(), /invalide|doit|refus|window|position|module|origine/i, `${label} doit être refusé`);
    }
});

test('une app iframe valide publie une origine normalisée et activée', async () => {
    const file = await writeRegistry([{
        id: 'ext-ok',
        name: 'Ext OK',
        icon: 'folder',
        entry: '/apps/ext/index.html',
        type: 'iframe',
        enabled: true,
        allowedOrigin: 'https://ok.example',
        window: { width: 800, height: 600, minWidth: 400, minHeight: 300 }
    }, {
        id: 'ext-off',
        name: 'Ext off',
        icon: 'folder',
        entry: '/apps/off/index.html',
        type: 'iframe',
        enabled: false,
        allowedOrigin: 'https://off.example',
        window: { width: 800, height: 600, minWidth: 400, minHeight: 300 }
    }]);
    const service = createAppRegistryService(file);

    const [application] = await service.list();
    assert.equal(application.allowedOrigin, 'https://ok.example');

    const origins = await service.listAllowedFrameOrigins();
    assert.deepEqual(origins, ['https://ok.example']);
});
