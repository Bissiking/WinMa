// src/server/repositories/pg-session-store-repository.js
// Équivalent PostgreSQL du repository de sessions Express/Kyros.
// Contrat asynchrone identique à l'implémentation SQLite.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createPgSessionStoreRepository(databaseOrPool) {
    const database = resolveDatabase(databaseOrPool);
    assertProvider(database, 'postgresql');

    async function find(sid) {
        const row = (await database.query('SELECT data, expires FROM auth_sessions WHERE sid = $1', [sid])).rows[0];
        if (!row) return null;
        return {
            data: JSON.parse(row.data),
            expires: row.expires ? new Date(Number(row.expires)) : null
        };
    }

    async function upsert(sid, data, expires) {
        await database.query(`
            INSERT INTO auth_sessions (sid, data, expires)
            VALUES ($1, $2, $3)
            ON CONFLICT (sid) DO UPDATE SET
                data = EXCLUDED.data,
                expires = EXCLUDED.expires
        `, [sid, JSON.stringify(data), expires ? expires.getTime() : null]);
    }

    async function remove(sid) {
        await database.query('DELETE FROM auth_sessions WHERE sid = $1', [sid]);
    }

    async function prune() {
        await database.query('DELETE FROM auth_sessions WHERE expires IS NOT NULL AND expires <= $1', [Date.now()]);
    }

    return { find, upsert, remove, prune, database };
}

module.exports = { createPgSessionStoreRepository };
