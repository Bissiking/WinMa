// src/server/services/workspace-service.js
// Espaces de travail nommés : la disposition courante du bureau vit dans
// window_sessions (synchro continue) ; un espace « actif » la représente et
// les bascules sauvegardent/chargent cette disposition entre espaces.
const { randomUUID } = require('node:crypto');
const { HttpError } = require('../utils/http-error');
const { sanitizeWindows } = require('./window-session-service');

const MAX_WORKSPACES = 20;
const MAX_NAME_LENGTH = 40;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeName(raw) {
    const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > MAX_NAME_LENGTH) {
        throw new HttpError(400, 'WORKSPACE_INVALID_NAME', `Le nom de l’espace doit contenir 1 à ${MAX_NAME_LENGTH} caractères.`);
    }
    return name;
}

function validWorkspaceId(raw) {
    const id = typeof raw === 'string' ? raw.trim() : '';
    if (!ID_PATTERN.test(id)) {
        throw new HttpError(400, 'WORKSPACE_ID_INVALID', 'Identifiant d’espace invalide.');
    }
    return id;
}

function parseWindows(json) {
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function createWorkspaceService({ workspaceRepository, windowSessionService }) {
    function present(row) {
        return {
            id: row.id,
            name: row.name,
            windowCount: parseWindows(row.windowsJson).length,
            isActive: row.isActive,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        };
    }

    async function assertAvailableName(ownerKey, name, exceptId = null) {
        const rows = await workspaceRepository.listByOwner(ownerKey);
        const clash = rows.some((row) => row.id !== exceptId && row.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'));
        if (clash) {
            throw new HttpError(409, 'WORKSPACE_NAME_TAKEN', `Un espace nommé « ${name} » existe déjà.`);
        }
    }

    async function resolveWindows(ownerKey, raw) {
        if (raw?.windows === undefined) {
            return (await windowSessionService.read(ownerKey)).windows;
        }
        return sanitizeWindows(raw.windows);
    }

    async function list(ownerKey) {
        const rows = await workspaceRepository.listByOwner(ownerKey);
        const active = rows.find((row) => row.isActive) || null;
        return { workspaces: rows.map(present), activeId: active ? active.id : null };
    }

    async function create(ownerKey, raw) {
        const rows = await workspaceRepository.listByOwner(ownerKey);
        if (rows.length >= MAX_WORKSPACES) {
            throw new HttpError(400, 'WORKSPACE_LIMIT_REACHED', `Vous ne pouvez pas détenir plus de ${MAX_WORKSPACES} espaces de travail.`);
        }
        const name = normalizeName(raw?.name);
        await assertAvailableName(ownerKey, name);
        const windows = await resolveWindows(ownerKey, raw);
        const now = new Date().toISOString();
        await workspaceRepository.clearActive(ownerKey);
        const created = await workspaceRepository.insert({
            id: randomUUID(),
            ownerKey,
            name,
            windowsJson: JSON.stringify(windows),
            isActive: true,
            createdAt: now,
            updatedAt: now
        });
        return present(created);
    }

    async function rename(ownerKey, rawId, raw) {
        const id = validWorkspaceId(rawId);
        const existing = await workspaceRepository.find(ownerKey, id);
        if (!existing) {
            throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
        }
        const name = normalizeName(raw?.name);
        await assertAvailableName(ownerKey, name, id);
        return present(await workspaceRepository.update(ownerKey, id, { name, updatedAt: new Date().toISOString() }));
    }

    async function saveLayout(ownerKey, rawId, raw) {
        const id = validWorkspaceId(rawId);
        const existing = await workspaceRepository.find(ownerKey, id);
        if (!existing) {
            throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
        }
        const windows = await resolveWindows(ownerKey, raw);
        return present(await workspaceRepository.update(ownerKey, id, {
            windowsJson: JSON.stringify(windows),
            updatedAt: new Date().toISOString()
        }));
    }

    async function activate(ownerKey, rawId) {
        const id = validWorkspaceId(rawId);
        const target = await workspaceRepository.find(ownerKey, id);
        if (!target) {
            throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
        }
        const current = await workspaceRepository.findActive(ownerKey);
        if (current && current.id === id) {
            return { ...present(target), layoutApplied: false };
        }
        // 1. La disposition courante est enregistrée dans l'espace actif.
        const { windows } = await windowSessionService.read(ownerKey);
        if (current) {
            await workspaceRepository.update(ownerKey, current.id, {
                windowsJson: JSON.stringify(windows),
                updatedAt: new Date().toISOString()
            });
        }
        // 2. La disposition de la cible devient la session courante.
        await windowSessionService.update(ownerKey, { windows: parseWindows(target.windowsJson) });
        // 3. La cible devient l'espace actif.
        const activated = await workspaceRepository.setActive(ownerKey, id);
        return { ...present(activated), layoutApplied: true };
    }

    async function remove(ownerKey, rawId) {
        const id = validWorkspaceId(rawId);
        const existing = await workspaceRepository.find(ownerKey, id);
        if (!existing) {
            throw new HttpError(404, 'WORKSPACE_NOT_FOUND', 'Espace de travail introuvable.');
        }
        if (existing.isActive) {
            throw new HttpError(409, 'WORKSPACE_ACTIVE_REMOVE', 'L’espace actif ne peut pas être supprimé : basculez d’abord vers un autre espace.');
        }
        const rows = await workspaceRepository.listByOwner(ownerKey);
        if (rows.length <= 1) {
            throw new HttpError(400, 'WORKSPACE_LAST_REMOVE', 'Le dernier espace de travail ne peut pas être supprimé.');
        }
        await workspaceRepository.remove(ownerKey, id);
        return { id, removed: true };
    }

    return { list, create, rename, saveLayout, activate, remove };
}

module.exports = { createWorkspaceService, MAX_WORKSPACES };
