// src/server/stores/sqlite-session-store.js
// Compatibilité : construit un magasin de session sur repository SQLite.
const { createSqliteSessionStoreRepository } = require('../repositories/sqlite-session-store-repository');
const { createSessionStore, DatabaseSessionStore } = require('./session-store');

function createSqliteSessionStore(databasePath) {
    return createSessionStore(createSqliteSessionStoreRepository(databasePath));
}

module.exports = { createSqliteSessionStore, DatabaseSessionStore, SqliteSessionStore: DatabaseSessionStore };
