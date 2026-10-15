// src/server/repositories/sqlite-workspace-repository.js
// Espaces de travail nommés par utilisateur — contrat asynchrone.
// Schéma : migrations/0005_user_workspaces.sqlite.sql.
const { resolveDatabase, assertProvider } = require('./repository-database');

function createSqliteWorkspaceRepository(databaseOrPath) {
    const database = resolveDatabase(databaseOrPath);
    assertProvider(database, 'sqlite');

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
        const rows = await database.query('SELECT * FROM workspaces WHERE owner_key = ? ORDER BY name COLLATE NOCASE, id', [ownerKey]);
        return rows.rows.map(mapRow);
    }

    async function find(ownerKey, id) {
        const row = (await database.query('SELECT * FROM workspaces WHERE owner_key = ? AND id = ?', [ownerKey, id])).rows[0];
        return mapRow(row);
    }

    async function findActive(ownerKey) {
        const row = (await database.query('SELECT * FROM workspaces WHERE owner_key = ? AND is_active = 1', [ownerKey])).rows[0];
        return mapRow(row);
    }

    async function insert({ id, ownerKey, name, windowsJson, isActive, createdAt, updatedAt }) {
        await database.query(`
            INSERT INTO workspaces (id, owner_key, name, windows_json, is_active, created_at, updated_at)
            VALUES (@id, @ownerKey, @name, @windowsJson, @isActive, @createdAt, @updatedAt)
        `, { id, ownerKey, name, windowsJson, isActive: isActive ? 1 : 0, createdAt, updatedAt });
        return find(ownerKey, id);
    }

    async function update(ownerKey, id, patch = {}) {
        const sets = [];
        const params = { ownerKey, id };
        if (typeof patch.name === 'string') { sets.push('name = @name'); params.name = patch.name; }
        if (typeof patch.windowsJson === 'string') { sets.push('windows_json = @windowsJson'); params.windowsJson = patch.windowsJson; }
        if (typeof patch.updatedAt === 'string') { sets.push('updated_at = @updatedAt'); params.updatedAt = patch.updatedAt; }
        if (sets.length) {
            await database.query(`UPDATE workspaces SET ${sets.join(', ')} WHERE owner_key = @ownerKey AND id = @id`, params);
        }
        return find(ownerKey, id);
    }

    async function setActive(ownerKey, id) {
        await database.query('UPDATE workspaces SET is_active = 0 WHERE owner_key = ?', [ownerKey]);
        await database.query('UPDATE workspaces SET is_active = 1 WHERE owner_key = ? AND id = ?', [ownerKey, id]);
        return find(ownerKey, id);
    }

    async function clearActive(ownerKey) {
        await database.query('UPDATE workspaces SET is_active = 0 WHERE owner_key = ?', [ownerKey]);
    }

    async function remove(ownerKey, id) {
        const result = await database.query('DELETE FROM workspaces WHERE owner_key = ? AND id = ?', [ownerKey, id]);
        return result.rowCount;
    }

    return { listByOwner, find, findActive, insert, update, setActive, clearActive, remove, database };
}

module.exports = { createSqliteWorkspaceRepository };
