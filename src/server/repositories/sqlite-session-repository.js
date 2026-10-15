// src/server/repositories/sqlite-session-repository.js
// Disposition des fenêtres par utilisateur — contrat asynchrone.
// Schéma : migrations/0002_window_sessions.sqlite.sql.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createSqliteSessionRepository(databaseOrPath) {
    const database = resolveDatabase(databaseOrPath);
    assertProvider(database, 'sqlite');

    async function find(ownerKey) {
        const row = (await database.query('SELECT * FROM window_sessions WHERE owner_key = ?', [ownerKey])).rows[0];
        if (!row) return null;
        return { ownerKey: row.owner_key, windowsJson: row.windows_json, updatedAt: row.updated_at };
    }

    async function upsert(ownerKey, windowsJson, updatedAt) {
        await database.query(`
            INSERT INTO window_sessions (owner_key, windows_json, updated_at)
            VALUES (@ownerKey, @windowsJson, @updatedAt)
            ON CONFLICT(owner_key) DO UPDATE SET
                windows_json = excluded.windows_json,
                updated_at = excluded.updated_at
        `, { ownerKey, windowsJson, updatedAt });
        return find(ownerKey);
    }

    async function remove(ownerKey) {
        const result = await database.query('DELETE FROM window_sessions WHERE owner_key = ?', [ownerKey]);
        return result.rowCount;
    }

    return { find, upsert, remove, database };
}

module.exports = { createSqliteSessionRepository };
