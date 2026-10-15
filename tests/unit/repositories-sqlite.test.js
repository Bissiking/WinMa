// tests/unit/repositories-sqlite.test.js
// Exécution du contrat des repositories contre SQLite (toujours disponible).
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createSqliteTestDatabase } = require('../helpers/db');
const { createRepositories } = require('../../src/server/repositories');
const { defineRepositoryContractSuite } = require('../helpers/repository-contract');

let context = null;

before(async () => {
    const created = await createSqliteTestDatabase('luma-contract-sqlite-');
    context = {
        ...created,
        repositories: createRepositories(created.database)
    };
});

after(async () => {
    await context?.cleanup();
});

function testDb(name, fn) {
    test(name, async (t) => fn(t, context));
}

defineRepositoryContractSuite({ testDb, createContext: () => context });

test('le repository sélectionné expose bien le fournisseur sqlite', async (t) => {
    if (!context) return t.skip('base SQLite de test indisponible');
    assertProvider(context, 'sqlite');
});

function assertProvider(ctx, expected) {
    const assert = require('node:assert/strict');
    assert.equal(ctx.repositories.provider, expected);
    assert.equal(ctx.database.provider, expected);
}
