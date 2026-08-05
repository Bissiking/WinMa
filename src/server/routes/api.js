// src/server/routes/api.js
const express = require('express');
const { sendSuccess } = require('../utils/api-response');

function createApiRoutes() {
    const router = express.Router();
    router.get('/api/health', (req, res) => sendSuccess(res, { status: 'ok' }));
    return router;
}

module.exports = { createApiRoutes };
