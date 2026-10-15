// src/server/repositories/sqlite-session-store-repository.js
// Contrat asynchrone : find/upsert/remove/prune retournent des promesses.
// Le schéma est créé par migrations/0001_auth_sessions.sqlite.sql.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createSqliteSessionStoreRepository(databaseOrPath) {
    const database = resolveDatabase(databaseOrPath);
    assertProvider(database, 'sqlite');

    async function find(sid) {
        const row = (await database.query('SELECT data, expires FROM auth_sessions WHERE sid = ?', [sid])).rows[0];
        if (!row) return null;
        return {
            data: JSON.parse(row.data),
            expires: row.expires ? new Date(row.expires) : null
        };
    }

    async function upsert(sid, data, expires) {
        await database.query(`
            INSERT INTO auth_sessions (sid, data, expires)
            VALUES (@sid, @data, @expires)
            ON CONFLICT(sid) DO UPDATE SET
                data = excluded.data,
                expires = excluded.expires
        `, { sid, data: JSON.stringify(data), expires: expires ? expires.getTime() : null });
    }

    async function remove(sid) {
        await database.query('DELETE FROM auth_sessions WHERE sid = ?', [sid]);
    }

    async function prune() {
        await database.query('DELETE FROM auth_sessions WHERE expires IS NOT NULL AND expires <= ?', [Date.now()]);
    }

    return { find, upsert, remove, prune, database };
}

module.exports = { createSqliteSessionStoreRepository };
