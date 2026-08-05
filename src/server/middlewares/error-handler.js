// src/server/middlewares/error-handler.js
const { sendError } = require('../utils/api-response');
const logger = require('../utils/logger');

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = error.code || 'INTERNAL_ERROR';
    const message = error.expose ? error.message : 'Une erreur interne est survenue.';

    logger.error('request_failed', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status,
        code,
        error: error.message
    });

    return sendError(res, message, code, status);
}

module.exports = { errorHandler };
