// src/server/services/app-registry-service.js
const fs = require('node:fs/promises');
const { HttpError } = require('../utils/http-error');
const { normalizeFrameOrigin } = require('../config/security');

const ALLOWED_TYPES = new Set(['internal', 'iframe', 'external', 'system']);
const SAFE_APP_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SAFE_PATH = /^\/[A-Za-z0-9._\-/]*$/;

function isSafePath(value) {
    return typeof value === 'string' && SAFE_PATH.test(value) && !value.includes('..');
}

function isPositiveNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRatio(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateFlag(application, key) {
    if (application[key] !== undefined && typeof application[key] !== 'boolean') {
        throw new Error(`Application ${application.id} : ${key} doit être un booléen.`);
    }
    return application[key] === true;
}

function validateApplication(application) {
    if (
        !application ||
        !SAFE_APP_ID.test(application.id || '') ||
        typeof application.name !== 'string' ||
        !application.name.trim() ||
        typeof application.icon !== 'string' ||
        !application.icon.trim() ||
        !isSafePath(application.entry) ||
        !ALLOWED_TYPES.has(application.type) ||
        typeof application.enabled !== 'boolean'
    ) {
        throw new Error(`Application invalide dans le registre : ${application?.id || 'sans identifiant'}.`);
    }

    if (application.type === 'iframe') {
        if (typeof application.allowedOrigin !== 'string' || !application.allowedOrigin.trim()) {
            throw new Error(`L'application iframe ${application.id} doit déclarer allowedOrigin.`);
        }
        if (!normalizeFrameOrigin(application.allowedOrigin)) {
            throw new Error(`L'application iframe ${application.id} doit déclarer une allowedOrigin https valide (host[:port] sans chemin).`);
        }
    }

    if (application.module !== undefined && !isSafePath(application.module)) {
        throw new Error(`Application ${application.id} : module doit être un chemin interne sûr.`);
    }

    if (application.logo !== undefined && !isSafePath(application.logo)) {
        throw new Error(`Application ${application.id} : logo doit être un chemin interne sûr.`);
    }

    const windowDefinition = application.window;
    if (
        !windowDefinition ||
        !isPositiveNumber(windowDefinition.width) ||
        !isPositiveNumber(windowDefinition.height) ||
        !isPositiveNumber(windowDefinition.minWidth) ||
        !isPositiveNumber(windowDefinition.minHeight)
    ) {
        throw new Error(`Application ${application.id} : window doit déclarer width, height, minWidth et minHeight positifs.`);
    }

    let position;
    if (application.position !== undefined) {
        const { left, top } = application.position || {};
        if (!isRatio(left) || !isRatio(top)) {
            throw new Error(`Application ${application.id} : position doit contenir left et top compris entre 0 et 1.`);
        }
        position = Object.freeze({ left, top });
    }

    // Liste blanche : seuls les champs publiés par le registre survivent,
    // un champ inconnu (pinned, etc.) est retiré sans jamais atteindre l'API.
    return Object.freeze({
        id: application.id,
        name: application.name,
        icon: application.icon,
        ...(isSafePath(application.logo) ? { logo: application.logo } : {}),
        entry: application.entry,
        ...(application.module !== undefined ? { module: application.module } : {}),
        ...(typeof application.taskbarName === 'string' ? { taskbarName: application.taskbarName } : {}),
        type: application.type,
        enabled: application.enabled,
        hidden: validateFlag(application, 'hidden'),
        storeManaged: validateFlag(application, 'storeManaged'),
        incompatible: validateFlag(application, 'incompatible'),
        ...(application.type === 'iframe' ? { allowedOrigin: application.allowedOrigin } : {}),
        window: Object.freeze({
            width: windowDefinition.width,
            height: windowDefinition.height,
            minWidth: windowDefinition.minWidth,
            minHeight: windowDefinition.minHeight
        }),
        ...(position ? { position } : {})
    });
}

function createAppRegistryService(registryPath) {
    let applications = null;

    async function load() {
        if (applications) {
            return applications;
        }

        const content = await fs.readFile(registryPath, 'utf8');
        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed)) {
            throw new Error("Le registre d'applications doit être un tableau JSON.");
        }

        applications = Object.freeze(parsed.map(validateApplication));
        return applications;
    }

    async function list() {
        return (await load()).filter((application) => application.enabled);
    }

    // Origines https des apps iframe activées : injectées dans le frame-src de la CSP.
    async function listAllowedFrameOrigins() {
        const apps = await list();
        return [...new Set(
            apps
                .filter((application) => application.type === 'iframe')
                .map((application) => normalizeFrameOrigin(application.allowedOrigin))
                .filter(Boolean)
        )];
    }

    async function findById(appId) {
        if (!SAFE_APP_ID.test(appId || '')) {
            throw new HttpError(400, 'APP_ID_INVALID', "L'identifiant d'application est invalide.");
        }

        const application = (await list()).find((item) => item.id === appId);

        if (!application) {
            throw new HttpError(404, 'APP_NOT_FOUND', 'Application introuvable.');
        }

        return application;
    }

    return { list, listAllowedFrameOrigins, findById, load };
}

module.exports = { createAppRegistryService };
