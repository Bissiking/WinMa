// src/server/repositories/repository-database.js
// Acepte soit une base existante (adaptateur sqlite/pg), soit un chemin
// SQLite pour compatibilité avec les usages historiques.
const { createSqliteDatabase } = require('../db/sqlite-adapter');

function resolveDatabase(databaseOrPath) {
    if (typeof databaseOrPath === 'string') {
        return createSqliteDatabase({ filePath: databaseOrPath });
    }
    if (databaseOrPath && typeof databaseOrPath.query === 'function') {
        return databaseOrPath;
    }
    throw new Error('Un repository exige une base de données ou un chemin SQLite.');
}

function assertProvider(database, expected) {
    if (database.provider !== expected) {
        throw new Error(
            `Repository ${expected} appelé avec un fournisseur "${database.provider}". Utilisez le repository correspondant à DB_PROVIDER.`
        );
    }
}

module.exports = { resolveDatabase, assertProvider };
