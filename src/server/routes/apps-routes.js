// src/server/routes/apps-routes.js
const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createAppsRoutes(appsController, requireSession) {
    const router = express.Router();
    router.get('/api/apps', requireSession, asyncHandler(appsController.list));
    router.get('/api/apps/:appId', requireSession, asyncHandler(appsController.show));
    return router;
}

module.exports = { createAppsRoutes };
