const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const DEFAULT_ACCOUNT = Object.freeze({
    preferredName: '',
    language: 'fr-FR',
    timeZone: 'auto',
    syncProfile: true,
    syncAppearance: true
});
const ALLOWED_FIELDS = new Set(Object.keys(DEFAULT_ACCOUNT));
const ALLOWED_LANGUAGES = new Set(['fr-FR', 'en-US']);

function storageKey(subject) {
    return crypto.createHash('sha256').update(subject).digest('hex');
}

function isValidTimeZone(value) {
    if (value === 'auto') return true;
    if (typeof value !== 'string' || value.length > 80) return false;
    try {
        new Intl.DateTimeFormat('fr-FR', { timeZone: value }).format();
        return true;
    } catch {
        return false;
    }
}

function validatePatch(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new HttpError(400, 'ACCOUNT_INVALID', 'Les préférences du compte doivent être un objet JSON.');
    }
    const entries = Object.entries(patch);
    if (!entries.length || entries.some(([key]) => !ALLOWED_FIELDS.has(key))) {
        throw new HttpError(400, 'ACCOUNT_INVALID', 'Une ou plusieurs préférences de compte sont inconnues.');
    }
    if ('preferredName' in patch && (
        typeof patch.preferredName !== 'string' ||
        patch.preferredName.trim().length > 80 ||
        /[\u0000-\u001f]/.test(patch.preferredName)
    )) {
        throw new HttpError(400, 'ACCOUNT_NAME_INVALID', 'Le nom préféré ne peut pas dépasser 80 caractères.');
    }
    if ('language' in patch && !ALLOWED_LANGUAGES.has(patch.language)) {
        throw new HttpError(400, 'ACCOUNT_LANGUAGE_INVALID', 'Cette langue n’est pas prise en charge.');
    }
    if ('timeZone' in patch && !isValidTimeZone(patch.timeZone)) {
        throw new HttpError(400, 'ACCOUNT_TIMEZONE_INVALID', 'Ce fuseau horaire est invalide.');
    }
    for (const field of ['syncProfile', 'syncAppearance']) {
        if (field in patch && typeof patch[field] !== 'boolean') {
            throw new HttpError(400, 'ACCOUNT_SYNC_INVALID', 'Les options de synchronisation doivent être booléennes.');
        }
    }
    return {
        ...patch,
        ...(patch.preferredName !== undefined ? { preferredName: patch.preferredName.trim() } : {})
    };
}

function createAccountService(accountsDirectory) {
    function getPath(subject) {
        return path.join(accountsDirectory, `${storageKey(subject)}.json`);
    }

    async function read(subject) {
        try {
            const content = await fs.readFile(getPath(subject), 'utf8');
            return { ...DEFAULT_ACCOUNT, ...validatePatch(JSON.parse(content)) };
        } catch (error) {
            if (error.code === 'ENOENT') return { ...DEFAULT_ACCOUNT };
            if (error instanceof SyntaxError) {
                throw new HttpError(500, 'ACCOUNT_CORRUPTED', 'Les préférences du compte sont illisibles.');
            }
            throw error;
        }
    }

    async function update(subject, patch) {
        const account = { ...(await read(subject)), ...validatePatch(patch) };
        const destination = getPath(subject);
        const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
        await fs.mkdir(accountsDirectory, { recursive: true, mode: 0o700 });
        await fs.writeFile(temporary, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
        await fs.rename(temporary, destination);
        return account;
    }

    return { read, update };
}

module.exports = { createAccountService, DEFAULT_ACCOUNT, validatePatch };
