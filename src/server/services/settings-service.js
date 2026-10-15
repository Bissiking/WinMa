// src/server/services/settings-service.js
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const DEFAULT_SETTINGS = Object.freeze({
    wallpaper: './images/backgrounds/background-00.jpg',
    theme: 'luma',
    accentColor: '#6d5ee8',
    density: 'comfortable',
    motion: 'system',
    restoreSession: true,
    startupApps: [],
    startupDelayMs: 90,
    startupMode: 'staggered',
    startupProfiles: {},
    startupActiveProfile: null,
    startupOpenTrash: false,
    startupOpenRecents: false,
    startupRestoreFolder: false,
    startupPresentation: false,
    lockAfterIdleMs: 300000
});
const ALLOWED_THEMES = new Set(['light', 'dark', 'luma', 'system']);
const ALLOWED_DENSITIES = new Set(['comfortable', 'compact']);
const ALLOWED_MOTION = new Set(['full', 'reduced', 'system']);
const ALLOWED_STARTUP_MODES = new Set(['staggered', 'simultaneous']);
const WALLPAPER_PATTERN = /^\.\/images\/backgrounds\/(?:luma-aurora\.webp|background-(?:0[0-9]|1[0-2])\.jpg|4K\/background-4k-0[1-4]\.jpg)$/;
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PROFILE_NAME_PATTERN = /^[\p{L}\p{M}\s.'’-]{1,40}$/u;
const ALLOWED_FIELDS = new Set(Object.keys(DEFAULT_SETTINGS));

function storageKey(subject) {
    return crypto.createHash('sha256').update(subject).digest('hex');
}

function validatePatch(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new HttpError(400, 'SETTINGS_INVALID', 'Les paramètres doivent être un objet JSON.');
    }

    const entries = Object.entries(patch);

    if (entries.length === 0 || entries.some(([key]) => !ALLOWED_FIELDS.has(key))) {
        throw new HttpError(400, 'SETTINGS_INVALID', 'Un ou plusieurs paramètres sont inconnus.');
    }

    if ('wallpaper' in patch && !WALLPAPER_PATTERN.test(patch.wallpaper)) {
        throw new HttpError(400, 'WALLPAPER_INVALID', "Ce fond d'écran n'est pas autorisé.");
    }

    if ('theme' in patch && !ALLOWED_THEMES.has(patch.theme)) {
        throw new HttpError(400, 'THEME_INVALID', "Le thème demandé n'est pas autorisé.");
    }

    if ('accentColor' in patch && !ACCENT_PATTERN.test(patch.accentColor)) {
        throw new HttpError(400, 'ACCENT_INVALID', "La couleur d'accentuation doit être au format #RRGGBB.");
    }

    if ('density' in patch && !ALLOWED_DENSITIES.has(patch.density)) {
        throw new HttpError(400, 'DENSITY_INVALID', 'La densité demandée n’est pas autorisée.');
    }

    if ('motion' in patch && !ALLOWED_MOTION.has(patch.motion)) {
        throw new HttpError(400, 'MOTION_INVALID', 'Le niveau de mouvement demandé n’est pas autorisé.');
    }

    if ('restoreSession' in patch && typeof patch.restoreSession !== 'boolean') {
        throw new HttpError(400, 'RESTORE_SESSION_INVALID', 'La réouverture au démarrage doit être un booléen.');
    }

    if ('startupApps' in patch) {
        const apps = patch.startupApps;
        if (!Array.isArray(apps) || apps.length > 20 || apps.some((id) => typeof id !== 'string' || !APP_ID_PATTERN.test(id))) {
            throw new HttpError(400, 'STARTUP_APPS_INVALID', 'La liste des applications de démarrage est invalide.');
        }
    }

    if ('startupDelayMs' in patch) {
        const delay = patch.startupDelayMs;
        if (!Number.isInteger(delay) || delay < 0 || delay > 5000) {
            throw new HttpError(400, 'STARTUP_DELAY_INVALID', 'Le délai de démarrage doit être un entier entre 0 et 5000 ms.');
        }
    }

    if ('startupMode' in patch && !ALLOWED_STARTUP_MODES.has(patch.startupMode)) {
        throw new HttpError(400, 'STARTUP_MODE_INVALID', 'Le mode de démarrage demandé n’est pas autorisé.');
    }

    if ('startupProfiles' in patch) {
        const profiles = patch.startupProfiles;
        const isValidProfile = (profile) => profile && typeof profile === 'object' && !Array.isArray(profile) &&
            Array.isArray(profile.apps) && profile.apps.length <= 20 &&
            profile.apps.every((id) => typeof id === 'string' && APP_ID_PATTERN.test(id)) &&
            (profile.delayMs === undefined || (Number.isInteger(profile.delayMs) && profile.delayMs >= 0 && profile.delayMs <= 5000)) &&
            (profile.mode === undefined || ALLOWED_STARTUP_MODES.has(profile.mode));
        if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) ||
            Object.entries(profiles).some(([name, profile]) => !PROFILE_NAME_PATTERN.test(name) || !isValidProfile(profile))) {
            throw new HttpError(400, 'STARTUP_PROFILES_INVALID', 'Les profils de démarrage sont invalides.');
        }
    }

    if ('startupActiveProfile' in patch) {
        const active = patch.startupActiveProfile;
        if (active !== null && (typeof active !== 'string' || !PROFILE_NAME_PATTERN.test(active))) {
            throw new HttpError(400, 'STARTUP_PROFILE_INVALID', 'Le profil de démarrage actif est invalide.');
        }
    }

    for (const field of ['startupOpenTrash', 'startupOpenRecents', 'startupRestoreFolder', 'startupPresentation']) {
        if (field in patch && typeof patch[field] !== 'boolean') {
            throw new HttpError(400, 'STARTUP_OPTION_INVALID', 'Les options de démarrage doivent être booléennes.');
        }
    }

    if ('lockAfterIdleMs' in patch) {
        const lockDelay = patch.lockAfterIdleMs;
        if (!Number.isInteger(lockDelay) || (lockDelay !== 0 && (lockDelay < 30000 || lockDelay > 86400000))) {
            throw new HttpError(400, 'LOCK_AFTER_IDLE_INVALID', 'Le délai de verrouillage doit être 0 (jamais) ou un entier entre 30000 et 86400000 ms.');
        }
    }

    return patch;
}

function createSettingsService(options) {
    // Compatibilité : createSettingsService(chemin) = persistance fichier seule.
    const { repository, legacyDirectory } = typeof options === 'string'
        ? { repository: null, legacyDirectory: options }
        : (options || {});

    function getPath(subject) {
        return legacyDirectory ? path.join(legacyDirectory, `${storageKey(subject)}.json`) : null;
    }

    function parseStored(content, source) {
        try {
            return { ...DEFAULT_SETTINGS, ...validatePatch(JSON.parse(content)) };
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new HttpError(500, 'SETTINGS_CORRUPTED', 'Les paramètres enregistrés sont illisibles.');
            }
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'SETTINGS_CORRUPTED', `Les paramètres enregistrés sont illisibles (${source}).`);
        }
    }

    async function readLegacy(subject) {
        const destination = getPath(subject);
        if (!destination) return null;
        try {
            const content = await fs.readFile(destination, 'utf8');
            return parseStored(content, 'fichier');
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async function read(subject) {
        const key = storageKey(subject);

        if (repository) {
            const row = await repository.find(key);
            if (row) return parseStored(row.data, 'base de données');
        }

        const legacy = await readLegacy(subject);
        if (legacy) {
            // Repli lecture : les paramètres historiques restent visibles et
            // sont reportés progressivement dans le repository (aucune suppression).
            if (repository) {
                await repository.upsert(key, legacy, new Date().toISOString());
            }
            return legacy;
        }

        return { ...DEFAULT_SETTINGS };
    }

    async function update(subject, patch) {
        const validatedPatch = validatePatch(patch);
        const settings = { ...(await read(subject)), ...validatedPatch };

        if (repository) {
            await repository.upsert(storageKey(subject), settings, new Date().toISOString());
            return settings;
        }

        const destination = getPath(subject);
        if (!destination) {
            throw new HttpError(500, 'SETTINGS_STORAGE_MISSING', 'Aucun stockage de paramètres configuré.');
        }
        const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        await fs.writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
        await fs.rename(temporary, destination);
        return settings;
    }

    return { read, update };
}

module.exports = { createSettingsService, DEFAULT_SETTINGS };
