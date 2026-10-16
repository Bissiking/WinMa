// tests/unit/workspaces.test.js
const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createSqliteWorkspaceRepository } = require('../../src/server/repositories/sqlite-workspace-repository');
const { createSqliteSessionRepository } = require('../../src/server/repositories/sqlite-session-repository');
const { createWindowSessionService } = require('../../src/server/services/window-session-service');
const { createWorkspaceService, MAX_WORKSPACES } = require('../../src/server/services/workspace-service');

const OWNER = 'usr_workspace_owner';
const testContexts = [];

async function createServices() {
    const context = await createSqliteTestDatabase('luma-workspaces-test-');
    testContexts.push(context);
    const workspaceRepository = createSqliteWorkspaceRepository(context.database);
    const windowSessionService = createWindowSessionService(createSqliteSessionRepository(context.database));
    return {
        workspaceService: createWorkspaceService({ workspaceRepository, windowSessionService }),
        windowSessionService
    };
}

afterEach(async () => {
    for (const context of testContexts.splice(0)) {
        await context.cleanup();
    }
});

function sampleWindows(name) {
    return [{ id: `win-${name}`, appId: 'notepad', name: `Bloc-notes ${name}`, state: 'normal', bounds: { left: 40, top: 40, width: 700, height: 500 } }];
}

test('la liste est vide sans espace et activeId est null', async () => {
    const { workspaceService } = await createServices();
    assert.deepEqual(await workspaceService.list(OWNER), { workspaces: [], activeId: null });
});

test('create capture la disposition courante et devient l’espace actif', async () => {
    const { workspaceService, windowSessionService } = await createServices();
    await windowSessionService.update(OWNER, { windows: sampleWindows('courant') });

    const created = await workspaceService.create(OWNER, { name: '  Développement   ' });
    assert.equal(created.name, 'Développement', 'le nom est normalisé');
    assert.equal(created.isActive, true);
    assert.equal(created.windowCount, 1);
    assert.ok(created.id);

    const list = await workspaceService.list(OWNER);
    assert.equal(list.activeId, created.id);
    assert.equal(list.workspaces.length, 1);
});

test('create peut recevoir une disposition explicite', async () => {
    const { workspaceService } = await createServices();
    const created = await workspaceService.create(OWNER, { name: 'Administration', windows: sampleWindows('admin') });
    assert.equal(created.windowCount, 1);
});

test('les noms invalides ou dupliqués sont refusés', async () => {
    const { workspaceService } = await createServices();
    await assert.rejects(workspaceService.create(OWNER, { name: '   ' }), (error) => error.code === 'WORKSPACE_INVALID_NAME');
    await assert.rejects(workspaceService.create(OWNER, { name: 'x'.repeat(41) }), (error) => error.code === 'WORKSPACE_INVALID_NAME');

    await workspaceService.create(OWNER, { name: 'Personnel' });
    await assert.rejects(workspaceService.create(OWNER, { name: 'personnel' }), (error) => error.code === 'WORKSPACE_NAME_TAKEN');

    const second = await workspaceService.create(OWNER, { name: 'Développement' });
    const renamed = await workspaceService.rename(OWNER, second.id, { name: 'Travail' });
    assert.equal(renamed.name, 'Travail');
    await assert.rejects(
        workspaceService.rename(OWNER, second.id, { name: 'PERSONNEL' }),
        (error) => error.code === 'WORKSPACE_NAME_TAKEN'
    );
});

test('la bascule enregistre la disposition courante puis applique la cible', async () => {
    const { workspaceService, windowSessionService } = await createServices();
    await windowSessionService.update(OWNER, { windows: sampleWindows('A') });
    const workspaceA = await workspaceService.create(OWNER, { name: 'A' });

    await windowSessionService.update(OWNER, { windows: sampleWindows('B') });
    const workspaceB = await workspaceService.create(OWNER, { name: 'B' });

    // Bascule sur A : la disposition courante (B) doit être enregistrée dans B,
    // puis les fenêtres de A deviennent la session courante.
    const activated = await workspaceService.activate(OWNER, workspaceA.id);
    assert.equal(activated.layoutApplied, true);
    assert.equal(activated.isActive, true);

    const current = await windowSessionService.read(OWNER);
    assert.equal(current.windows[0].name, 'Bloc-notes A', 'les fenêtres de la cible sont chargées');

    const list = await workspaceService.list(OWNER);
    assert.equal(list.activeId, workspaceA.id);
    const storedB = list.workspaces.find((item) => item.id === workspaceB.id);
    assert.equal(storedB.windowCount, 1, 'la disposition courante a été enregistrée dans l’ancien actif');

    // Réactivation sans changement : layoutApplied false.
    const again = await workspaceService.activate(OWNER, workspaceA.id);
    assert.equal(again.layoutApplied, false);
});

test('saveLayout met à jour la disposition d’un espace', async () => {
    const { workspaceService, windowSessionService } = await createServices();
    await windowSessionService.update(OWNER, { windows: sampleWindows('avant') });
    const workspace = await workspaceService.create(OWNER, { name: 'Notes' });

    await windowSessionService.update(OWNER, { windows: [] });
    const saved = await workspaceService.saveLayout(OWNER, workspace.id);
    assert.equal(saved.windowCount, 0);

    const explicit = await workspaceService.saveLayout(OWNER, workspace.id, { windows: sampleWindows('explicite') });
    assert.equal(explicit.windowCount, 1);
});

test('les identifiants invalides et les espaces inconnus sont refusés', async () => {
    const { workspaceService } = await createServices();
    await assert.rejects(workspaceService.activate(OWNER, '../../etc'), (error) => error.code === 'WORKSPACE_ID_INVALID');
    await assert.rejects(
        workspaceService.activate(OWNER, '00000000-0000-0000-0000-000000000000'),
        (error) => error.code === 'WORKSPACE_NOT_FOUND'
    );
});

test('la suppression refuse l’espace actif et le dernier espace', async () => {
    const { workspaceService } = await createServices();
    const first = await workspaceService.create(OWNER, { name: 'Premier' });
    await assert.rejects(workspaceService.remove(OWNER, first.id), (error) => error.code === 'WORKSPACE_ACTIVE_REMOVE');

    const second = await workspaceService.create(OWNER, { name: 'Second' });
    const removed = await workspaceService.remove(OWNER, first.id);
    assert.equal(removed.removed, true);
    assert.equal((await workspaceService.list(OWNER)).workspaces.length, 1);

    // Second devient le seul espace restant (actif) : suppression refusée.
    await assert.rejects(workspaceService.remove(OWNER, second.id), (error) => error.code === 'WORKSPACE_ACTIVE_REMOVE');
});

test('la limite d’espaces est appliquée', async () => {
    const { workspaceService } = await createServices();
    for (let index = 0; index < MAX_WORKSPACES; index += 1) {
        await workspaceService.create(OWNER, { name: `Espace ${index}` });
    }
    await assert.rejects(
        workspaceService.create(OWNER, { name: 'En trop' }),
        (error) => error.code === 'WORKSPACE_LIMIT_REACHED'
    );
});
