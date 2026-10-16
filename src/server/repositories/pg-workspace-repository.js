// src/server/repositories/pg-workspace-repository.js
// Équivalent PostgreSQL des espaces de travail — contrat identique.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createPgWorkspaceRepository(databaseOrPool) {
    const database = resolveDatabase(databaseOrPool);
    assertProvider(database, 'postgresql');

    function mapRow(row) {
        if (!row) return null;
        return {
            id: row.id,
            ownerKey: row.owner_key,
            name: row.name,
            windowsJson: row.windows_json,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async function listByOwner(ownerKey) {
        const rows = await database.query('SELECT * FROM workspaces WHERE owner_key = $1 ORDER BY name, id', [ownerKey]);
        return rows.rows.map(mapRow);
    }

    async function find(ownerKey, id) {
        const row = (await database.query('SELECT * FROM workspaces WHERE owner_key = $1 AND id = $2', [ownerKey, id])).rows[0];
        return mapRow(row);
    }

    async function findActive(ownerKey) {
        const row = (await database.query('SELECT * FROM workspaces WHERE owner_key = $1 AND is_active = TRUE', [ownerKey])).rows[0];
        return mapRow(row);
    }

    async function insert({ id, ownerKey, name, windowsJson, isActive, createdAt, updatedAt }) {
        await database.query(`
            INSERT INTO workspaces (id, owner_key, name, windows_json, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, ownerKey, name, windowsJson, Boolean(isActive), createdAt, updatedAt]);
        return find(ownerKey, id);
    }

    async function update(ownerKey, id, patch = {}) {
        const sets = [];
        const params = [ownerKey, id];
        if (typeof patch.name === 'string') { sets.push(`name = $${params.length + 1}`); params.push(patch.name); }
        if (typeof patch.windowsJson === 'string') { sets.push(`windows_json = $${params.length + 1}`); params.push(patch.windowsJson); }
        if (typeof patch.updatedAt === 'string') { sets.push(`updated_at = $${params.length + 1}`); params.push(patch.updatedAt); }
        if (sets.length) {
            await database.query(`UPDATE workspaces SET ${sets.join(', ')} WHERE owner_key = $1 AND id = $2`, params);
        }
        return find(ownerKey, id);
    }

    async function setActive(ownerKey, id) {
        await database.query('UPDATE workspaces SET is_active = FALSE WHERE owner_key = $1', [ownerKey]);
        await database.query('UPDATE workspaces SET is_active = TRUE WHERE owner_key = $1 AND id = $2', [ownerKey, id]);
        return find(ownerKey, id);
    }

    async function clearActive(ownerKey) {
        await database.query('UPDATE workspaces SET is_active = FALSE WHERE owner_key = $1', [ownerKey]);
    }

    async function remove(ownerKey, id) {
        const result = await database.query('DELETE FROM workspaces WHERE owner_key = $1 AND id = $2', [ownerKey, id]);
        return result.rowCount;
    }

    return { listByOwner, find, findActive, insert, update, setActive, clearActive, remove, database };
}

module.exports = { createPgWorkspaceRepository };
