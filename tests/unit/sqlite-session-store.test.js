// tests/unit/sqlite-session-store.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createSqliteSessionStoreRepository } = require('../../src/server/repositories/sqlite-session-store-repository');
const { createSessionStore } = require('../../src/server/stores/session-store');
const { createSqliteSessionStore } = require('../../src/server/stores/sqlite-session-store');

async function withTempDatabase(callback) {
    const context = await createSqliteTestDatabase('luma-session-store-');
    const store = createSessionStore(createSqliteSessionStoreRepository(context.database));

    try {
        return await callback(store, context);
    } finally {
        await context.cleanup();
    }
}

function toPromise(method, ...args) {
    return new Promise((resolve, reject) => {
        method(...args, (error, value) => (error ? reject(error) : resolve(value)));
    });
}

test('la fabrique historique construit aussi un magasin opérationnel', async () => {
    const context = await createSqliteTestDatabase('luma-session-store-factory-');
    let factoryStore = null;
    try {
        factoryStore = createSqliteSessionStore(context.database.filePath);
        await toPromise(factoryStore.set.bind(factoryStore), 'sid-factory', {
            user: { id: 'usr_1' },
            cookie: { expires: new Date(Date.now() + 60_000) }
        });
        const loaded = await toPromise(factoryStore.get.bind(factoryStore), 'sid-factory');
        assert.equal(loaded.user.id, 'usr_1');
    } finally {
        await factoryStore?.repository.database.close().catch(() => undefined);
        await context.cleanup();
    }
});

test('une session enregistrée est relue avec ses données', async () => {
    await withTempDatabase(async (store) => {
        const session = { user: { id: 'usr_1', username: 'matheo' }, cookie: { expires: new Date(Date.now() + 60_000) } };
        await toPromise(store.set.bind(store), 'sid-1', session);
        const loaded = await toPromise(store.get.bind(store), 'sid-1');

        assert.equal(loaded.user.username, 'matheo');
    });
});

test('une session absente retourne null', async () => {
    await withTempDatabase(async (store) => {
        assert.equal(await toPromise(store.get.bind(store), 'missing'), null);
    });
});

test('une session expirée est purgée à la lecture', async () => {
    await withTempDatabase(async (store) => {
        await toPromise(store.set.bind(store), 'sid-old', {
            user: { id: 'usr_1' },
            cookie: { expires: new Date(Date.now() - 1_000) }
        });

        assert.equal(await toPromise(store.get.bind(store), 'sid-old'), null);
    });
});

test('la suppression efface la session', async () => {
    await withTempDatabase(async (store) => {
        await toPromise(store.set.bind(store), 'sid-2', {
            user: { id: 'usr_1' },
            cookie: { expires: new Date(Date.now() + 60_000) }
        });
        await toPromise(store.destroy.bind(store), 'sid-2');

        assert.equal(await toPromise(store.get.bind(store), 'sid-2'), null);
    });
});

test('une session survit à une réécriture (écrasement atomique)', async () => {
    await withTempDatabase(async (store) => {
        const expires = new Date(Date.now() + 60_000);
        await toPromise(store.set.bind(store), 'sid-3', { user: { id: 'v1' }, cookie: { expires } });
        await toPromise(store.set.bind(store), 'sid-3', { user: { id: 'v2' }, cookie: { expires } });
        const loaded = await toPromise(store.get.bind(store), 'sid-3');

        assert.equal(loaded.user.id, 'v2');
    });
});

test('prune supprime uniquement les sessions expirées', async () => {
    await withTempDatabase(async (store) => {
        const future = new Date(Date.now() + 60_000);
        const past = new Date(Date.now() - 1_000);
        await toPromise(store.set.bind(store), 'alive', { user: { id: 'a' }, cookie: { expires: future } });
        await toPromise(store.set.bind(store), 'dead', { user: { id: 'b' }, cookie: { expires: past } });
        await store.prune();

        assert.notEqual(await toPromise(store.get.bind(store), 'alive'), null);
        assert.equal(await toPromise(store.get.bind(store), 'dead'), null);
    });
});
