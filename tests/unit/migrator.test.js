// tests/unit/migrator.test.js
// Migrations SQL versionnées : SQLite (toujours) et PostgreSQL (si disponible).
const assert = require('node:assert/strict');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { createPostgresDatabase } = require('../../src/server/db/postgres-adapter');
const { runMigrations, loadMigrations } = require('../../src/server/db/migrator');
const { createSqliteTestDatabase, createPostgresTestDatabase, postgresSkipReason, MIGRATIONS_DIR } = require('../helpers/db');

test('toutes les migrations sont détectées pour chaque fournisseur', async () => {
    const sqlite = await loadMigrations(MIGRATIONS_DIR, 'sqlite');
    const postgres = await loadMigrations(MIGRATIONS_DIR, 'postgresql');

    assert.ok(sqlite.length >= 4, 'au moins 4 migrations SQLite attendues');
    assert.equal(sqlite.length, postgres.length, 'chaque migration existe pour les deux fournisseurs');
    assert.deepEqual(
        sqlite.map((migration) => migration.version),
        postgres.map((migration) => migration.version)
    );
    assert.ok(sqlite.every((migration) => migration.fileName.endsWith('.sqlite.sql')));
    assert.ok(postgres.every((migration) => migration.fileName.endsWith('.postgresql.sql')));
});

test('un répertoire de migrations manquant est une erreur explicite', async () => {
    await assert.rejects(
        loadMigrations(path.join(MIGRATIONS_DIR, 'inexistant'), 'sqlite'),
        /introuvable/
    );
});

test('les migrations SQLite s\u2019appliquent une seule fois et préservent les données', async (t) => {
    const context = await createSqliteTestDatabase('luma-migrator-');
    t.after(() => context.cleanup());

    const { database } = context;
    const tables = (await database.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    )).rows.map((row) => row.name);
    for (const expected of ['auth_sessions', 'window_sessions', 'document_items', 'user_settings', 'account_preferences', 'schema_migrations']) {
        assert.ok(tables.includes(expected), `table ${expected} absente`);
    }

    await database.query(
        'INSERT INTO window_sessions (owner_key, windows_json, updated_at) VALUES (?, ?, ?)',
        ['usr_keep', '[]', new Date().toISOString()]
    );

    const second = await runMigrations(database, { migrationsDir: MIGRATIONS_DIR });
    assert.deepEqual(second.applied, []);
    assert.equal(second.alreadyApplied.length, 4);

    const rows = (await database.query('SELECT owner_key FROM window_sessions WHERE owner_key = ?', ['usr_keep'])).rows;
    assert.equal(rows.length, 1, 'une ré-application ne doit jamais effacer les données');
});

test('une migration refuse un fournisseur qui ne correspond pas à la base', async (t) => {
    const context = await createSqliteTestDatabase('luma-migrator-mismatch-');
    t.after(() => context.cleanup());

    await assert.rejects(
        runMigrations(context.database, { migrationsDir: MIGRATIONS_DIR, provider: 'postgresql' }),
        /ne correspond pas/
    );
});

let pgContext = null;
let pgUnavailable = null;

before(async () => {
    try {
        pgContext = await createPostgresTestDatabase();
        if (!pgContext) pgUnavailable = postgresSkipReason();
    } catch (error) {
        pgUnavailable = error.message;
    }
});

after(async () => {
    await pgContext?.cleanup();
});

test('les migrations PostgreSQL s\u2019appliquent une seule fois et préservent les données', async (t) => {
    if (!pgContext) return t.skip(pgUnavailable || postgresSkipReason());

    const { database } = pgContext;
    const tables = (await database.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )).rows.map((row) => row.table_name);
    for (const expected of ['auth_sessions', 'window_sessions', 'document_items', 'user_settings', 'account_preferences', 'schema_migrations']) {
        assert.ok(tables.includes(expected), `table ${expected} absente`);
    }

    const second = await runMigrations(database, { migrationsDir: MIGRATIONS_DIR });
    assert.deepEqual(second.applied, []);
    assert.equal(second.alreadyApplied.length, 4);
});

test('une base PostgreSQL vierge démarre uniquement avec ses migrations', async (t) => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) return t.skip(postgresSkipReason());

    const maintenance = createPostgresDatabase({ connection: { connectionString: url }, poolOptions: { max: 2 } });
    const databaseName = `luma_migrate_${Date.now().toString(36)}`;
    let database = null;

    try {
        await maintenance.ping();
        await maintenance.exec(`CREATE DATABASE "${databaseName}"`);
        const target = new URL(url);
        target.pathname = `/${databaseName}`;
        database = createPostgresDatabase({ connection: { connectionString: target.toString() } });
        await database.ping();

        const result = await runMigrations(database, { migrationsDir: MIGRATIONS_DIR });
        assert.equal(result.applied.length, 4);
        const applied = (await database.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
        assert.equal(applied.length, 4);
    } catch (error) {
        if (error.code === 'PG_UNAVAILABLE' || /injoignable/.test(error.message)) {
            return t.skip(postgresSkipReason());
        }
        throw error;
    } finally {
        await database?.close().catch(() => undefined);
        await maintenance.exec(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
        await maintenance.close().catch(() => undefined);
    }
});
