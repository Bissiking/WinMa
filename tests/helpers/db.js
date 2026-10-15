// tests/helpers/db.js
// Bases de test isolées : SQLite temporaire toujours disponible,
// PostgreSQL créé/détruit à la volée si TEST_DATABASE_URL est défini.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSqliteDatabase } = require('../../src/server/db/sqlite-adapter');
const { createPostgresDatabase } = require('../../src/server/db/postgres-adapter');
const { runMigrations } = require('../../src/server/db/migrator');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function createSqliteTestDatabase(prefix = 'luma-test-') {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const database = createSqliteDatabase({ filePath: path.join(directory, 'database.sqlite') });
    await runMigrations(database, { migrationsDir: MIGRATIONS_DIR });
    return {
        provider: 'sqlite',
        database,
        directory,
        async cleanup() {
            await database.close().catch(() => undefined);
            await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
        }
    };
}

function postgresTestUrl() {
    return process.env.TEST_DATABASE_URL || null;
}

function postgresSkipReason() {
    return 'PostgreSQL non disponible : définissez TEST_DATABASE_URL ' +
        '(ex. postgresql://winma:winma_test@127.0.0.1:5433/winma_test) vers une base jetable autorisée en CREATE DATABASE.';
}

// Crée une base PostgreSQL jetable dédiée aux tests (jamais la base cible).
// Retourne null si TEST_DATABASE_URL est absent ; lève PG_UNAVAILABLE s'il est
// défini mais injoignable — les tests sont alors signalés comme non exécutés.
async function createPostgresTestDatabase() {
    const baseUrl = postgresTestUrl();
    if (!baseUrl) return null;

    const maintenance = createPostgresDatabase({
        connection: { connectionString: baseUrl },
        poolOptions: { max: 2 }
    });

    try {
        await maintenance.ping();
    } catch (error) {
        await maintenance.close().catch(() => undefined);
        const unavailable = new Error(`PostgreSQL injoignable via TEST_DATABASE_URL : ${error.message}`);
        unavailable.code = 'PG_UNAVAILABLE';
        throw unavailable;
    }

    const databaseName = `luma_test_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    await maintenance.exec(`CREATE DATABASE "${databaseName}"`);

    const url = new URL(baseUrl);
    url.pathname = `/${databaseName}`;
    const database = createPostgresDatabase({ connection: { connectionString: url.toString() } });

    try {
        await database.ping();
        await runMigrations(database, { migrationsDir: MIGRATIONS_DIR });
    } catch (error) {
        await database.close().catch(() => undefined);
        await maintenance.exec(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
        await maintenance.close().catch(() => undefined);
        throw error;
    }

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-pg-test-'));

    return {
        provider: 'postgresql',
        database,
        databaseName,
        directory,
        async cleanup() {
            await database.close().catch(() => undefined);
            await maintenance.exec(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`)
                .catch(async () => {
                    await maintenance.exec(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => undefined);
                });
            await maintenance.close().catch(() => undefined);
            await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
        }
    };
}

module.exports = {
    MIGRATIONS_DIR,
    createSqliteTestDatabase,
    createPostgresTestDatabase,
    postgresTestUrl,
    postgresSkipReason
};
