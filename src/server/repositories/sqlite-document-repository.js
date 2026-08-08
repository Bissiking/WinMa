const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function createSqliteDocumentRepository(databasePath) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    const database = new Database(databasePath);
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    database.exec(`
        CREATE TABLE IF NOT EXISTS document_items (
            id TEXT PRIMARY KEY,
            owner_key TEXT NOT NULL,
            parent_id TEXT REFERENCES document_items(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
            name TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER NOT NULL DEFAULT 0 CHECK (size >= 0),
            storage_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            trashed_at TEXT,
            trash_root_id TEXT
        );
        CREATE INDEX IF NOT EXISTS document_items_owner_parent ON document_items(owner_key, parent_id, trashed_at);
        CREATE INDEX IF NOT EXISTS document_items_owner_trash ON document_items(owner_key, trash_root_id, trashed_at);
    `);

    const findByIdStatement = database.prepare('SELECT * FROM document_items WHERE id = ? AND owner_key = ?');
    const nameConflictStatement = database.prepare(`
        SELECT id FROM document_items
        WHERE owner_key = @ownerKey
          AND COALESCE(parent_id, '') = COALESCE(@parentId, '')
          AND trashed_at IS NULL
          AND name = @name COLLATE NOCASE
          AND id != COALESCE(@excludeId, '')
        LIMIT 1
    `);

    function map(row) {
        if (!row) return null;
        return {
            id: row.id,
            parentId: row.parent_id,
            kind: row.kind,
            name: row.name,
            mimeType: row.mime_type,
            size: row.size,
            storageName: row.storage_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            trashedAt: row.trashed_at,
            trashRootId: row.trash_root_id
        };
    }

    function findById(ownerKey, id) { return map(findByIdStatement.get(id, ownerKey)); }

    function typeCondition(type) {
        const prefixes = { image: 'image/%', video: 'video/%', audio: 'audio/%' };
        if (prefixes[type]) {
            return { sql: "AND kind = 'file' AND mime_type LIKE ?", params: [prefixes[type]] };
        }
        if (type === 'document') {
            return {
                sql: `AND kind = 'file' AND (mime_type LIKE 'text/%'
                    OR mime_type IN (
                        'application/pdf', 'application/rtf', 'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                    ))`,
                params: []
            };
        }
        return null;
    }

    function list(ownerKey, { parentId = null, search = '', trash = false, type = null } = {}) {
        if (trash) {
            return database.prepare(`
                SELECT * FROM document_items
                WHERE owner_key = ? AND trashed_at IS NOT NULL AND id = trash_root_id
                ORDER BY trashed_at DESC
            `).all(ownerKey).map(map);
        }
        if (search) {
            return database.prepare(`
                SELECT * FROM document_items
                WHERE owner_key = ? AND trashed_at IS NULL AND name LIKE ? ESCAPE '\\'
                ORDER BY kind DESC, name COLLATE NOCASE
                LIMIT 200
            `).all(ownerKey, `%${search.replace(/[\\%_]/g, '\\$&')}%`).map(map);
        }
        const typeFilter = typeCondition(type);
        if (typeFilter) {
            return database.prepare(`
                SELECT * FROM document_items
                WHERE owner_key = ? AND trashed_at IS NULL ${typeFilter.sql}
                ORDER BY kind DESC, name COLLATE NOCASE
            `).all(ownerKey, ...typeFilter.params).map(map);
        }
        return database.prepare(`
            SELECT * FROM document_items
            WHERE owner_key = ? AND COALESCE(parent_id, '') = COALESCE(?, '') AND trashed_at IS NULL
            ORDER BY kind DESC, name COLLATE NOCASE
        `).all(ownerKey, parentId).map(map);
    }

    function ancestors(ownerKey, id) {
        return database.prepare(`
            WITH RECURSIVE lineage(id, parent_id, name, depth) AS (
                SELECT id, parent_id, name, 0 FROM document_items WHERE id = ? AND owner_key = ?
                UNION ALL
                SELECT item.id, item.parent_id, item.name, lineage.depth + 1
                FROM document_items item JOIN lineage ON item.id = lineage.parent_id
                WHERE item.owner_key = ?
            ) SELECT id, parent_id AS parentId, name FROM lineage ORDER BY depth DESC
        `).all(id, ownerKey, ownerKey);
    }

    function folders(ownerKey) {
        return database.prepare(`
            SELECT id, parent_id, name FROM document_items
            WHERE owner_key = ? AND kind = 'folder' AND trashed_at IS NULL
            ORDER BY name COLLATE NOCASE
        `).all(ownerKey).map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name }));
    }

    function hasNameConflict(ownerKey, parentId, name, excludeId = null) {
        return Boolean(nameConflictStatement.get({ ownerKey, parentId, name, excludeId }));
    }

    function insert(ownerKey, item) {
        database.prepare(`
            INSERT INTO document_items (id, owner_key, parent_id, kind, name, mime_type, size, storage_name, created_at, updated_at)
            VALUES (@id, @ownerKey, @parentId, @kind, @name, @mimeType, @size, @storageName, @createdAt, @updatedAt)
        `).run({ ownerKey, ...item });
        return findById(ownerKey, item.id);
    }

    function update(ownerKey, id, changes) {
        database.prepare(`UPDATE document_items SET name = @name, parent_id = @parentId, updated_at = @updatedAt WHERE id = @id AND owner_key = @ownerKey AND trashed_at IS NULL`)
            .run({ ownerKey, id, ...changes });
        return findById(ownerKey, id);
    }

    function updateFileMetadata(ownerKey, id, changes) {
        database.prepare(`UPDATE document_items SET size = @size, updated_at = @updatedAt WHERE id = @id AND owner_key = @ownerKey AND kind = 'file' AND trashed_at IS NULL`)
            .run({ ownerKey, id, ...changes });
        return findById(ownerKey, id);
    }

    function contains(ownerKey, rootId, possibleDescendantId) {
        return Boolean(database.prepare(`
            WITH RECURSIVE subtree(id) AS (
                SELECT id FROM document_items WHERE id = ? AND owner_key = ?
                UNION ALL
                SELECT item.id FROM document_items item JOIN subtree ON item.parent_id = subtree.id WHERE item.owner_key = ?
            ) SELECT id FROM subtree WHERE id = ? LIMIT 1
        `).get(rootId, ownerKey, ownerKey, possibleDescendantId));
    }

    const trashTransaction = database.transaction((ownerKey, ids, timestamp) => {
        const statement = database.prepare(`
            WITH RECURSIVE subtree(id) AS (
                SELECT id FROM document_items WHERE id = @id AND owner_key = @ownerKey AND trashed_at IS NULL
                UNION ALL
                SELECT item.id FROM document_items item JOIN subtree ON item.parent_id = subtree.id WHERE item.owner_key = @ownerKey
            ) UPDATE document_items SET trashed_at = @timestamp, trash_root_id = @id, updated_at = @timestamp WHERE id IN (SELECT id FROM subtree)
        `);
        ids.forEach((id) => statement.run({ ownerKey, id, timestamp }));
    });

    function trash(ownerKey, ids, timestamp) { trashTransaction(ownerKey, ids, timestamp); }

    function restore(ownerKey, ids, timestamp) {
        const placeholders = ids.map(() => '?').join(',');
        database.prepare(`UPDATE document_items SET trashed_at = NULL, trash_root_id = NULL, updated_at = ? WHERE owner_key = ? AND trash_root_id IN (${placeholders})`)
            .run(timestamp, ownerKey, ...ids);
    }

    function filesForTrashRoots(ownerKey, ids) {
        const placeholders = ids.map(() => '?').join(',');
        return database.prepare(`SELECT storage_name AS storageName FROM document_items WHERE owner_key = ? AND kind = 'file' AND trash_root_id IN (${placeholders})`)
            .all(ownerKey, ...ids);
    }

    function permanentlyDelete(ownerKey, ids) {
        const placeholders = ids.map(() => '?').join(',');
        return database.prepare(`DELETE FROM document_items WHERE owner_key = ? AND trash_root_id IN (${placeholders})`).run(ownerKey, ...ids).changes;
    }

    function expiredTrash(cutoff) {
        return database.prepare(`SELECT owner_key AS ownerKey, id FROM document_items WHERE trashed_at IS NOT NULL AND id = trash_root_id AND trashed_at <= ?`).all(cutoff);
    }

    function usedBytes(ownerKey) {
        return database.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM document_items WHERE owner_key = ? AND kind = 'file'").get(ownerKey).total;
    }

    return { findById, list, ancestors, folders, hasNameConflict, insert, update, updateFileMetadata, contains, trash, restore, filesForTrashRoots, permanentlyDelete, expiredTrash, usedBytes };
}

module.exports = { createSqliteDocumentRepository };
