// src/server/routes/settings-routes.js
const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createSettingsRoutes(settingsController, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/users/me/settings', requireSession, asyncHandler(settingsController.show));
    router.patch(
        '/api/users/me/settings',
        requireSameOrigin,
        requireSession,
        asyncHandler(settingsController.update)
    );
    return router;
}

module.exports = { createSettingsRoutes };
