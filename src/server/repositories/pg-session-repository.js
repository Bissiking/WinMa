// src/server/repositories/pg-session-repository.js
// Équivalent PostgreSQL de la disposition des fenêtres — contrat identique.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createPgSessionRepository(databaseOrPool) {
    const database = resolveDatabase(databaseOrPool);
    assertProvider(database, 'postgresql');

    async function find(ownerKey) {
        const row = (await database.query('SELECT owner_key, windows_json, updated_at FROM window_sessions WHERE owner_key = $1', [ownerKey])).rows[0];
        if (!row) return null;
        return { ownerKey: row.owner_key, windowsJson: row.windows_json, updatedAt: row.updated_at };
    }

    async function upsert(ownerKey, windowsJson, updatedAt) {
        await database.query(`
            INSERT INTO window_sessions (owner_key, windows_json, updated_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (owner_key) DO UPDATE SET
                windows_json = EXCLUDED.windows_json,
                updated_at = EXCLUDED.updated_at
        `, [ownerKey, windowsJson, updatedAt]);
        return find(ownerKey);
    }

    async function remove(ownerKey) {
        const result = await database.query('DELETE FROM window_sessions WHERE owner_key = $1', [ownerKey]);
        return result.rowCount;
    }

    return { find, upsert, remove, database };
}

module.exports = { createPgSessionRepository };
