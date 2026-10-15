const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const DEFAULT_ACCOUNT = Object.freeze({
    preferredName: '',
    language: 'fr-FR',
    timeZone: 'auto',
    syncProfile: true,
    syncAppearance: true,
    lastProfileSync: null
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
    if ('lastProfileSync' in patch) {
        const snapshot = patch.lastProfileSync;
        const isStringOrNull = (value) => value === null || typeof value === 'string';
        if (
            snapshot !== null &&
            (typeof snapshot !== 'object' || Array.isArray(snapshot) ||
                !isStringOrNull(snapshot.displayName) ||
                !isStringOrNull(snapshot.locale) ||
                !isStringOrNull(snapshot.timezone))
        ) {
            throw new HttpError(400, 'ACCOUNT_SYNC_INVALID', 'Le snapshot de synchronisation est invalide.');
        }
    }
    return {
        ...patch,
        ...(patch.preferredName !== undefined ? { preferredName: patch.preferredName.trim() } : {})
    };
}

function snapshotFromClaims(claims) {
    return {
        displayName: typeof claims?.display_name === 'string' ? claims.display_name : null,
        locale: typeof claims?.locale === 'string' ? claims.locale : null,
        timezone: typeof claims?.timezone === 'string' ? claims.timezone : null
    };
}

function createAccountService(options) {
    // Compatibilité : createAccountService(chemin) = persistance fichier seule.
    const { repository, legacyDirectory } = typeof options === 'string'
        ? { repository: null, legacyDirectory: options }
        : (options || {});

    function getPath(subject) {
        return legacyDirectory ? path.join(legacyDirectory, `${storageKey(subject)}.json`) : null;
    }

    function parseStored(content, source) {
        try {
            return { ...DEFAULT_ACCOUNT, ...validatePatch(JSON.parse(content)) };
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new HttpError(500, 'ACCOUNT_CORRUPTED', 'Les préférences du compte sont illisibles.');
            }
            if (error instanceof HttpError) throw error;
            throw new HttpError(500, 'ACCOUNT_CORRUPTED', `Les préférences du compte sont illisibles (${source}).`);
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
            // Repli lecture : les préférences historiques restent visibles et
            // sont reportées progressivement dans le repository (aucune suppression).
            if (repository) {
                await repository.upsert(key, legacy, new Date().toISOString());
            }
            return legacy;
        }

        return { ...DEFAULT_ACCOUNT };
    }

    async function update(subject, patch) {
        const account = { ...(await read(subject)), ...validatePatch(patch) };

        if (repository) {
            await repository.upsert(storageKey(subject), account, new Date().toISOString());
            return account;
        }

        const destination = getPath(subject);
        if (!destination) {
            throw new HttpError(500, 'ACCOUNT_STORAGE_MISSING', 'Aucun stockage de préférences configuré.');
        }
        const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
        await fs.writeFile(temporary, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
        await fs.rename(temporary, destination);
        return account;
    }

    // Pull Kyros → Luma : si le profil Kyros a changé depuis le dernier
    // synchronisme, les préférences locales suivent (syncProfile actif).
    async function applyKyrosProfile(subject, claims) {
        const account = await read(subject);
        if (!account.syncProfile || !claims) {
            return account;
        }

        const snapshot = snapshotFromClaims(claims);
        const previous = account.lastProfileSync;
        const changed = !previous ||
            previous.displayName !== snapshot.displayName ||
            previous.locale !== snapshot.locale ||
            previous.timezone !== snapshot.timezone;

        if (!changed) {
            return account;
        }

        // Premier passage : on mémorise l'état Kyros sans écraser les préférences locales.
        if (!previous) {
            return update(subject, { lastProfileSync: snapshot });
        }

        const patch = { lastProfileSync: snapshot };
        if (snapshot.displayName && snapshot.displayName !== previous.displayName) {
            patch.preferredName = snapshot.displayName;
        }
        if (snapshot.locale && snapshot.locale !== previous.locale && ALLOWED_LANGUAGES.has(snapshot.locale)) {
            patch.language = snapshot.locale;
        }
        if (snapshot.timezone && snapshot.timezone !== previous.timezone && isValidTimeZone(snapshot.timezone)) {
            patch.timeZone = snapshot.timezone;
        }
        return update(subject, patch);
    }

    return { read, update, applyKyrosProfile, snapshotFromClaims };
}

module.exports = { createAccountService, DEFAULT_ACCOUNT, validatePatch };
