const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function createSqliteSessionRepository(databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    const database = new Database(databasePath);
    database.pragma('journal_mode = WAL');
    database.exec(`
        CREATE TABLE IF NOT EXISTS window_sessions (
            owner_key TEXT PRIMARY KEY,
            windows_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    `);

    const upsertStatement = database.prepare(`
        INSERT INTO window_sessions (owner_key, windows_json, updated_at)
        VALUES (@ownerKey, @windowsJson, @updatedAt)
        ON CONFLICT(owner_key) DO UPDATE SET
            windows_json = excluded.windows_json,
            updated_at = excluded.updated_at
    `);
    const findByOwnerStatement = database.prepare('SELECT * FROM window_sessions WHERE owner_key = ?');

    function find(ownerKey) {
        const row = findByOwnerStatement.get(ownerKey);
        if (!row) return null;
        return { ownerKey: row.owner_key, windowsJson: row.windows_json, updatedAt: row.updated_at };
    }

    function upsert(ownerKey, windowsJson, updatedAt) {
        upsertStatement.run({ ownerKey, windowsJson, updatedAt });
        return find(ownerKey);
    }

    function remove(ownerKey) {
        return database.prepare('DELETE FROM window_sessions WHERE owner_key = ?').run(ownerKey).changes;
    }

    return { find, upsert, remove };
}

module.exports = { createSqliteSessionRepository };
