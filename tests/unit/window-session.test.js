const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createSqliteSessionRepository } = require('../../src/server/repositories/sqlite-session-repository');
const { createWindowSessionService, sanitizeWindows } = require('../../src/server/services/window-session-service');

const testContexts = [];

async function createService() {
    const context = await createSqliteTestDatabase('luma-window-session-test-');
    testContexts.push(context);
    const repository = createSqliteSessionRepository(context.database);
    return createWindowSessionService(repository);
}

afterEach(async () => {
    for (const context of testContexts.splice(0)) {
        await context.cleanup();
    }
});

test('une session absente retourne une liste vide', async () => {
    const service = await createService();
    assert.deepEqual(await service.read('usr_one'), { windows: [], updatedAt: null });
});

test('les fenêtres d’un utilisateur sont isolées par clé de session', async () => {
    const service = await createService();
    const windows = [{ appId: 'terminal', state: 'normal' }];
    await service.update('usr_one', { windows });

    assert.equal((await service.read('usr_one')).windows.length, 1);
    assert.deepEqual(await service.read('usr_two'), { windows: [], updatedAt: null });
});

test('une mise à jour écrase la sauvegarde précédente', async () => {
    const service = await createService();
    await service.update('usr_one', { windows: [{ appId: 'terminal' }] });
    await service.update('usr_one', { windows: [{ appId: 'calculator' }, { appId: 'calendar' }] });

    const saved = await service.read('usr_one');
    assert.equal(saved.windows.length, 2);
    assert.equal(saved.windows[0].appId, 'calculator');
});

test('la sanitisation rejette les entrées sans appId et borne les états', async () => {
    const cleaned = sanitizeWindows([
        { appId: 'terminal', state: 'maximized' },
        { appId: 'settings', state: 'bogus', bounds: { left: 10, top: 20, width: 800, height: 600 } },
        { title: 'fantôme' }
    ]);

    assert.equal(cleaned.length, 2);
    assert.equal(cleaned[0].state, 'maximized');
    assert.equal(cleaned[1].state, 'normal');
    assert.equal(cleaned[1].bounds.height, 600);
});

test('une liste non-tableau est refusée', async () => {
    const service = await createService();
    await assert.rejects(
        service.update('usr_one', { windows: 'abc' }),
        (error) => error.code === 'SESSION_WINDOWS_INVALID'
    );
});

test('une session trop grande est refusée', async () => {
    const service = await createService();
    const windows = Array.from({ length: 101 }, (_, index) => ({ appId: `app-${index}` }));
    await assert.rejects(
        service.update('usr_one', { windows }),
        (error) => error.code === 'SESSION_WINDOWS_TOO_LARGE'
    );
});

test('effacer une session vide la sauvegarde', async () => {
    const service = await createService();
    await service.update('usr_one', { windows: [{ appId: 'terminal' }] });
    await service.clear('usr_one');
    assert.deepEqual(await service.read('usr_one'), { windows: [], updatedAt: null });
});
