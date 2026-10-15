// src/server/services/backup-service.js
// Export, import et réinitialisation ciblée des données personnelles.
// Périmètre serveur : paramètres, préférences de compte, disposition des
// fenêtres et notes (documents texte). Les fichiers binaires (images, vidéos…)
// restent côté serveur et ne sont pas embarqués dans l'export JSON.
const { HttpError } = require('../utils/http-error');
const { DEFAULT_SETTINGS } = require('./settings-service');
const { DEFAULT_ACCOUNT } = require('./account-service');

const BACKUP_FORMAT = 'luma-backup';
const BACKUP_SCHEMA_VERSION = 1;
const MAX_NOTES = 500;
const MAX_NOTE_BYTES = 1024 * 1024;
const MAX_NOTES_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_PATH_DEPTH = 8;
const RESET_TARGETS = new Set(['settings', 'account', 'windows', 'notes']);
const ACCOUNT_FIELDS = new Set(Object.keys(DEFAULT_ACCOUNT));

function isTextItem(item) {
    return item?.mimeType?.startsWith('text/') || /\.(?:md|markdown|txt)$/i.test(item?.name || '');
}

function validNotePath(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 500) {
        throw new HttpError(400, 'BACKUP_NOTE_PATH_INVALID', 'Chaque note doit porter un chemin valide.');
    }
    const segments = value.split('/');
    if (segments.length > MAX_PATH_DEPTH || segments.some((segment) =>
        !segment || segment === '.' || segment === '..' || /[\u0000-\u001f/\\]/.test(segment) || segment.length > 180
    )) {
        throw new HttpError(400, 'BACKUP_NOTE_PATH_INVALID', 'Un chemin de note dépasse la profondeur autorisée ou contient des caractères interdits.');
    }
    return segments;
}

function validateNotes(rawNotes) {
    if (!Array.isArray(rawNotes)) {
        throw new HttpError(400, 'BACKUP_NOTES_INVALID', 'Les notes doivent former une liste.');
    }
    if (rawNotes.length > MAX_NOTES) {
        throw new HttpError(400, 'BACKUP_NOTES_TOO_MANY', `Une sauvegarde ne peut pas contenir plus de ${MAX_NOTES} notes.`);
    }
    let totalBytes = 0;
    return rawNotes.map((note, index) => {
        if (!note || typeof note !== 'object' || Array.isArray(note)) {
            throw new HttpError(400, 'BACKUP_NOTES_INVALID', `La note n° ${index + 1} est invalide.`);
        }
        const segments = validNotePath(note.path);
        if (typeof note.content !== 'string') {
            throw new HttpError(400, 'BACKUP_NOTES_INVALID', `Le contenu de la note « ${segments[segments.length - 1]} » est invalide.`);
        }
        const size = Buffer.byteLength(note.content, 'utf8');
        if (size > MAX_NOTE_BYTES) {
            throw new HttpError(400, 'BACKUP_NOTES_TOO_LARGE', `La note « ${segments[segments.length - 1]} » dépasse 1 Mo.`);
        }
        totalBytes += size;
        if (totalBytes > MAX_NOTES_TOTAL_BYTES) {
            throw new HttpError(400, 'BACKUP_NOTES_TOO_LARGE', 'Les notes dépassent 5 Mo au total.');
        }
        return { segments, content: note.content };
    });
}

function createBackupService({ settingsService, accountService, windowSessionService, documentService, version = 'dev' }) {
    // Traversée récursive des documents : renvoie les fichiers texte avec leur
    // chemin relatif (« Dossier/Sous-dossier/note.md »).
    async function collectNotes(subject) {
        const notes = [];
        const paths = new Map([[null, '']]);
        const queue = [null];
        while (queue.length) {
            const parentId = queue.shift();
            const { items } = await documentService.list(subject, { parentId });
            for (const item of items) {
                if (item.trashedAt) continue;
                const basePath = paths.get(parentId);
                if (item.kind === 'folder') {
                    paths.set(item.id, `${basePath}${basePath ? '/' : ''}${item.name}`);
                    queue.push(item.id);
                    continue;
                }
                if (!isTextItem(item)) continue;
                if (notes.length >= MAX_NOTES) {
                    throw new HttpError(413, 'BACKUP_NOTES_TOO_MANY', `Trop de notes texte : l'export est limité à ${MAX_NOTES} documents.`);
                }
                const { content } = await documentService.readText(subject, item.id);
                notes.push({ path: `${basePath}${basePath ? '/' : ''}${item.name}`, content });
            }
        }
        return notes;
    }

    async function exportBackup(user) {
        const account = await accountService.read(user.id);
        const { lastProfileSync, ...accountFields } = account;
        return {
            format: BACKUP_FORMAT,
            schemaVersion: BACKUP_SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            version,
            server: {
                settings: await settingsService.read(user.id),
                account: accountFields,
                windows: (await windowSessionService.read(user.id)).windows,
                notes: await collectNotes(user.id)
            }
        };
    }

    async function findByFolderAndName(subject, parentId, name) {
        const { items } = await documentService.list(subject, { parentId });
        return items.find((item) => item.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr')) || null;
    }

    async function findOrCreateFolder(subject, parentId, name) {
        const existing = await findByFolderAndName(subject, parentId, name);
        if (existing) {
            if (existing.kind !== 'folder') {
                throw new HttpError(409, 'BACKUP_PATH_CONFLICT', `« ${name} » existe déjà comme fichier : le dossier ne peut pas être restauré.`);
            }
            return existing.id;
        }
        return (await documentService.createFolder(subject, { name, parentId })).id;
    }

    async function restoreNote(subject, segments, content) {
        const name = segments[segments.length - 1];
        let parentId = null;
        for (const segment of segments.slice(0, -1)) {
            parentId = await findOrCreateFolder(subject, parentId, segment);
        }
        const existing = await findByFolderAndName(subject, parentId, name);
        if (existing) {
            if (existing.kind !== 'file') {
                throw new HttpError(409, 'BACKUP_PATH_CONFLICT', `Le dossier « ${name} » entre en conflit avec une note.`);
            }
            if (!isTextItem(existing)) {
                throw new HttpError(409, 'BACKUP_PATH_CONFLICT', `Le fichier binaire « ${name} » n'est pas écrasé par la restauration.`);
            }
            await documentService.saveText(subject, existing.id, { content });
            return 'updated';
        }
        await documentService.createText(subject, { name, parentId, content });
        return 'created';
    }

    async function importBackup(user, payload) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new HttpError(400, 'BACKUP_INVALID', 'La sauvegarde doit être un objet JSON.');
        }
        if (payload.format !== BACKUP_FORMAT) {
            throw new HttpError(400, 'BACKUP_INVALID', 'Ce fichier n’est pas une sauvegarde Luma OS.');
        }
        if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
            throw new HttpError(400, 'BACKUP_VERSION_UNSUPPORTED', `Version de sauvegarde non prise en charge (${payload.schemaVersion}).`);
        }
        const server = payload.server;
        if (!server || typeof server !== 'object' || Array.isArray(server)) {
            throw new HttpError(400, 'BACKUP_INVALID', 'La sauvegarde ne contient aucune section serveur.');
        }

        const result = { settings: false, account: false, windows: false, notes: { created: 0, updated: 0 } };

        if (server.settings !== undefined) {
            // Import complet : les champs absents du fichier reviennent aux
            // défauts ; toute clé inconnue est refusée par le validateur.
            await settingsService.update(user.id, { ...DEFAULT_SETTINGS, ...server.settings });
            result.settings = true;
        }
        if (server.account !== undefined) {
            const account = server.account;
            if (!account || typeof account !== 'object' || Array.isArray(account)) {
                throw new HttpError(400, 'BACKUP_INVALID', 'Les préférences de compte de la sauvegarde sont invalides.');
            }
            const patch = {};
            for (const [key, value] of Object.entries(account)) {
                if (key === 'lastProfileSync') continue;
                if (!ACCOUNT_FIELDS.has(key)) {
                    throw new HttpError(400, 'BACKUP_INVALID', `Préférence de compte inconnue : ${key}.`);
                }
                patch[key] = value;
            }
            await accountService.update(user.id, { ...DEFAULT_ACCOUNT, ...patch });
            result.account = true;
        }
        if (server.windows !== undefined) {
            await windowSessionService.update(user.id, { windows: server.windows });
            result.windows = true;
        }
        if (server.notes !== undefined) {
            for (const note of validateNotes(server.notes)) {
                const outcome = await restoreNote(user.id, note.segments, note.content);
                result.notes[outcome] += 1;
            }
        }

        return result;
    }

    async function deleteAllNotes(subject) {
        let deleted = 0;
        const queue = [null];
        while (queue.length) {
            const parentId = queue.shift();
            const { items } = await documentService.list(subject, { parentId });
            const folderIds = [];
            for (const item of items) {
                if (item.trashedAt) continue;
                if (item.kind === 'folder') {
                    folderIds.push(item.id);
                    continue;
                }
                if (!isTextItem(item)) continue;
                await documentService.trash(subject, [item.id]);
                deleted += (await documentService.permanentlyDelete(subject, [item.id])).count;
            }
            queue.push(...folderIds);
        }
        return { deleted };
    }

    async function reset(user, rawTargets) {
        if (!Array.isArray(rawTargets) || !rawTargets.length || rawTargets.some((target) => typeof target !== 'string' || !RESET_TARGETS.has(target) || rawTargets.indexOf(target) !== rawTargets.lastIndexOf(target))) {
            throw new HttpError(400, 'BACKUP_RESET_TARGET_INVALID', `Cibles de réinitialisation autorisées : ${[...RESET_TARGETS].join(', ')}.`);
        }
        const targets = new Set(rawTargets);
        const result = {};
        if (targets.has('settings')) {
            await settingsService.update(user.id, { ...DEFAULT_SETTINGS });
            result.settings = true;
        }
        if (targets.has('account')) {
            await accountService.update(user.id, { ...DEFAULT_ACCOUNT });
            result.account = true;
        }
        if (targets.has('windows')) {
            await windowSessionService.clear(user.id);
            result.windows = true;
        }
        if (targets.has('notes')) {
            result.notes = await deleteAllNotes(user.id);
        }
        return result;
    }

    return { exportBackup, importBackup, reset };
}

module.exports = {
    createBackupService,
    BACKUP_FORMAT,
    BACKUP_SCHEMA_VERSION,
    MAX_NOTES,
    MAX_NOTE_BYTES,
    MAX_NOTES_TOTAL_BYTES
};
