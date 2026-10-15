// src/server/db/index.js
// Point d'entrée de la persistance : DB_PROVIDER=sqlite|postgresql.
// En production, PostgreSQL est obligatoire et toute erreur de connexion est
// fatale — il n'existe aucun repli silencieux vers SQLite.
const path = require('node:path');
const logger = require('../utils/logger');
const { createSqliteDatabase } = require('./sqlite-adapter');
const { createPostgresDatabase } = require('./postgres-adapter');
const { runMigrations } = require('./migrator');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'migrations');

async function createDatabase(databaseConfig) {
    if (!databaseConfig || !databaseConfig.provider) {
        throw new Error('La configuration de base de données (DB_PROVIDER) est requise.');
    }

    const provider = databaseConfig.provider;

    if (provider === 'sqlite') {
        const filePath = databaseConfig.sqlite?.filePath || path.join(PROJECT_ROOT, 'data/luma.sqlite');
        const database = createSqliteDatabase({ filePath });
        await database.ping();
        logger.info('database_ready', { provider: 'sqlite' });
        return database;
    }

    if (provider === 'postgresql') {
        const { connection, poolOptions } = buildPostgresConfig(databaseConfig);
        const database = createPostgresDatabase({ connection, poolOptions });
        try {
            await database.ping();
        } catch (error) {
            await database.close().catch(() => undefined);
            // Jamais de repli SQLite : l'application doit s'arrêter.
            throw new Error(
                `Connexion PostgreSQL impossible (${error.message}). Aucun repli SQLite n'est autorisé : corrigez DB_PROVIDER/DATABASE_URL puis relancez.`
            );
        }
        logger.info('database_ready', {
            provider: 'postgresql',
            host: connection.host || '(DATABASE_URL)',
            database: connection.database || '(DATABASE_URL)',
            poolMax: poolOptions.max
        });
        return database;
    }

    throw new Error(`DB_PROVIDER inconnu : "${provider}" (attendu : sqlite ou postgresql).`);
}

function buildPostgresConfig(databaseConfig) {
    const postgres = databaseConfig.postgres || {};
    const connectionString = postgres.connectionString || null;

    if (!connectionString && !postgres.database) {
        throw new Error(
            'PostgreSQL exige DATABASE_URL (ou PGDATABASE/PGHOST/PGUSER/PGPASSWORD). Aucun repli SQLite nest possible.'
        );
    }

    const connection = {};
    if (connectionString) {
        connection.connectionString = connectionString;
    } else {
        if (postgres.host) connection.host = postgres.host;
        if (postgres.port) connection.port = postgres.port;
        if (postgres.user) connection.user = postgres.user;
        if (postgres.password) connection.password = postgres.password;
        connection.database = postgres.database;
    }

    const poolOptions = {
        max: postgres.poolMax || 10,
        connectionTimeoutMillis: postgres.connectTimeoutMs || 5000,
        idleTimeoutMillis: postgres.idleTimeoutMs || 30000
    };

    return { connection, poolOptions };
}

module.exports = { createDatabase, runMigrations, DEFAULT_MIGRATIONS_DIR, PROJECT_ROOT };
