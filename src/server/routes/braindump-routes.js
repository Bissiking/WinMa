const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createBrainDumpRoutes(controller, requireSession, requireSameOrigin) {
    const router = express.Router();
    const write = [requireSameOrigin, requireSession];

    router.get('/api/braindump/notes', requireSession, asyncHandler(controller.notes));
    router.post('/api/braindump/analyze', ...write, asyncHandler(controller.analyze));
    router.post('/api/braindump/notes', ...write, asyncHandler(controller.create));
    router.delete('/api/braindump/notes/:id', ...write, asyncHandler(controller.remove));
    return router;
}

module.exports = { createBrainDumpRoutes };
