// src/server/services/app-registry-service.js
const fs = require('node:fs/promises');
const { HttpError } = require('../utils/http-error');

const ALLOWED_TYPES = new Set(['internal', 'iframe', 'external', 'system']);
const SAFE_APP_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

function validateApplication(application) {
    if (
        !application ||
        !SAFE_APP_ID.test(application.id || '') ||
        typeof application.name !== 'string' ||
        typeof application.icon !== 'string' ||
        typeof application.entry !== 'string' ||
        !ALLOWED_TYPES.has(application.type) ||
        typeof application.enabled !== 'boolean'
    ) {
        throw new Error(`Application invalide dans le registre : ${application?.id || 'sans identifiant'}.`);
    }

    if (application.type === 'iframe' && !application.allowedOrigin) {
        throw new Error(`L'application iframe ${application.id} doit déclarer allowedOrigin.`);
    }

    return Object.freeze({ ...application, window: Object.freeze({ ...application.window }) });
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

    return { list, findById, load };
}

module.exports = { createAppRegistryService };
