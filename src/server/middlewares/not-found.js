// src/server/middlewares/not-found.js
const { sendError } = require('../utils/api-response');

function notFound(req, res) {
    return sendError(res, 'Ressource introuvable.', 'NOT_FOUND', 404);
}

module.exports = { notFound };
