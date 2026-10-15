// src/server/routes/session-routes.js
const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createSessionRoutes(sessionController, requireSession) {
    const router = express.Router();
    router.get('/api/session', asyncHandler(sessionController.show));
    router.get('/api/users/me/avatar', requireSession, asyncHandler(sessionController.avatar));
    return router;
}

module.exports = { createSessionRoutes };
