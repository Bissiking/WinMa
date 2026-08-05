// src/server/routes/session-routes.js
const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createSessionRoutes(sessionController) {
    const router = express.Router();
    router.get('/api/session', asyncHandler(sessionController.show));
    return router;
}

module.exports = { createSessionRoutes };
