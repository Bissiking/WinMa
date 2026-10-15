// tests/unit/env.test.js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadConfig } = require('../../src/server/config/env');

test('Kyros reste désactivé lorsque les secrets Luma OS manquent', () => {
    const config = loadConfig({
        NODE_ENV: 'development',
        APP_BASE_URL: 'http://localhost:3000',
        LUMA_KYROS_BASE_URL: 'https://kyros.example.test'
    });

    assert.equal(config.kyros.enabled, false);
});

test('la production refuse une configuration sans secret de session', () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'https://luma.example.test' }),
        /SESSION_SECRET/
    );
});

test('DB_PROVIDER par défaut est sqlite en développement', () => {
    const config = loadConfig({ NODE_ENV: 'development', APP_BASE_URL: 'http://localhost:3000' });
    assert.equal(config.database.provider, 'sqlite');
    assert.match(config.database.sqlite.filePath, /luma\.sqlite$/);
    assert.ok(config.database.migrationsDir.endsWith('migrations'));
});

test('DB_PROVIDER accepte uniquement sqlite ou postgresql', () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: 'development', APP_BASE_URL: 'http://localhost:3000', DB_PROVIDER: 'mysql' }),
        /DB_PROVIDER/
    );
});

test('la production impose PostgreSQL et refuse tout repli SQLite', () => {
    assert.throws(
        () => loadConfig({
            NODE_ENV: 'production',
            APP_BASE_URL: 'https://luma.example.test',
            SESSION_SECRET: 'a-production-session-secret-of-at-least-32-chars'
        }),
        /postgresql/
    );
    assert.throws(
        () => loadConfig({
            NODE_ENV: 'production',
            APP_BASE_URL: 'https://luma.example.test',
            SESSION_SECRET: 'a-production-session-secret-of-at-least-32-chars',
            DB_PROVIDER: 'sqlite'
        }),
        /postgresql/
    );
});

test('PostgreSQL exige DATABASE_URL ou PGDATABASE', () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: 'development', APP_BASE_URL: 'http://localhost:3000', DB_PROVIDER: 'postgresql' }),
        /DATABASE_URL|PGDATABASE/
    );

    const config = loadConfig({
        NODE_ENV: 'development',
        APP_BASE_URL: 'http://localhost:3000',
        DB_PROVIDER: 'postgresql',
        DATABASE_URL: 'postgresql://luma:secret@db.example.test:5432/luma',
        DB_POOL_MAX: '5'
    });
    assert.equal(config.database.provider, 'postgresql');
    assert.equal(config.database.postgres.connectionString, 'postgresql://luma:secret@db.example.test:5432/luma');
    assert.equal(config.database.postgres.poolMax, 5);
});
