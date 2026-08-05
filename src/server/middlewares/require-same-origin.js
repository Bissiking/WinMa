// src/server/middlewares/require-same-origin.js
const { HttpError } = require('../utils/http-error');

function createRequireSameOrigin(appBaseUrl) {
    const expectedOrigin = new URL(appBaseUrl).origin;

    return function requireSameOrigin(req, res, next) {
        const origin = req.get('origin');

        if (origin && origin !== expectedOrigin) {
            return next(new HttpError(403, 'ORIGIN_REJECTED', 'Origine de requête refusée.'));
        }

        return next();
    };
}

module.exports = { createRequireSameOrigin };
