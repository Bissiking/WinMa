// src/server/routes/backup-routes.js
const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

// L'import embarque les notes (jusqu'à 5 Mo) : body parser dédié, plus large
// que le limit global de 1 mb.
function createBackupRoutes(controller, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/users/me/backup', requireSession, asyncHandler(controller.export));
    router.post(
        '/api/users/me/backup',
        express.json({ limit: '8mb', strict: true }),
        requireSameOrigin,
        requireSession,
        asyncHandler(controller.import)
    );
    router.post('/api/users/me/backup/reset', requireSameOrigin, requireSession, asyncHandler(controller.reset));
    return router;
}

module.exports = { createBackupRoutes };
