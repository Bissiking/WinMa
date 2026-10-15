// src/server/repositories/pg-preferences-repository.js
// Équivalent PostgreSQL des préférences applicatives — contrat identique.
// Schéma : migrations/0004_user_preferences.postgresql.sql.
const { resolveDatabase, assertProvider } = require('./repository-database');
const { ALLOWED_TABLES } = require('./sqlite-preferences-repository');

function createPgPreferencesRepository(databaseOrPool, table) {
    if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Table de préférences inconnue : ${table}`);
    }
    const database = resolveDatabase(databaseOrPool);
    assertProvider(database, 'postgresql');

    async function find(ownerKey) {
        const row = (await database.query(
            `SELECT owner_key, data, updated_at FROM ${table} WHERE owner_key = $1`,
            [ownerKey]
        )).rows[0];
        if (!row) return null;
        return { ownerKey: row.owner_key, data: row.data, updatedAt: row.updated_at };
    }

    async function upsert(ownerKey, data, updatedAt) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        await database.query(`
            INSERT INTO ${table} (owner_key, data, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (owner_key) DO UPDATE SET
                data = EXCLUDED.data,
                updated_at = EXCLUDED.updated_at
        `, [ownerKey, payload, updatedAt]);
        return find(ownerKey);
    }

    async function remove(ownerKey) {
        const result = await database.query(`DELETE FROM ${table} WHERE owner_key = $1`, [ownerKey]);
        return result.rowCount;
    }

    return { find, upsert, remove, table, database };
}

module.exports = { createPgPreferencesRepository };
