// tests/unit/repositories-postgres.test.js
// Contrat des repositories contre PostgreSQL.
// Non exécuté (signalé comme skip) si TEST_DATABASE_URL est absent ou
// si l'instance est injoignable — jamais de repli silencieux sur SQLite.
const { after, before, test } = require('node:test');
const { createPostgresTestDatabase, postgresSkipReason } = require('../helpers/db');
const { createRepositories } = require('../../src/server/repositories');
const { defineRepositoryContractSuite } = require('../helpers/repository-contract');

let context = null;
let unavailable = null;

before(async () => {
    try {
        const created = await createPostgresTestDatabase();
        if (!created) {
            unavailable = postgresSkipReason();
            return;
        }
        context = {
            ...created,
            repositories: createRepositories(created.database)
        };
    } catch (error) {
        unavailable = error.code === 'PG_UNAVAILABLE' ? `${postgresSkipReason()} (${error.message})` : error.message;
    }
});

after(async () => {
    await context?.cleanup();
});

function testDb(name, fn) {
    test(name, async (t) => {
        if (unavailable) return t.skip(unavailable);
        if (!context) return t.skip(unavailable || 'base PostgreSQL de test indisponible');
        await fn(t, context);
    });
}

defineRepositoryContractSuite({ testDb, createContext: () => context });

testDb('le repository sélectionné expose bien le fournisseur postgresql', async (t, ctx) => {
    const assert = require('node:assert/strict');
    assert.equal(ctx.repositories.provider, 'postgresql');
    assert.equal(ctx.database.provider, 'postgresql');
});
