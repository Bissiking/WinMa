const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const QUOTA_BYTES = 1024 * 1024 * 1024;
const TRASH_RETENTION_DAYS = 30;

function ownerKey(subject) {
    return crypto.createHash('sha256').update(subject).digest('hex');
}

function validName(value) {
    if (typeof value !== 'string') throw new HttpError(400, 'DOCUMENT_NAME_INVALID', 'Le nom est requis.');
    const name = value.trim();
    if (!name || name.length > 180 || /[\u0000-\u001f/\\]/.test(name) || name === '.' || name === '..') {
        throw new HttpError(400, 'DOCUMENT_NAME_INVALID', 'Le nom contient des caractères interdits ou dépasse 180 caractères.');
    }
    return name;
}

function validId(value, field = 'identifiant') {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
        throw new HttpError(400, 'DOCUMENT_ID_INVALID', `L’${field} est invalide.`);
    }
    return value;
}

function validIds(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100) {
        throw new HttpError(400, 'DOCUMENT_SELECTION_INVALID', 'Sélectionnez entre 1 et 100 éléments.');
    }
    return [...new Set(value.map((id) => validId(id)))];
}

function createDocumentService({ repository, storageRoot }) {
    async function ensureParent(key, parentId) {
        if (!parentId) return null;
        const parent = repository.findById(key, validId(parentId, 'identifiant du dossier'));
        if (!parent || parent.kind !== 'folder' || parent.trashedAt) {
            throw new HttpError(404, 'DOCUMENT_PARENT_NOT_FOUND', 'Le dossier de destination est introuvable.');
        }
        return parent;
    }

    function quota(key) {
        const usedBytes = repository.usedBytes(key);
        return { usedBytes, quotaBytes: QUOTA_BYTES, availableBytes: Math.max(0, QUOTA_BYTES - usedBytes) };
    }

    function getQuota(subject) {
        return quota(ownerKey(subject));
    }

    async function list(subject, query = {}) {
        await purgeExpired();
        const key = ownerKey(subject);
        const parentId = validId(query.parentId, 'identifiant du dossier');
        const trash = query.trash === true || query.trash === 'true';
        const search = typeof query.search === 'string' ? query.search.trim().slice(0, 120) : '';
        if (parentId && !trash && !search) await ensureParent(key, parentId);
        return {
            items: repository.list(key, { parentId, search, trash }),
            breadcrumbs: parentId && !trash ? repository.ancestors(key, parentId) : [],
            storage: quota(key),
            retentionDays: TRASH_RETENTION_DAYS
        };
    }

    async function createFolder(subject, input) {
        const key = ownerKey(subject);
        const name = validName(input?.name);
        const parentId = validId(input?.parentId, 'identifiant du dossier');
        await ensureParent(key, parentId);
        if (repository.hasNameConflict(key, parentId, name)) {
            throw new HttpError(409, 'DOCUMENT_NAME_CONFLICT', 'Un élément porte déjà ce nom dans ce dossier.');
        }
        const now = new Date().toISOString();
        return repository.insert(key, {
            id: crypto.randomUUID(), parentId, kind: 'folder', name,
            mimeType: null, size: 0, storageName: null, createdAt: now, updatedAt: now
        });
    }

    function listFolders(subject) {
        return [{ id: null, parentId: null, name: 'Mes fichiers' }, ...repository.folders(ownerKey(subject))];
    }

    async function upload(subject, input, file) {
        if (!file) throw new HttpError(400, 'DOCUMENT_FILE_REQUIRED', 'Choisissez un fichier à importer.');
        const key = ownerKey(subject);
        try {
            const parentId = validId(input?.parentId, 'identifiant du dossier');
            await ensureParent(key, parentId);
            const name = validName(file.originalname);
            if (repository.hasNameConflict(key, parentId, name)) {
                throw new HttpError(409, 'DOCUMENT_NAME_CONFLICT', 'Un élément porte déjà ce nom dans ce dossier.');
            }
            const storage = quota(key);
            if (file.size > storage.availableBytes) {
                throw new HttpError(413, 'DOCUMENT_QUOTA_EXCEEDED', 'Ce fichier dépasse l’espace disponible de 1 Go. Videz la Corbeille ou supprimez des fichiers.');
            }
            const userDirectory = path.join(storageRoot, key);
            const storageName = crypto.randomUUID();
            const destination = path.join(userDirectory, storageName);
            await fs.mkdir(userDirectory, { recursive: true, mode: 0o700 });
            try {
                await fs.rename(file.path, destination);
            } catch (error) {
                if (error.code !== 'EXDEV') throw error;
                await fs.copyFile(file.path, destination);
                await fs.unlink(file.path);
            }
            const now = new Date().toISOString();
            try {
                return repository.insert(key, {
                    id: crypto.randomUUID(), parentId, kind: 'file', name,
                    mimeType: file.mimetype || 'application/octet-stream', size: file.size,
                    storageName, createdAt: now, updatedAt: now
                });
            } catch (error) {
                await fs.rm(destination, { force: true });
                throw error;
            }
        } finally {
            if (file.path) await fs.rm(file.path, { force: true }).catch(() => {});
        }
    }

    async function update(subject, id, input) {
        const key = ownerKey(subject);
        const item = repository.findById(key, validId(id));
        if (!item || item.trashedAt) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Cet élément est introuvable.');
        const name = input.name === undefined ? item.name : validName(input.name);
        const parentId = input.parentId === undefined ? item.parentId : validId(input.parentId, 'identifiant du dossier');
        await ensureParent(key, parentId);
        if (item.kind === 'folder' && parentId && repository.contains(key, item.id, parentId)) {
            throw new HttpError(409, 'DOCUMENT_MOVE_CYCLE', 'Un dossier ne peut pas être déplacé dans lui-même.');
        }
        if (repository.hasNameConflict(key, parentId, name, item.id)) {
            throw new HttpError(409, 'DOCUMENT_NAME_CONFLICT', 'Un élément porte déjà ce nom dans le dossier de destination.');
        }
        return repository.update(key, item.id, { name, parentId, updatedAt: new Date().toISOString() });
    }

    async function trash(subject, rawIds) {
        const key = ownerKey(subject);
        const ids = validIds(rawIds);
        ids.forEach((id) => {
            const item = repository.findById(key, id);
            if (!item || item.trashedAt) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Un élément sélectionné est introuvable.');
        });
        repository.trash(key, ids, new Date().toISOString());
        return { count: ids.length, retentionDays: TRASH_RETENTION_DAYS };
    }

    async function restore(subject, rawIds) {
        const key = ownerKey(subject);
        const ids = validIds(rawIds);
        ids.forEach((id) => {
            const item = repository.findById(key, id);
            if (!item || !item.trashedAt || item.trashRootId !== item.id) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Un élément sélectionné n’est plus dans la Corbeille.');
        });
        repository.restore(key, ids, new Date().toISOString());
        return { count: ids.length };
    }

    async function permanentlyDeleteByKey(key, ids) {
        const files = repository.filesForTrashRoots(key, ids);
        await Promise.all(files.map((file) => fs.rm(path.join(storageRoot, key, file.storageName), { force: true })));
        return repository.permanentlyDelete(key, ids);
    }

    async function permanentlyDelete(subject, rawIds) {
        const key = ownerKey(subject);
        const ids = validIds(rawIds);
        ids.forEach((id) => {
            const item = repository.findById(key, id);
            if (!item || !item.trashedAt || item.trashRootId !== item.id) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Un élément sélectionné n’est plus dans la Corbeille.');
        });
        return { count: await permanentlyDeleteByKey(key, ids) };
    }

    async function emptyTrash(subject) {
        const key = ownerKey(subject);
        const ids = repository.list(key, { trash: true }).map((item) => item.id);
        if (!ids.length) return { count: 0 };
        return { count: await permanentlyDeleteByKey(key, ids) };
    }

    async function download(subject, id) {
        const key = ownerKey(subject);
        const item = repository.findById(key, validId(id));
        if (!item || item.kind !== 'file' || item.trashedAt) throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Ce fichier est introuvable.');
        return { item, path: path.join(storageRoot, key, item.storageName) };
    }

    async function purgeExpired() {
        const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const expired = repository.expiredTrash(cutoff);
        let count = 0;
        for (const item of expired) count += await permanentlyDeleteByKey(item.ownerKey, [item.id]);
        return count;
    }

    return { list, listFolders, getQuota, createFolder, upload, update, trash, restore, permanentlyDelete, emptyTrash, download, purgeExpired, quotaBytes: QUOTA_BYTES };
}

module.exports = { createDocumentService, QUOTA_BYTES, TRASH_RETENTION_DAYS, ownerKey };
