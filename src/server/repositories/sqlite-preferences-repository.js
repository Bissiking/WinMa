// src/server/repositories/sqlite-preferences-repository.js
// Préférences applicatives par utilisateur (paramètres d'apparence,
// préférences de compte) — contrat asynchrone.
// Schéma : migrations/0004_user_preferences.sqlite.sql.
const { resolveDatabase, assertProvider } = require('./repository-database');

const ALLOWED_TABLES = new Set(['user_settings', 'account_preferences']);

function createSqlitePreferencesRepository(databaseOrPath, table) {
    if (!ALLOWED_TABLES.has(table)) {
        throw new Error(`Table de préférences inconnue : ${table}`);
    }
    const database = resolveDatabase(databaseOrPath);
    assertProvider(database, 'sqlite');

    async function find(ownerKey) {
        const row = (await database.query(
            `SELECT owner_key, data, updated_at FROM ${table} WHERE owner_key = ?`,
            [ownerKey]
        )).rows[0];
        if (!row) return null;
        return { ownerKey: row.owner_key, data: row.data, updatedAt: row.updated_at };
    }

    async function upsert(ownerKey, data, updatedAt) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        await database.query(`
            INSERT INTO ${table} (owner_key, data, updated_at)
            VALUES (@ownerKey, @data, @updatedAt)
            ON CONFLICT(owner_key) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        `, { ownerKey, data: payload, updatedAt });
        return find(ownerKey);
    }

    async function remove(ownerKey) {
        const result = await database.query(`DELETE FROM ${table} WHERE owner_key = ?`, [ownerKey]);
        return result.rowCount;
    }

    return { find, upsert, remove, table, database };
}

module.exports = { createSqlitePreferencesRepository, ALLOWED_TABLES };
