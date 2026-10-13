// src/server/repositories/sqlite-session-store-repository.js
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function createSqliteSessionStoreRepository(databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    const database = new Database(databasePath);
    database.pragma('journal_mode = WAL');
    database.exec(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
            sid TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            expires INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires);
    `);

    const findBySidStatement = database.prepare('SELECT data, expires FROM auth_sessions WHERE sid = ?');
    const upsertStatement = database.prepare(`
        INSERT INTO auth_sessions (sid, data, expires)
        VALUES (@sid, @data, @expires)
        ON CONFLICT(sid) DO UPDATE SET
            data = excluded.data,
            expires = excluded.expires
    `);
    const removeStatement = database.prepare('DELETE FROM auth_sessions WHERE sid = ?');
    const pruneStatement = database.prepare('DELETE FROM auth_sessions WHERE expires IS NOT NULL AND expires <= ?');

    function find(sid) {
        const row = findBySidStatement.get(sid);
        if (!row) return null;
        return {
            data: JSON.parse(row.data),
            expires: row.expires ? new Date(row.expires) : null
        };
    }

    function upsert(sid, data, expires) {
        upsertStatement.run({
            sid,
            data: JSON.stringify(data),
            expires: expires ? expires.getTime() : null
        });
    }

    function remove(sid) {
        removeStatement.run(sid);
    }

    function prune() {
        pruneStatement.run(Date.now());
    }

    return { find, upsert, remove, prune };
}

module.exports = { createSqliteSessionStoreRepository };
