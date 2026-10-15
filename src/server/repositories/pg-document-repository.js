// src/server/repositories/pg-document-repository.js
// Équivalent PostgreSQL de la métadonnée Documents — contrat asynchrone
// strictement identique à l'implémentation SQLite (mêmes valeurs retournées).
const { resolveDatabase, assertProvider } = require('./repository-database');

function createPgDocumentRepository(databaseOrPool) {
    const database = resolveDatabase(databaseOrPool);
    assertProvider(database, 'postgresql');

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

    function placeholders(count, offset = 0) {
        return Array.from({ length: count }, (_, index) => `$${index + 1 + offset}`).join(', ');
    }

    async function findById(ownerKey, id) {
        const row = (await database.query('SELECT * FROM document_items WHERE id = $1 AND owner_key = $2', [id, ownerKey])).rows[0];
        return map(row);
    }

    function typeCondition(type) {
        const prefixes = { image: 'image/%', video: 'video/%', audio: 'audio/%' };
        if (prefixes[type]) {
            return { sql: "AND kind = 'file' AND mime_type LIKE $2", params: [prefixes[type]] };
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

    async function list(ownerKey, { parentId = null, search = '', trash = false, type = null, recent = false } = {}) {
        if (trash) {
            const result = await database.query(`
                SELECT * FROM document_items
                WHERE owner_key = $1 AND trashed_at IS NOT NULL AND id = trash_root_id
                ORDER BY trashed_at DESC
            `, [ownerKey]);
            return result.rows.map(map);
        }
        if (recent) {
            const result = await database.query(`
                SELECT * FROM document_items
                WHERE owner_key = $1 AND trashed_at IS NULL AND kind = 'file'
                ORDER BY updated_at DESC
                LIMIT 50
            `, [ownerKey]);
            return result.rows.map(map);
        }
        if (search) {
            const result = await database.query(`
                SELECT * FROM document_items
                WHERE owner_key = $1 AND trashed_at IS NULL AND name LIKE $2 ESCAPE '\\'
                ORDER BY kind DESC, LOWER(name)
                LIMIT 200
            `, [ownerKey, `%${search.replace(/[\\%_]/g, '\\$&')}%`]);
            return result.rows.map(map);
        }
        const typeFilter = typeCondition(type);
        if (typeFilter) {
            const result = await database.query(`
                SELECT * FROM document_items
                WHERE owner_key = $1 AND trashed_at IS NULL ${typeFilter.sql}
                ORDER BY kind DESC, LOWER(name)
            `, [ownerKey, ...typeFilter.params]);
            return result.rows.map(map);
        }
        const result = await database.query(`
            SELECT * FROM document_items
            WHERE owner_key = $1 AND COALESCE(parent_id, '') = COALESCE($2, '') AND trashed_at IS NULL
            ORDER BY kind DESC, LOWER(name)
        `, [ownerKey, parentId]);
        return result.rows.map(map);
    }

    async function ancestors(ownerKey, id) {
        const result = await database.query(`
            WITH RECURSIVE lineage(id, parent_id, name, depth) AS (
                SELECT id, parent_id, name, 0 FROM document_items WHERE id = $1 AND owner_key = $2
                UNION ALL
                SELECT item.id, item.parent_id, item.name, lineage.depth + 1
                FROM document_items item JOIN lineage ON item.id = lineage.parent_id
                WHERE item.owner_key = $3
            ) SELECT id, parent_id AS "parentId", name FROM lineage ORDER BY depth DESC
        `, [id, ownerKey, ownerKey]);
        return result.rows;
    }

    async function folders(ownerKey) {
        const result = await database.query(`
            SELECT id, parent_id, name FROM document_items
            WHERE owner_key = $1 AND kind = 'folder' AND trashed_at IS NULL
            ORDER BY LOWER(name)
        `, [ownerKey]);
        return result.rows.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name }));
    }

    async function hasNameConflict(ownerKey, parentId, name, excludeId = null) {
        const result = await database.query(`
            SELECT id FROM document_items
            WHERE owner_key = $1
              AND COALESCE(parent_id, '') = COALESCE($2, '')
              AND trashed_at IS NULL
              AND LOWER(name) = LOWER($3)
              AND id != COALESCE($4, '')
            LIMIT 1
        `, [ownerKey, parentId, name, excludeId]);
        return Boolean(result.rows[0]);
    }

    async function insert(ownerKey, item) {
        await database.query(`
            INSERT INTO document_items (id, owner_key, parent_id, kind, name, mime_type, size, storage_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
            item.id, ownerKey, item.parentId, item.kind, item.name,
            item.mimeType, item.size, item.storageName, item.createdAt, item.updatedAt
        ]);
        return findById(ownerKey, item.id);
    }

    async function update(ownerKey, id, changes) {
        await database.query(
            `UPDATE document_items SET name = $1, parent_id = $2, updated_at = $3 WHERE id = $4 AND owner_key = $5 AND trashed_at IS NULL`,
            [changes.name, changes.parentId, changes.updatedAt, id, ownerKey]
        );
        return findById(ownerKey, id);
    }

    async function updateFileMetadata(ownerKey, id, changes) {
        await database.query(
            `UPDATE document_items SET size = $1, updated_at = $2 WHERE id = $3 AND owner_key = $4 AND kind = 'file' AND trashed_at IS NULL`,
            [changes.size, changes.updatedAt, id, ownerKey]
        );
        return findById(ownerKey, id);
    }

    async function contains(ownerKey, rootId, possibleDescendantId) {
        const result = await database.query(`
            WITH RECURSIVE subtree(id) AS (
                SELECT id FROM document_items WHERE id = $1 AND owner_key = $2
                UNION ALL
                SELECT item.id FROM document_items item JOIN subtree ON item.parent_id = subtree.id WHERE item.owner_key = $3
            ) SELECT id FROM subtree WHERE id = $4 LIMIT 1
        `, [rootId, ownerKey, ownerKey, possibleDescendantId]);
        return Boolean(result.rows[0]);
    }

    async function trash(ownerKey, ids, timestamp) {
        await database.transaction(async (trx) => {
            const sql = `
                WITH RECURSIVE subtree(id) AS (
                    SELECT id FROM document_items WHERE id = $1 AND owner_key = $2 AND trashed_at IS NULL
                    UNION ALL
                    SELECT item.id FROM document_items item JOIN subtree ON item.parent_id = subtree.id WHERE item.owner_key = $2
                ) UPDATE document_items SET trashed_at = $3, trash_root_id = $1, updated_at = $3 WHERE id IN (SELECT id FROM subtree)
            `;
            for (const id of ids) {
                await trx.query(sql, [id, ownerKey, timestamp]);
            }
        });
    }

    async function restore(ownerKey, ids, timestamp) {
        const result = await database.query(
            `UPDATE document_items SET trashed_at = NULL, trash_root_id = NULL, updated_at = $1 WHERE owner_key = $2 AND trash_root_id IN (${placeholders(ids.length, 2)})`,
            [timestamp, ownerKey, ...ids]
        );
        return result.rowCount;
    }

    async function filesForTrashRoots(ownerKey, ids) {
        const result = await database.query(
            `SELECT storage_name AS "storageName" FROM document_items WHERE owner_key = $1 AND kind = 'file' AND trash_root_id IN (${placeholders(ids.length, 1)})`,
            [ownerKey, ...ids]
        );
        return result.rows;
    }

    async function permanentlyDelete(ownerKey, ids) {
        const result = await database.query(
            `DELETE FROM document_items WHERE owner_key = $1 AND trash_root_id IN (${placeholders(ids.length, 1)})`,
            [ownerKey, ...ids]
        );
        return result.rowCount;
    }

    async function expiredTrash(cutoff) {
        const result = await database.query(
            `SELECT owner_key AS "ownerKey", id FROM document_items WHERE trashed_at IS NOT NULL AND id = trash_root_id AND trashed_at <= $1`,
            [cutoff]
        );
        return result.rows;
    }

    async function usedBytes(ownerKey) {
        const row = (await database.query(
            "SELECT COALESCE(SUM(size), 0) AS total FROM document_items WHERE owner_key = $1 AND kind = 'file'",
            [ownerKey]
        )).rows[0];
        return row.total;
    }

    async function statsByType(ownerKey) {
        const order = ['image', 'video', 'audio', 'document', 'other'];
        const categories = (await database.query(`
            SELECT
                CASE
                    WHEN mime_type LIKE 'image/%' THEN 'image'
                    WHEN mime_type LIKE 'video/%' THEN 'video'
                    WHEN mime_type LIKE 'audio/%' THEN 'audio'
                    WHEN mime_type LIKE 'text/%'
                        OR mime_type IN (
                            'application/pdf', 'application/rtf', 'application/msword',
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                        ) THEN 'document'
                    ELSE 'other'
                END AS category,
                COUNT(*) AS "count",
                COALESCE(SUM(size), 0) AS bytes
            FROM document_items
            WHERE owner_key = $1 AND kind = 'file' AND trashed_at IS NULL
            GROUP BY category
        `, [ownerKey])).rows
            .map((row) => ({ category: row.category, count: row.count, bytes: row.bytes }))
            .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

        const trash = (await database.query(`
            SELECT COUNT(*) AS "count", COALESCE(SUM(size), 0) AS bytes
            FROM document_items
            WHERE owner_key = $1 AND kind = 'file' AND trashed_at IS NOT NULL
        `, [ownerKey])).rows[0];

        return { categories, trash: { count: trash.count, bytes: trash.bytes } };
    }

    return {
        findById, list, ancestors, folders, hasNameConflict, insert, update, updateFileMetadata,
        contains, trash, restore, filesForTrashRoots, permanentlyDelete, expiredTrash, usedBytes, statsByType,
        database
    };
}

module.exports = { createPgDocumentRepository };
