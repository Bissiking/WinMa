// src/server/middlewares/require-session.js
const { HttpError } = require('../utils/http-error');

function createRequireSession(sessionService) {
    return async function requireSession(req, res, next) {
        try {
            const user = await sessionService.refreshIfNeeded(req);

            if (!user) {
                return next(new HttpError(401, 'SESSION_REQUIRED', 'Une connexion Kyros est requise.'));
            }

            req.user = user;
            return next();
        } catch (error) {
            return next(error);
        }
    };
}

module.exports = { createRequireSession };
