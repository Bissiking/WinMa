// src/server/services/settings-service.js
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const DEFAULT_SETTINGS = Object.freeze({
    wallpaper: './images/backgrounds/luma-aurora.webp',
    theme: 'luma',
    accentColor: '#6d5ee8',
    density: 'comfortable',
    motion: 'system'
});
const ALLOWED_THEMES = new Set(['light', 'dark', 'luma', 'system']);
const ALLOWED_DENSITIES = new Set(['comfortable', 'compact']);
const ALLOWED_MOTION = new Set(['full', 'reduced', 'system']);
const WALLPAPER_PATTERN = /^\.\/images\/backgrounds\/(?:luma-aurora\.webp|background-(?:0[1-9]|1[0-2])\.jpg|4K\/background-4k-0[1-4]\.jpg)$/;
const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;
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

    return patch;
}

function createSettingsService(settingsDirectory) {
    function getPath(subject) {
        return path.join(settingsDirectory, `${storageKey(subject)}.json`);
    }

    async function read(subject) {
        try {
            const content = await fs.readFile(getPath(subject), 'utf8');
            return { ...DEFAULT_SETTINGS, ...validatePatch(JSON.parse(content)) };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { ...DEFAULT_SETTINGS };
            }

            if (error instanceof SyntaxError) {
                throw new HttpError(500, 'SETTINGS_CORRUPTED', 'Les paramètres enregistrés sont illisibles.');
            }

            throw error;
        }
    }

    async function update(subject, patch) {
        const validatedPatch = validatePatch(patch);
        const settings = { ...(await read(subject)), ...validatedPatch };
        const destination = getPath(subject);
        const temporary = `${destination}.${crypto.randomUUID()}.tmp`;

        await fs.mkdir(settingsDirectory, { recursive: true, mode: 0o700 });
        await fs.writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
        await fs.rename(temporary, destination);
        return settings;
    }

    return { read, update };
}

module.exports = { createSettingsService, DEFAULT_SETTINGS };
